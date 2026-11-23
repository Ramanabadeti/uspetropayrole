const express = require("express");
const connectDB = require("../../db");
const logger = require("../logger");
const validate = require("../middleware/validate");
const schemas = require("../lib/schemas");
const employees = require("../lib/employees");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAdmin, requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * The roster.
 *
 * This endpoint used to return every employee's plaintext password to anyone
 * who asked — the login screen downloaded it and compared in the browser.
 * It is now behind a session and selects only non-secret columns.
 */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.session.user.role === "admin";
    const rows = await employees.listPublic({ includeInactive: isAdmin });
    // An employee has no business reading the whole roster; they get
    // themselves, which is all the UI needs.
    res.json(isAdmin ? rows : rows.filter((r) => r.id === req.session.user.id));
  })
);

router.post(
  "/",
  requireAdmin,
  validate({ body: schemas.createEmployee }),
  asyncHandler(async (req, res) => {
    const { no, name, password, role, mailID, hourlyRate, active } = req.body;
    const db = await connectDB();

    try {
      const result = await db.run(
        `INSERT INTO employees
           (emp_no, name, password_hash, role, mail_id, hourly_rate, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [no, name, await employees.hashPassword(password), role, mailID, hourlyRate, active ? 1 : 0]
      );

      logger.info({ name, role, by: req.session.user.name }, "Employee created");
      res.status(201).json({ message: "Employee added successfully", id: result.lastID });
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) {
        throw new HttpError(409, "An employee with that name already exists");
      }
      throw err;
    }
  })
);

router.put(
  "/:id",
  requireAdmin,
  validate({ params: schemas.idParam, body: schemas.updateEmployee }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { no, name, password, role, mailID, hourlyRate, active } = req.body;

    const db = await connectDB();
    const existing = await db.get("SELECT id, name FROM employees WHERE id = ?", [id]);
    if (!existing) throw new HttpError(404, "Employee not found");

    // A password is only touched when one was actually supplied — editing a
    // mail address should not force the admin to retype it.
    const sets = [
      "emp_no = ?",
      "name = ?",
      "role = ?",
      "mail_id = ?",
      "hourly_rate = ?",
      "active = ?",
      "updated_at = CURRENT_TIMESTAMP",
    ];
    const params = [no, name, role, mailID, hourlyRate, active ? 1 : 0];

    if (password) {
      sets.push("password_hash = ?", "password = NULL");
      params.push(await employees.hashPassword(password));
    }

    params.push(id);

    try {
      await db.run(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`, params);
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) {
        throw new HttpError(409, "An employee with that name already exists");
      }
      throw err;
    }

    // emp_name is denormalised onto the history rows, so a rename has to
    // carry across or the old entries stop matching by name. employee_id is
    // what actually ties them together, which is why the rename is safe.
    if (existing.name !== name) {
      await db.run("UPDATE time_entries SET emp_name = ? WHERE employee_id = ?", [name, id]);
      await db.run("UPDATE admin_notes SET emp_name = ? WHERE employee_id = ?", [name, id]);
      await db.run("UPDATE active_sessions SET emp_name = ? WHERE employee_id = ?", [name, id]);
      logger.info({ from: existing.name, to: name }, "Employee renamed, history re-pointed");
    }

    if (password || !active) {
      const destroyed = await req.sessionStore.destroyAllForEmployee(Number(id));
      if (destroyed) logger.info({ id, destroyed }, "Signed out existing sessions");
    }

    logger.info({ id, name, by: req.session.user.name }, "Employee updated");
    res.json({ message: "Employee updated successfully" });
  })
);

/**
 * Removes someone who no longer works here.
 *
 * Their timesheets and notes are kept and keep their name — payroll history
 * is a record of money owed and paid, and deleting it to tidy up a staff
 * list would be the wrong trade. The rows are simply detached from the
 * employee record, which is the same state the entries filed under long-gone
 * names were already in.
 */
router.delete(
  "/:id",
  requireAdmin,
  validate({ params: schemas.idParam }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = await connectDB();

    const existing = await db.get("SELECT id, name, role FROM employees WHERE id = ?", [id]);
    if (!existing) throw new HttpError(404, "Employee not found");

    if (Number(id) === Number(req.session.user.id)) {
      throw new HttpError(409, "You cannot delete the account you are signed in as");
    }

    if (existing.role === "admin") {
      const { admins } = await db.get(
        "SELECT COUNT(*) AS admins FROM employees WHERE role = 'admin' AND active = 1"
      );
      if (admins <= 1) {
        throw new HttpError(409, "That is the only admin left — there would be nobody to sign in");
      }
    }

    const { entries } = await db.get(
      "SELECT COUNT(*) AS entries FROM time_entries WHERE employee_id = ?",
      [id]
    );
    const { notes } = await db.get(
      "SELECT COUNT(*) AS notes FROM admin_notes WHERE employee_id = ?",
      [id]
    );

    await db.exec("BEGIN");
    try {
      await db.run("UPDATE time_entries SET employee_id = NULL WHERE employee_id = ?", [id]);
      await db.run("UPDATE admin_notes SET employee_id = NULL WHERE employee_id = ?", [id]);
      await db.run("DELETE FROM active_sessions WHERE employee_id = ?", [id]);
      await db.run("DELETE FROM employees WHERE id = ?", [id]);
      await db.exec("COMMIT");
    } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
    }

    await req.sessionStore.destroyAllForEmployee(Number(id));

    logger.warn(
      { id: Number(id), name: existing.name, entries, notes, by: req.session.user.name },
      "Employee deleted, history kept"
    );

    res.json({
      message: `${existing.name} removed.`,
      entriesKept: entries,
      notesKept: notes,
    });
  })
);

module.exports = router;

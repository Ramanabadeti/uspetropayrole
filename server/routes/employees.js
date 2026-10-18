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

module.exports = router;

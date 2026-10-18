const express = require("express");
const connectDB = require("../../db");
const logger = require("../logger");
const validate = require("../middleware/validate");
const schemas = require("../lib/schemas");
const employeeRepo = require("../lib/employees");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAdmin, requireAuth, requireSelfOrAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Records that an employee was actually paid.
 *
 * A Note is the app's only record of money changing hands, which is why the
 * Statistics pay total is built from these and never from day_pay.
 */
router.post(
  "/admin-notes",
  requireAdmin,
  validate({ body: schemas.createAdminNote }),
  asyncHandler(async (req, res) => {
    const { empName, noteDate, note, amountPaid, amountPending, month, year } = req.body;

    const employee = await employeeRepo.findByName(empName);
    if (!employee) throw new HttpError(404, `No employee named ${empName}`);

    const db = await connectDB();
    const result = await db.run(
      `INSERT INTO admin_notes
         (emp_name, employee_id, note_date, note, amount_paid, amount_pending, month, year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee.name, employee.id, noteDate, note, amountPaid, amountPending, month, year]
    );

    logger.info(
      { name: employee.name, amountPaid, period: `${month}/${year}`, by: req.session.user.name },
      "Payment note recorded"
    );

    res.status(201).json({ message: "Note saved successfully", id: result.lastID });
  })
);

/**
 * The payment ledger for one employee and pay period.
 *
 * The stored month/year is the pay period a payment counts toward — for
 * historical notes it is which monthly paysheet the note was filed under (the
 * person entering it decided that at the time, which is more reliable than
 * guessing from the note's own date: two notes both dated 12/1 were filed
 * under October and November because they really were two separate periods'
 * payments). For notes entered through this app it is whatever month/year was
 * selected in the search filters when "Submit Note" was clicked.
 */
router.get(
  "/admin-notes",
  requireAuth,
  validate({ query: schemas.adminNotesQuery }),
  requireSelfOrAdmin((req) => req.query.employeeName),
  asyncHandler(async (req, res) => {
    const { employeeName, month, year } = req.query;
    const db = await connectDB();

    const params = [employeeName];
    let query = `
      SELECT id,
             emp_name AS employeeName,
             employee_id AS employeeId,
             note_date AS noteDate,
             note,
             amount_paid AS amountPaid,
             amount_pending AS amountPending,
             month,
             year
      FROM admin_notes
      WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?))
    `;

    if (month) {
      query += " AND month = ?";
      params.push(month);
    }
    if (year) {
      query += " AND year = ?";
      params.push(year);
    }

    query += " ORDER BY note_date ASC, id ASC";

    res.json(await db.all(query, params));
  })
);

module.exports = router;

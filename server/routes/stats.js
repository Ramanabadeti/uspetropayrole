const express = require("express");
const fs = require("fs");
const XLSX = require("xlsx");
const connectDB = require("../../db");
const logger = require("../logger");
const validate = require("../middleware/validate");
const schemas = require("../lib/schemas");
const payroll = require("../lib/payroll");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAdmin, requireAuth, requireSelfOrAdmin } = require("../middleware/auth");
const { EMPLOYEE_SHEET_PATH } = require("../../config");

const router = express.Router();

/**
 * Per-month hours and pay for the Statistics chart.
 *
 * See buildEmployeeStats for why pay comes only from Notes.
 */
router.get(
  "/employee-stats",
  requireAuth,
  validate({ query: schemas.employeeStatsQuery }),
  requireSelfOrAdmin((req) => req.query.employeeName),
  asyncHandler(async (req, res) => {
    const { employeeName } = req.query;
    const db = await connectDB();

    const hoursRows = await db.all(
      `SELECT month, year, SUM(decimal_hours) AS totalHours
       FROM time_entries
       WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?))
       GROUP BY year, month`,
      [employeeName]
    );

    const notesRows = await db.all(
      `SELECT month, year, SUM(amount_paid) AS notesSum
       FROM admin_notes
       WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?))
       GROUP BY year, month`,
      [employeeName]
    );

    res.json(payroll.buildEmployeeStats(hoursRows, notesRows));
  })
);

/**
 * Employee mail addresses out of the legacy paysheet workbook.
 *
 * Kept for the admin's "email this payroll" flow. Employees live in the
 * database now, so this is only a convenience read of the old sheet.
 */
router.get(
  "/emails",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!fs.existsSync(EMPLOYEE_SHEET_PATH)) {
      logger.warn({ path: EMPLOYEE_SHEET_PATH }, "Employee sheet not found");
      throw new HttpError(
        404,
        "Employee details workbook not found. Check PUNCHWAY_DATA_DIR in .env."
      );
    }

    const workbook = XLSX.readFile(EMPLOYEE_SHEET_PATH);
    const sheet = workbook.Sheets.EmployeeDetails;
    if (!sheet) throw new HttpError(400, "Sheet 'EmployeeDetails' not found in the workbook");

    const data = XLSX.utils.sheet_to_json(sheet);
    if (!Array.isArray(data)) throw new HttpError(500, "Unexpected data format in the workbook");

    res.json(
      data.map((row) => ({
        name: row.name || "",
        role: row.role || "",
        mailID: row.mailID || "",
      }))
    );
  })
);

module.exports = router;

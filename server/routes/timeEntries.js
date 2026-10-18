const express = require("express");
const connectDB = require("../../db");
const logger = require("../logger");
const validate = require("../middleware/validate");
const schemas = require("../lib/schemas");
const employeeRepo = require("../lib/employees");
const payroll = require("../lib/payroll");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAdmin, requireAuth, requireSelfOrAdmin } = require("../middleware/auth");
const { MAX_SHIFT_HOURS } = require("../../config");

const router = express.Router();

const ENTRY_COLUMNS = `
  id,
  emp_name AS empName,
  employee_id AS employeeId,
  clock_in_date AS clockInDate,
  clock_in_time AS clockInTime,
  clock_out_date AS clockOutDate,
  clock_out_time AS clockOutTime,
  clock_in_full_time AS clockInFullTime,
  clock_out_full_time AS clockOutFullTime,
  total_hours AS totalHours,
  decimal_hours AS decimalHours,
  hourly_rate AS hourlyRate,
  day_pay AS dayPay,
  month,
  year,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

/**
 * One employee's timesheet for a pay period.
 *
 * Was a POST (with the employee name in the body) and completely open; it is
 * a GET behind a self-or-admin check now. The POST form is kept as an alias
 * further down so an un-updated client keeps working.
 */
async function employeeLogs(req, res) {
  const { employeeName, month, year } = req.query;
  const db = await connectDB();

  const params = [employeeName];
  let query = `SELECT ${ENTRY_COLUMNS} FROM time_entries WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?))`;

  if (month) {
    query += " AND month = ?";
    params.push(month);
  }
  if (year) {
    query += " AND year = ?";
    params.push(year);
  }

  query += " ORDER BY clock_in_full_time ASC, id ASC";

  res.json(await db.all(query, params));
}

router.get(
  "/employee-logs",
  requireAuth,
  validate({ query: schemas.employeeLogsQuery }),
  requireSelfOrAdmin((req) => req.query.employeeName),
  asyncHandler(employeeLogs)
);

// Legacy shape: the old frontend posted the filters as a JSON body.
router.post(
  "/employee-logs",
  requireAuth,
  validate({ body: schemas.employeeLogsQuery }),
  requireSelfOrAdmin((req) => req.body.employeeName),
  asyncHandler(async (req, res) => {
    req.query = req.body;
    return employeeLogs(req, res);
  })
);

/** Every employee's entries for a period — the admin table. */
router.get(
  "/time-entries",
  requireAdmin,
  validate({ query: schemas.timeEntriesQuery }),
  asyncHandler(async (req, res) => {
    const { employeeName, month, year, limit } = req.query;
    const db = await connectDB();

    const params = [];
    let query = `SELECT ${ENTRY_COLUMNS} FROM time_entries WHERE 1 = 1`;

    if (employeeName) {
      query += " AND TRIM(LOWER(emp_name)) = TRIM(LOWER(?))";
      params.push(employeeName);
    }
    if (month) {
      query += " AND month = ?";
      params.push(month);
    }
    if (year) {
      query += " AND year = ?";
      params.push(year);
    }

    // Unbounded before: the table grows forever and the admin page fetched
    // all of it on every filter change.
    query += " ORDER BY id DESC LIMIT ?";
    params.push(limit);

    res.json(await db.all(query, params));
  })
);

/**
 * Admin correction of a single entry.
 *
 * The rate handling here is the fix for a real pay bug. The admin page sent
 * `hourlyRate` from its on-screen "Pay Rate" filter box on *every* edit, and
 * the old handler stored it — so correcting a clock-out time silently
 * repriced the whole day at whatever happened to be typed in a filter field.
 * Entry 626 went 113.70 -> 410.54 -> 98.54 across an edit and its exact
 * reversal, because the rate moved 15 -> 13 behind the scenes while the hours
 * returned to where they started.
 *
 * So: an omitted rate means "keep what this entry was already priced at",
 * never "use whatever the client sent" and never "use the employee's current
 * rate" (historical entries are deliberately priced at the rate in force at
 * the time). The one exception is an entry sitting at 0, which is an earlier
 * bug's leftovers rather than a real decision.
 */
router.put(
  "/time-entry/:id",
  requireAdmin,
  validate({ params: schemas.idParam, body: schemas.updateTimeEntry }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { clockInDate, clockInTime, clockOutDate, clockOutTime, hourlyRate, editReason } =
      req.body;

    const db = await connectDB();
    const existing = await db.get("SELECT * FROM time_entries WHERE id = ?", [id]);
    if (!existing) throw new HttpError(404, "Time entry not found");

    let rate;
    if (hourlyRate !== undefined) {
      rate = hourlyRate;
    } else if (Number(existing.hourly_rate) > 0) {
      rate = Number(existing.hourly_rate);
    } else {
      // Priced at 0 by the old client-side path — fall back to the
      // employee's configured rate rather than leaving the day unpaid.
      rate = await employeeRepo.rateFor(existing.employee_id);
      logger.warn(
        { entryId: existing.id, rate },
        "Entry had no hourly rate; using the employee's configured rate"
      );
    }

    const computed = payroll.calculateWorkData({
      clockInDate: clockInDate || existing.clock_in_date,
      clockInTime: clockInTime || existing.clock_in_time,
      clockOutDate: clockOutDate || existing.clock_out_date,
      clockOutTime: clockOutTime || existing.clock_out_time,
      hourlyRate: rate,
      maxShiftHours: MAX_SHIFT_HOURS,
    });

    await db.run("BEGIN");
    try {
      await db.run(
        `UPDATE time_entries SET
           clock_in_date = ?, clock_in_time = ?, clock_out_date = ?, clock_out_time = ?,
           clock_in_full_time = ?, clock_out_full_time = ?,
           total_hours = ?, decimal_hours = ?, hourly_rate = ?, day_pay = ?,
           status = 'corrected', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          clockInDate || existing.clock_in_date,
          clockInTime || existing.clock_in_time,
          clockOutDate || existing.clock_out_date,
          clockOutTime || existing.clock_out_time,
          computed.clockInFullTime,
          computed.clockOutFullTime,
          computed.totalHours,
          computed.decimalHours,
          computed.hourlyRate,
          computed.dayPay,
          id,
        ]
      );

      await db.run(
        `INSERT INTO admin_edits (
           time_entry_id,
           old_clock_in_date, old_clock_in_time, old_clock_out_date, old_clock_out_time,
           new_clock_in_date, new_clock_in_time, new_clock_out_date, new_clock_out_time,
           old_total_hours, new_total_hours,
           old_decimal_hours, new_decimal_hours,
           old_day_pay, new_day_pay,
           edit_reason, edited_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          existing.id,
          existing.clock_in_date,
          existing.clock_in_time,
          existing.clock_out_date,
          existing.clock_out_time,
          clockInDate || existing.clock_in_date,
          clockInTime || existing.clock_in_time,
          clockOutDate || existing.clock_out_date,
          clockOutTime || existing.clock_out_time,
          existing.total_hours,
          computed.totalHours,
          existing.decimal_hours,
          computed.decimalHours,
          existing.day_pay,
          computed.dayPay,
          editReason,
          req.session.user.name,
        ]
      );

      await db.run("COMMIT");
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }

    logger.info(
      {
        entryId: existing.id,
        by: req.session.user.name,
        hours: `${existing.decimal_hours} -> ${computed.decimalHours}`,
        pay: `${existing.day_pay} -> ${computed.dayPay}`,
      },
      "Time entry corrected"
    );

    const entry = await db.get(`SELECT ${ENTRY_COLUMNS} FROM time_entries WHERE id = ?`, [id]);
    res.json({ message: "Time entry updated successfully", entry });
  })
);

/** The correction history for one entry. Written since 2026 but never readable until now. */
router.get(
  "/time-entry/:id/edits",
  requireAdmin,
  validate({ params: schemas.idParam }),
  asyncHandler(async (req, res) => {
    const db = await connectDB();
    const rows = await db.all(
      `SELECT id,
              time_entry_id AS timeEntryId,
              old_clock_in_date AS oldClockInDate, old_clock_in_time AS oldClockInTime,
              old_clock_out_date AS oldClockOutDate, old_clock_out_time AS oldClockOutTime,
              new_clock_in_date AS newClockInDate, new_clock_in_time AS newClockInTime,
              new_clock_out_date AS newClockOutDate, new_clock_out_time AS newClockOutTime,
              old_total_hours AS oldTotalHours, new_total_hours AS newTotalHours,
              old_decimal_hours AS oldDecimalHours, new_decimal_hours AS newDecimalHours,
              old_day_pay AS oldDayPay, new_day_pay AS newDayPay,
              edit_reason AS editReason, edited_by AS editedBy, edited_at AS editedAt
       FROM admin_edits
       WHERE time_entry_id = ?
       ORDER BY id ASC`,
      [req.params.id]
    );
    res.json(rows);
  })
);

module.exports = router;

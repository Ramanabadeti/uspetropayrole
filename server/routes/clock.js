const express = require("express");
const connectDB = require("../../db");
const logger = require("../logger");
const validate = require("../middleware/validate");
const schemas = require("../lib/schemas");
const employeeRepo = require("../lib/employees");
const payroll = require("../lib/payroll");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAuth, requireSelfOrAdmin } = require("../middleware/auth");
const { MAX_SHIFT_HOURS } = require("../../config");

const router = express.Router();

/**
 * Resolves which employee a clock action is for.
 *
 * An employee can only ever act as themselves; an admin may pass empName to
 * act on someone's behalf (correcting a forgotten punch).
 */
async function resolveTarget(req) {
  const me = req.session.user;
  const requested = req.body?.empName;

  if (!requested || requested.trim().toLowerCase() === me.name.trim().toLowerCase()) {
    const self = await employeeRepo.findById(me.id);
    if (!self) throw new HttpError(404, "Your employee record no longer exists");
    return self;
  }

  if (me.role !== "admin") {
    throw new HttpError(403, "You can only clock in and out for yourself");
  }

  const target = await employeeRepo.findByName(requested);
  if (!target) throw new HttpError(404, `No employee named ${requested}`);
  return target;
}

/**
 * Starts a shift.
 *
 * The clock-in instant is the server's clock, not a timestamp the browser
 * supplied — that was the other half of letting the client decide what it
 * got paid. The pay period is derived from the same instant.
 */
router.post(
  "/clock-in",
  requireAuth,
  validate({ body: schemas.clockIn }),
  asyncHandler(async (req, res) => {
    const employee = await resolveTarget(req);
    const db = await connectDB();

    const now = new Date();
    const clockInFullTime = now.toISOString();
    const inDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const inTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    await db.run(
      `INSERT INTO active_sessions
         (emp_name, employee_id, clock_in_full_time, in_time, in_date, month, year, is_clock_in, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(emp_name) DO UPDATE SET
         employee_id = excluded.employee_id,
         clock_in_full_time = excluded.clock_in_full_time,
         in_time = excluded.in_time,
         in_date = excluded.in_date,
         month = excluded.month,
         year = excluded.year,
         is_clock_in = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [
        employee.name,
        employee.id,
        clockInFullTime,
        inTime,
        inDate,
        String(now.getMonth() + 1),
        String(now.getFullYear()),
      ]
    );

    logger.info({ name: employee.name }, "Clocked in");
    res.json({ status: "clocked in", clockInFullTime, inTime, inDate });
  })
);

router.get(
  "/clock-in/:empName",
  requireAuth,
  requireSelfOrAdmin((req) => req.params.empName),
  asyncHandler(async (req, res) => {
    const db = await connectDB();
    const entry = await db.get(
      `SELECT emp_name AS empName, employee_id AS employeeId,
              clock_in_full_time AS clockInFullTime, in_time AS inTime,
              in_date AS inDate, month, year, is_clock_in AS isClockIn
       FROM active_sessions
       WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?)) AND is_clock_in = 1`,
      [req.params.empName]
    );

    if (!entry) throw new HttpError(404, "Not clocked in");

    entry.isClockIn = !!entry.isClockIn;
    res.json(entry);
  })
);

/**
 * Ends a shift and writes the time entry.
 *
 * This replaces POST /clock-data, which took hours, rate and dollars from the
 * request body and stored them verbatim. Everything is computed here from the
 * stored clock-in, the server's clock, and the employee's own rate.
 */
router.post(
  "/clock-out",
  requireAuth,
  validate({ body: schemas.clockOut }),
  asyncHandler(async (req, res) => {
    const employee = await resolveTarget(req);
    const db = await connectDB();

    const active = await db.get(
      `SELECT * FROM active_sessions WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?)) AND is_clock_in = 1`,
      [employee.name]
    );
    if (!active) throw new HttpError(409, "Not currently clocked in");

    const start = new Date(active.clock_in_full_time);
    if (Number.isNaN(start.getTime())) {
      throw new HttpError(500, "The stored clock-in time is unreadable");
    }

    const end = new Date();
    const hourlyRate = await employeeRepo.rateFor(employee.id);

    const computed = payroll.calculateFromInstants({
      start,
      end,
      hourlyRate,
      maxShiftHours: MAX_SHIFT_HOURS,
    });

    const result = await db.run(
      `INSERT INTO time_entries (
         emp_name, employee_id,
         clock_in_date, clock_in_time, clock_out_date, clock_out_time,
         clock_in_full_time, clock_out_full_time,
         total_hours, decimal_hours, hourly_rate, day_pay,
         month, year, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`,
      [
        employee.name,
        employee.id,
        computed.clockInDate,
        computed.clockInTime,
        computed.clockOutDate,
        computed.clockOutTime,
        computed.clockInFullTime,
        computed.clockOutFullTime,
        computed.totalHours,
        computed.decimalHours,
        computed.hourlyRate,
        computed.dayPay,
        // The pay period is the one the shift *started* in, so a shift that
        // crosses midnight on the 1st does not land in the wrong month.
        String(start.getMonth() + 1),
        String(start.getFullYear()),
      ]
    );

    await db.run("DELETE FROM active_sessions WHERE employee_id = ?", [employee.id]);

    logger.info(
      { name: employee.name, hours: computed.decimalHours, pay: computed.dayPay },
      "Clocked out"
    );

    res.json({ status: "clock data saved", id: result.lastID, entry: computed });
  })
);

router.delete(
  "/clock-in/:empName",
  requireAuth,
  requireSelfOrAdmin((req) => req.params.empName),
  asyncHandler(async (req, res) => {
    const db = await connectDB();
    const result = await db.run(
      "DELETE FROM active_sessions WHERE TRIM(LOWER(emp_name)) = TRIM(LOWER(?))",
      [req.params.empName]
    );
    if (result.changes === 0) throw new HttpError(404, "No active session found");
    res.json({ status: "removed" });
  })
);

module.exports = router;

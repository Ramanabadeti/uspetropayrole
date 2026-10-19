/**
 * Boots the real Express app against a throwaway database.
 *
 * The env has to be set before anything requires config.js, which reads
 * DB_PATH at require time — hence the assignments at module scope, and why
 * every test file requires this helper first.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "punchway-test-"));

process.env.NODE_ENV = "test";
process.env.DB_PATH = path.join(dir, "test.db");
process.env.BACKUP_DIR = path.join(dir, "backups");
process.env.SESSION_SECRET = "test-secret-not-used-anywhere-real";
process.env.LOG_LEVEL = "silent";
process.env.PUNCHWAY_DATA_DIR = path.join(dir, "no-such-punchway-folder");

const migrate = require("../../migrate");
const createApp = require("../../server/app");
const connectDB = require("../../db");
const { closeDB } = require("../../db");
const { hashPassword } = require("../../server/lib/employees");

async function createTestContext() {
  await migrate({ quiet: true, backup: false });

  const db = await connectDB();
  const app = createApp({ serveFrontend: false });

  /** An employee with a usable hashed password. */
  async function addEmployee({
    no = 1,
    name,
    password = "password123",
    role = "employee",
    mailID = "",
    hourlyRate = 15,
    active = 1,
  }) {
    const result = await db.run(
      `INSERT INTO employees (emp_no, name, password_hash, role, mail_id, hourly_rate, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [no, name, await hashPassword(password), role, mailID, hourlyRate, active]
    );
    return { id: result.lastID, name, password, role, hourlyRate };
  }

  /** A completed time entry, bypassing the clock so a pay period can be seeded. */
  async function addTimeEntry({
    employeeId,
    empName,
    clockInDate,
    clockInTime = "09:00:00",
    clockOutDate = clockInDate,
    clockOutTime = "17:00:00",
    hourlyRate = 15,
    decimalHours = 8,
    dayPay = 120,
    month,
    year,
  }) {
    const result = await db.run(
      `INSERT INTO time_entries
         (emp_name, employee_id, clock_in_date, clock_in_time, clock_out_date, clock_out_time,
          total_hours, decimal_hours, hourly_rate, day_pay, month, year, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        empName,
        employeeId,
        clockInDate,
        clockInTime,
        clockOutDate,
        clockOutTime,
        "8:00:00",
        decimalHours,
        hourlyRate,
        dayPay,
        month,
        year,
      ]
    );
    return result.lastID;
  }

  async function cleanup() {
    app.locals.sessionStore?.stopCleanup();
    await closeDB().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { app, db, addEmployee, addTimeEntry, cleanup };
}

/** Logs in over the API and returns the Cookie header to reuse. */
async function signIn(request, app, username, password) {
  const res = await request(app).post("/api/auth/login").send({ username, password }).expect(200);
  return res.headers["set-cookie"];
}

module.exports = { createTestContext, signIn };

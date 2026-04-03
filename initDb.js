const connectDB = require("./db");

async function initDB() {
  const db = await connectDB();

  // 1. Active clock-in sessions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_name TEXT NOT NULL UNIQUE,
      clock_in_full_time TEXT NOT NULL,
      in_time TEXT NOT NULL,
      in_date TEXT NOT NULL,
      month TEXT,
      year TEXT,
      is_clock_in INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Employees table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_no INTEGER,
      name TEXT NOT NULL UNIQUE,
      password TEXT,
      role TEXT NOT NULL DEFAULT 'employee',
      mail_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Time entries table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_name TEXT NOT NULL,
      clock_in_date TEXT,
      clock_in_time TEXT,
      clock_out_date TEXT,
      clock_out_time TEXT,
      clock_in_full_time TEXT,
      clock_out_full_time TEXT,
      total_hours TEXT,
      decimal_hours REAL,
      hourly_rate REAL DEFAULT 0,
      day_pay REAL DEFAULT 0,
      month TEXT,
      year TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
  CREATE TABLE IF NOT EXISTS admin_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time_entry_id INTEGER NOT NULL,
    old_clock_in_date TEXT,
    old_clock_in_time TEXT,
    old_clock_out_date TEXT,
    old_clock_out_time TEXT,
    new_clock_in_date TEXT,
    new_clock_in_time TEXT,
    new_clock_out_date TEXT,
    new_clock_out_time TEXT,
    old_total_hours TEXT,
    new_total_hours TEXT,
    old_decimal_hours REAL,
    new_decimal_hours REAL,
    old_day_pay REAL,
    new_day_pay REAL,
    edit_reason TEXT,
    edited_by TEXT,
    edited_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

  console.log("Database initialized successfully.");
}

module.exports = initDB;
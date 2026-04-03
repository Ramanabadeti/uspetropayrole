const express = require('express');
const cors = require('cors');
const fs = require('fs');
const XLSX = require('xlsx'); 
const path = require('path');
const importEmployeesFromExcel = require('./importEmployees');

const app = express();
const connectDB = require('./db');
const initDB = require('./initDb');

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function calculateWorkData(clockInDate, clockInTime, clockOutDate, clockOutTime, hourlyRate) {
  const start = new Date(`${clockInDate} ${clockInTime}`);
  const end = new Date(`${clockOutDate} ${clockOutTime}`);

  const diffMs = end - start;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || diffMs < 0) {
    throw new Error("Invalid clock-in/clock-out time");
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const decimalHours = Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
  const totalHours = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const dayPay = Number((decimalHours * parseNumber(hourlyRate)).toFixed(2));

  return {
    totalHours,
    decimalHours,
    dayPay,
    clockInFullTime: start.toISOString(),
    clockOutFullTime: end.toISOString(),
  };
}

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'OPTIONS','DELETE'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

app.post('/clock-data', async (req, res) => {
  try {
    const {
      empName,
      clockInDate,
      clockInTime,
      clockOutDate,
      clockOutTime,
      clockInFullTime,
      clockOutFullTime,
      totalHours,
      decimalHours,
      hourlyRate,
      dayPay,
      month,
      year
    } = req.body;

    if (!empName) {
      return res.status(400).json({ error: 'Employee name is required' });
    }

    const db = await connectDB();

    const result = await db.run(
      `
      INSERT INTO time_entries (
        emp_name,
        clock_in_date,
        clock_in_time,
        clock_out_date,
        clock_out_time,
        clock_in_full_time,
        clock_out_full_time,
        total_hours,
        decimal_hours,
        hourly_rate,
        day_pay,
        month,
        year,
        status,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
      `,
      [
        normalizeText(empName),
        normalizeText(clockInDate),
        normalizeText(clockInTime),
        normalizeText(clockOutDate),
        normalizeText(clockOutTime),
        normalizeText(clockInFullTime),
        normalizeText(clockOutFullTime),
        normalizeText(totalHours),
        parseNumber(decimalHours),
        parseNumber(hourlyRate),
        parseNumber(dayPay),
        normalizeText(month),
        normalizeText(year)
      ]
    );

    // Remove active clock-in session after successful save
    await db.run(
      `DELETE FROM active_sessions WHERE emp_name = ?`,
      [normalizeText(empName)]
    );

    res.json({
      status: 'clock data saved',
      id: result.lastID
    });
  } catch (error) {
    console.error('Error saving clock data:', error);
    res.status(500).json({ error: 'Failed to save clock data' });
  }
});

app.get("/api/employees", async (req, res) => {
  try {
    const db = await connectDB();

    const employees = await db.all(`
      SELECT
        emp_no AS no,
        name,
        password,
        role,
        mail_id AS mailID
      FROM employees
      ORDER BY emp_no ASC, name ASC
    `);

    res.json(employees);
  } catch (err) {
    console.error("Error fetching employees from DB:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

function formatExcelTime(value) {
  if (!value || typeof value !== 'number') return value;
  const totalSeconds = Math.round(value * 24 * 60 * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${hour12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
}

app.post('/api/employee-logs', async (req, res) => {
  try {
    const { employeeName, month, year } = req.body;

    if (!employeeName) {
      return res.status(400).json({ error: 'Employee name is required' });
    }

    const db = await connectDB();

    let query = `
      SELECT
        id,
        emp_name AS empName,
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
      FROM time_entries
      WHERE emp_name = ?
    `;

    const params = [normalizeText(employeeName)];

    if (month) {
      query += ` AND month = ?`;
      params.push(normalizeText(month));
    }

    if (year) {
      query += ` AND year = ?`;
      params.push(normalizeText(year));
    }

    query += ` ORDER BY id DESC`;

    const logs = await db.all(query, params);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching employee logs:', error);
    res.status(500).json({ error: 'Failed to fetch employee logs' });
  }
});

app.get('/api/time-entries', async (req, res) => {
  try {
    const { month, year, employeeName } = req.query;
    const db = await connectDB();

    let query = `
      SELECT
        id,
        emp_name AS empName,
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
      FROM time_entries
      WHERE 1 = 1
    `;

    const params = [];

    if (employeeName) {
      query += ` AND emp_name = ?`;
      params.push(normalizeText(employeeName));
    }

    if (month) {
      query += ` AND month = ?`;
      params.push(normalizeText(month));
    }

    if (year) {
      query += ` AND year = ?`;
      params.push(normalizeText(year));
    }

    query += ` ORDER BY id DESC`;

    const rows = await db.all(query, params);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});


app.put('/api/time-entry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clockInDate,
      clockInTime,
      clockOutDate,
      clockOutTime,
      hourlyRate,
      editReason,
      editedBy
    } = req.body;

    const db = await connectDB();

    const existingEntry = await db.get(
      `SELECT * FROM time_entries WHERE id = ?`,
      [id]
    );

    if (!existingEntry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    const newClockInDate = normalizeText(clockInDate || existingEntry.clock_in_date);
    const newClockInTime = normalizeText(clockInTime || existingEntry.clock_in_time);
    const newClockOutDate = normalizeText(clockOutDate || existingEntry.clock_out_date);
    const newClockOutTime = normalizeText(clockOutTime || existingEntry.clock_out_time);
    const newHourlyRate = parseNumber(
      hourlyRate !== undefined ? hourlyRate : existingEntry.hourly_rate
    );

    const recalculated = calculateWorkData(
      newClockInDate,
      newClockInTime,
      newClockOutDate,
      newClockOutTime,
      newHourlyRate
    );

    await db.run(
      `
      UPDATE time_entries
      SET
        clock_in_date = ?,
        clock_in_time = ?,
        clock_out_date = ?,
        clock_out_time = ?,
        clock_in_full_time = ?,
        clock_out_full_time = ?,
        total_hours = ?,
        decimal_hours = ?,
        hourly_rate = ?,
        day_pay = ?,
        status = 'corrected',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        newClockInDate,
        newClockInTime,
        newClockOutDate,
        newClockOutTime,
        recalculated.clockInFullTime,
        recalculated.clockOutFullTime,
        recalculated.totalHours,
        recalculated.decimalHours,
        newHourlyRate,
        recalculated.dayPay,
        id
      ]
    );

    await db.run(
      `
      INSERT INTO admin_edits (
        time_entry_id,
        old_clock_in_date,
        old_clock_in_time,
        old_clock_out_date,
        old_clock_out_time,
        new_clock_in_date,
        new_clock_in_time,
        new_clock_out_date,
        new_clock_out_time,
        old_total_hours,
        new_total_hours,
        old_decimal_hours,
        new_decimal_hours,
        old_day_pay,
        new_day_pay,
        edit_reason,
        edited_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        existingEntry.id,
        existingEntry.clock_in_date,
        existingEntry.clock_in_time,
        existingEntry.clock_out_date,
        existingEntry.clock_out_time,
        newClockInDate,
        newClockInTime,
        newClockOutDate,
        newClockOutTime,
        existingEntry.total_hours,
        recalculated.totalHours,
        existingEntry.decimal_hours,
        recalculated.decimalHours,
        existingEntry.day_pay,
        recalculated.dayPay,
        normalizeText(editReason),
        normalizeText(editedBy || 'admin')
      ]
    );

    const updatedEntry = await db.get(
      `
      SELECT
        id,
        emp_name AS empName,
        clock_in_date AS clockInDate,
        clock_in_time AS clockInTime,
        clock_out_date AS clockOutDate,
        clock_out_time AS clockOutTime,
        total_hours AS totalHours,
        decimal_hours AS decimalHours,
        hourly_rate AS hourlyRate,
        day_pay AS dayPay,
        status,
        updated_at AS updatedAt
      FROM time_entries
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      message: 'Time entry updated successfully',
      entry: updatedEntry
    });
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: error.message || 'Failed to update time entry' });
  }
});

app.get('/api/employee-list', async (req, res) => {
  try {
    const db = await connectDB();

    const employees = await db.all(`
      SELECT
        emp_no AS no,
        name,
        password,
        role,
        mail_id AS mailID
      FROM employees
      ORDER BY emp_no ASC, name ASC
    `);

    res.json(employees);
  } catch (err) {
    console.error("Failed to fetch employee list from DB:", err);
    res.status(500).json({ error: "Error reading employee list" });
  }
});

// CLOCK-IN STORAGE USING SQLITE
app.post('/clock-in', async (req, res) => {
  try {
    const { empName, clockInFullTime, inTime, inDate, month, year } = req.body;

    if (!empName || !clockInFullTime || !inTime || !inDate) {
      return res.status(400).json({ error: 'Missing required clock-in fields' });
    }

    const db = await connectDB();

    // INSERT OR REPLACE behavior:
    // if employee already has an active row, replace it with latest clock-in.
    await db.run(
      `
      INSERT INTO active_sessions (
        emp_name,
        clock_in_full_time,
        in_time,
        in_date,
        month,
        year,
        is_clock_in,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(emp_name) DO UPDATE SET
        clock_in_full_time = excluded.clock_in_full_time,
        in_time = excluded.in_time,
        in_date = excluded.in_date,
        month = excluded.month,
        year = excluded.year,
        is_clock_in = 1,
        updated_at = CURRENT_TIMESTAMP
      `,
      [empName, clockInFullTime, inTime, inDate, month, year]
    );

    res.json({ status: 'clocked in' });
  } catch (error) {
    console.error('Clock-in error:', error);
    res.status(500).json({ error: 'Failed to save clock-in' });
  }
});

app.get('/clock-in/:empName', async (req, res) => {
  try {
    const db = await connectDB();

    const entry = await db.get(
      `
      SELECT
        emp_name AS empName,
        clock_in_full_time AS clockInFullTime,
        in_time AS inTime,
        in_date AS inDate,
        month,
        year,
        is_clock_in AS isClockIn
      FROM active_sessions
      WHERE emp_name = ? AND is_clock_in = 1
      `,
      [req.params.empName]
    );

    if (!entry) {
      return res.status(404).json({ error: 'Not clocked in' });
    }

    // convert 1/0 into true/false for frontend compatibility
    entry.isClockIn = !!entry.isClockIn;

    res.json(entry);
  } catch (error) {
    console.error('Fetch clock-in error:', error);
    res.status(500).json({ error: 'Failed to fetch clock-in data' });
  }
});

app.delete('/clock-in/:empName', async (req, res) => {
  try {
    const db = await connectDB();

    const result = await db.run(
      `DELETE FROM active_sessions WHERE emp_name = ?`,
      [req.params.empName]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'No active session found' });
    }

    res.json({ status: 'removed' });
  } catch (error) {
    console.error('Delete clock-in error:', error);
    res.status(500).json({ error: 'Failed to remove clock-in' });
  }
});

app.post("/api/save-admin-note", (req, res) => {
  const { filePath, empName, sheetName, noteDate, note, amountPaid, amountPending } = req.body;

  try {
    // Load workbook and worksheet
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    const rowIndex = data.findIndex(row => row.noteDate === noteDate);

    if (rowIndex !== -1) {
      // Update existing row
      data[rowIndex].employeeName = empName;
      data[rowIndex].note = note;
      data[rowIndex].amountPaid = amountPaid;
      data[rowIndex].amountPending = amountPending;
    } else {
      // Append new row with note-related info only (fallback)
      data.push({
        employeeName: empName,
        noteDate: noteDate,
        note,
        amountPaid,
        amountPending
      });
    }

    // ✅ Define a consistent column order if needed
    const headers = Object.keys(data[0]);

    // ✅ Rewrite updated sheet
    const newWorksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    workbook.Sheets[sheetName] = newWorksheet;

    // Save Excel file
    XLSX.writeFile(workbook, filePath);

    res.status(200).json({ message: "Note saved successfully" });
  } catch (error) {
    console.error("Error saving note to Excel:", error);
    res.status(500).json({ error: "Failed to save note" });
  }
});

app.post('/api/admin-note-list', (req, res) => {
  const { fileNameFormat } = req.body;

  if (!fs.existsSync(fileNameFormat)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    const workbook = XLSX.readFile(fileNameFormat);
    const sheet = workbook.Sheets["NotesSheet"];
    if (!sheet) {
      return res.status(400).json({ error: "Sheet 'NotesSheet' not found" });
    }

    const data = XLSX.utils.sheet_to_json(sheet); 
    res.json(data);
  } catch (err) {
    console.error("Failed to read Excel file:", err);
    res.status(500).json({ error: "Error reading NotesSheet" });
  }
});

app.get("/api/emails", (req, res) => {
  const filePath = "/Users/ramanabadeti/Desktop/PROJECTS/PunchWay/blank pay sheet.xlsx";

  if (!fs.existsSync(filePath)) {
    console.error("File not found at:", filePath);
    return res.status(404).json({ error: "Employee details file not found" });
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets["EmployeeDetails"];

    if (!sheet) {
      console.error("Sheet 'EmployeeDetails' not found in:", filePath);
      return res.status(400).json({ error: "Sheet 'EmployeeDetails' not found" });
    }

    const data = XLSX.utils.sheet_to_json(sheet);

    // Ensure it's an array
    if (!Array.isArray(data)) {
      console.error("Parsed data is not an array:", data);
      return res.status(500).json({ error: "Data format error in sheet" });
    }

    const cleanedData = data.map(row => ({
      name: row.name || "",
      role: row.role || "",
      mailID: row.mailID || ""
    }));

    res.status(200).json(cleanedData);
  } catch (err) {
    console.error("Error processing Excel file:", err);
    res.status(500).json({ error: "Failed to parse Excel file" });
  }
});

initDB()
  .then(async () => {
    await importEmployeesFromExcel();

    app.listen(5050, () => {
      console.log('Server running on http://localhost:5050');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
  });
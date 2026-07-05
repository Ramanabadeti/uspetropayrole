require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const connectDB = require("./db");
const initDB = require("./initDb");
const importEmployeesFromExcel = require("./importEmployees");
const { DATA_DIR } = require("./config");

// One-time importer: reads the legacy "PunchWay" Excel folder (paysheets +
// blank pay sheet) and loads everything into the SQLite database, so a fresh
// install never loses history that used to live only in Excel.
//
// Safe to re-run: every insert is deduplicated against what's already in the
// database, so running this twice (or against a DATA_DIR with overlapping
// files) will not create duplicate rows.

const VALID_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

function getCell(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function parseMonthYearFromFilename(filename) {
  const match = filename.match(/(\d{1,2})-(\d{4})\s+paysheet\.xlsx$/i);
  if (!match) return { month: "", year: "" };
  return { month: String(match[1]), year: String(match[2]) };
}

function buildIsoIfPossible(dateValue, timeValue) {
  const dateText = normalizeText(dateValue);
  const timeText = normalizeText(timeValue);
  if (!dateText || !timeText) return "";
  const combined = new Date(`${dateText} ${timeText}`);
  return Number.isNaN(combined.getTime()) ? "" : combined.toISOString();
}

async function timeEntryExists(db, entry) {
  const existing = await db.get(
    `
    SELECT id FROM time_entries
    WHERE emp_name = ? AND clock_in_date = ? AND clock_in_time = ?
      AND clock_out_date = ? AND clock_out_time = ?
    `,
    [entry.emp_name, entry.clock_in_date, entry.clock_in_time, entry.clock_out_date, entry.clock_out_time]
  );
  return !!existing;
}

async function noteExists(db, note) {
  const existing = await db.get(
    `
    SELECT id FROM admin_notes
    WHERE emp_name = ? AND note_date = ? AND note = ? AND amount_paid = ?
    `,
    [note.emp_name, note.note_date, note.note, note.amount_paid]
  );
  return !!existing;
}

async function importTimeEntries(db, paysheetFiles) {
  let imported = 0;
  let skipped = 0;

  for (const file of paysheetFiles) {
    const filePath = path.join(DATA_DIR, file);
    const workbook = XLSX.readFile(filePath);
    const { month, year } = parseMonthYearFromFilename(file);

    for (const sheetName of workbook.SheetNames) {
      if (sheetName === "EmployeeDetails" || sheetName === "NotesSheet") continue;

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

      for (const row of rows) {
        const clockInDate = normalizeText(getCell(row, ["clockInDate", "ClockInDate", "date", "Date"]));

        // Excel table formatting sometimes leaves a phantom all-zero row —
        // a real entry always has a date like "3/1/2026".
        if (!VALID_DATE_RE.test(clockInDate)) {
          skipped++;
          continue;
        }

        const clockInTime = normalizeText(getCell(row, ["clockInTime", "ClockInTime", "in", "In"]));
        const clockOutDate =
          normalizeText(getCell(row, ["clockOutDate", "ClockOutDate", "outDate", "OutDate"])) || clockInDate;
        const clockOutTime = normalizeText(getCell(row, ["clockOutTime", "ClockOutTime", "out", "Out"]));
        const totalHours = normalizeText(
          getCell(row, ["totalHours", "TotalHours", "workingHours", "WorkingHours"])
        );
        const decimalHoursRaw = getCell(row, ["decimalHours", "hoursInDecimal", "HoursInDecimal", "decimal_hours"]);
        const dayPayRaw = getCell(row, ["dayPay", "DayPay", "payPerDay", "PayPerDay"]);

        // The sheet tab is one employee's log, so it's the reliable source
        // of truth for whose entry this is (a per-row name cell can be blank).
        const employeeName = normalizeText(sheetName);

        if (!employeeName || !clockInTime || !clockOutTime) {
          skipped++;
          continue;
        }

        const entry = {
          emp_name: employeeName,
          clock_in_date: clockInDate,
          clock_in_time: clockInTime,
          clock_out_date: clockOutDate,
          clock_out_time: clockOutTime,
          clock_in_full_time: buildIsoIfPossible(clockInDate, clockInTime),
          clock_out_full_time: buildIsoIfPossible(clockOutDate, clockOutTime),
          total_hours: totalHours,
          decimal_hours: parseNumber(decimalHoursRaw),
          hourly_rate: 0,
          day_pay: parseNumber(dayPayRaw),
          month,
          year,
          status: "imported",
        };

        if (await timeEntryExists(db, entry)) {
          skipped++;
          continue;
        }

        await db.run(
          `
          INSERT INTO time_entries (
            emp_name, clock_in_date, clock_in_time, clock_out_date, clock_out_time,
            clock_in_full_time, clock_out_full_time, total_hours, decimal_hours,
            hourly_rate, day_pay, month, year, status, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          [
            entry.emp_name, entry.clock_in_date, entry.clock_in_time, entry.clock_out_date, entry.clock_out_time,
            entry.clock_in_full_time, entry.clock_out_full_time, entry.total_hours, entry.decimal_hours,
            entry.hourly_rate, entry.day_pay, entry.month, entry.year, entry.status,
          ]
        );
        imported++;
      }
    }
  }

  return { imported, skipped };
}

async function importNotes(db, paysheetFiles) {
  let imported = 0;
  let skipped = 0;

  for (const file of paysheetFiles) {
    const filePath = path.join(DATA_DIR, file);
    const workbook = XLSX.readFile(filePath);
    const { month, year } = parseMonthYearFromFilename(file);

    const sheet = workbook.Sheets["NotesSheet"];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    for (const row of rows) {
      const empName = normalizeText(getCell(row, ["employeeName", "empName", "name"]));
      const noteDate = normalizeText(getCell(row, ["noteDate", "date"]));

      if (!empName || !noteDate) {
        skipped++;
        continue;
      }

      const note = {
        emp_name: empName,
        note_date: noteDate,
        note: normalizeText(row.note),
        amount_paid: parseNumber(row.amountPaid),
        amount_pending: parseNumber(row.amountPending),
        month,
        year,
      };

      if (await noteExists(db, note)) {
        skipped++;
        continue;
      }

      await db.run(
        `
        INSERT INTO admin_notes (emp_name, note_date, note, amount_paid, amount_pending, month, year)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [note.emp_name, note.note_date, note.note, note.amount_paid, note.amount_pending, note.month, note.year]
      );
      imported++;
    }
  }

  return { imported, skipped };
}

async function migrateLegacyData() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Legacy data folder not found: ${DATA_DIR}`);
    console.error(`Set PUNCHWAY_DATA_DIR in .env to the correct folder and try again.`);
    process.exit(1);
  }

  console.log(`Reading legacy data from: ${DATA_DIR}`);

  await initDB();
  await importEmployeesFromExcel();

  const db = await connectDB();
  const paysheetFiles = fs.readdirSync(DATA_DIR).filter((f) => /paysheet\.xlsx$/i.test(f));
  console.log(`Found ${paysheetFiles.length} paysheet file(s).`);

  const entryResult = await importTimeEntries(db, paysheetFiles);
  console.log(`Time entries — imported: ${entryResult.imported}, skipped: ${entryResult.skipped}`);

  const noteResult = await importNotes(db, paysheetFiles);
  console.log(`Admin notes — imported: ${noteResult.imported}, skipped: ${noteResult.skipped}`);

  console.log("Legacy data migration complete.");
}

migrateLegacyData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Legacy migration failed:", error);
    process.exit(1);
  });

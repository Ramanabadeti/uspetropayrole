const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const connectDB = require("./db");

const BASE_DIR = "/Users/ramanabadeti/Desktop/PROJECTS/PunchWay";

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
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
  return {
    month: String(match[1]),
    year: String(match[2]),
  };
}

function buildIsoIfPossible(dateValue, timeValue) {
  const dateText = normalizeText(dateValue);
  const timeText = normalizeText(timeValue);

  if (!dateText || !timeText) return "";

  const combined = new Date(`${dateText} ${timeText}`);
  if (Number.isNaN(combined.getTime())) return "";

  return combined.toISOString();
}

async function rowAlreadyExists(db, entry) {
  const existing = await db.get(
    `
    SELECT id
    FROM time_entries
    WHERE emp_name = ?
      AND clock_in_date = ?
      AND clock_in_time = ?
      AND clock_out_date = ?
      AND clock_out_time = ?
    `,
    [
      entry.emp_name,
      entry.clock_in_date,
      entry.clock_in_time,
      entry.clock_out_date,
      entry.clock_out_time,
    ]
  );

  return !!existing;
}

async function importHistoricalEntries() {
  const db = await connectDB();

  const allFiles = fs.readdirSync(BASE_DIR);
  const paysheetFiles = allFiles.filter((file) =>
    /paysheet\.xlsx$/i.test(file)
  );

  let importedCount = 0;
  let skippedCount = 0;

  for (const file of paysheetFiles) {
    const filePath = path.join(BASE_DIR, file);
    const workbook = XLSX.readFile(filePath);
    const { month, year } = parseMonthYearFromFilename(file);

    for (const sheetName of workbook.SheetNames) {
      // skip non-attendance sheets
      if (
        sheetName === "EmployeeDetails" ||
        sheetName === "NotesSheet"
      ) {
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      for (const row of rows) {
        const clockInDate = normalizeText(
          getCell(row, ["clockInDate", "ClockInDate", "date", "Date"])
        );

        const clockInTime = normalizeText(
          getCell(row, ["clockInTime", "ClockInTime", "in", "In"])
        );

        const clockOutDate = normalizeText(
          getCell(row, ["clockOutDate", "ClockOutDate", "outDate", "OutDate"])
        ) || clockInDate;

        const clockOutTime = normalizeText(
          getCell(row, ["clockOutTime", "ClockOutTime", "out", "Out"])
        );

        const totalHours = normalizeText(
          getCell(row, ["totalHours", "TotalHours", "workingHours", "WorkingHours"])
        );

        const decimalHoursRaw = getCell(row, [
          "decimalHours",
          "hoursInDecimal",
          "HoursInDecimal",
          "decimal_hours",
        ]);

        const dayPayRaw = getCell(row, [
          "dayPay",
          "DayPay",
          "payPerDay",
          "PayPerDay",
        ]);

        const employeeName =
          normalizeText(getCell(row, ["name", "Name", "employeeName", "EmployeeName"])) ||
          normalizeText(sheetName);

        // skip blank rows
        if (!employeeName || !clockInDate || !clockInTime || !clockOutTime) {
          skippedCount++;
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

        const exists = await rowAlreadyExists(db, entry);
        if (exists) {
          skippedCount++;
          continue;
        }

        await db.run(
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
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          [
            entry.emp_name,
            entry.clock_in_date,
            entry.clock_in_time,
            entry.clock_out_date,
            entry.clock_out_time,
            entry.clock_in_full_time,
            entry.clock_out_full_time,
            entry.total_hours,
            entry.decimal_hours,
            entry.hourly_rate,
            entry.day_pay,
            entry.month,
            entry.year,
            entry.status,
          ]
        );

        importedCount++;
      }
    }
  }

  console.log(`Imported ${importedCount} historical entries.`);
  console.log(`Skipped ${skippedCount} rows.`);
}

importHistoricalEntries()
  .then(() => {
    console.log("Historical Excel migration completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Historical migration failed:", error);
    process.exit(1);
  });
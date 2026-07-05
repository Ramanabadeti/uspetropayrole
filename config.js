const path = require("path");
const os = require("os");

// Defaults to the same "PunchWay" folder on the Desktop that this app has
// always used on Mac. Override with PUNCHWAY_DATA_DIR in .env on any machine
// (including Windows) where the folder lives somewhere else.
const DATA_DIR =
  process.env.PUNCHWAY_DATA_DIR || path.join(os.homedir(), "Desktop", "PunchWay");
const EMPLOYEE_SHEET_PATH =
  process.env.EMPLOYEE_SHEET_PATH || path.join(DATA_DIR, "blank pay sheet.xlsx");

module.exports = { DATA_DIR, EMPLOYEE_SHEET_PATH };

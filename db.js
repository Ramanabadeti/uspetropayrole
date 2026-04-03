const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

// This function opens a connection to the SQLite database file.
// If the file does not exist, SQLite creates it automatically.
async function connectDB() {
  return open({
    filename: path.join(__dirname, "payroll.db"),
    driver: sqlite3.Database,
  });
}

module.exports = connectDB;
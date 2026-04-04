const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function connectDB() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, "payroll.db");

  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

module.exports = connectDB;
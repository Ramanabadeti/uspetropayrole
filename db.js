const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { DB_PATH } = require("./config");

let connection = null;

// One connection for the process. SQLite serialises writes itself, and
// reopening the file per request (what the old code did) meant every request
// paid the open cost and lost the PRAGMA settings below.
async function connectDB() {
  if (connection) return connection;

  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  // Foreign keys are off by default in SQLite, which is why the employee_id
  // columns added in migration 003 would otherwise not be enforced at all.
  await db.exec("PRAGMA foreign_keys = ON");
  // WAL keeps a reader (the admin screens) from blocking a writer (someone
  // clocking out) and survives an abrupt shutdown better than the default.
  await db.exec("PRAGMA journal_mode = WAL");
  await db.exec("PRAGMA busy_timeout = 5000");

  connection = db;
  return connection;
}

async function closeDB() {
  if (!connection) return;
  const db = connection;
  connection = null;
  await db.close();
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.closeDB = closeDB;

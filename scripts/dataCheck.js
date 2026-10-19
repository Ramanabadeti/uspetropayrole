#!/usr/bin/env node
/**
 * Prints a count of everything in the database, for running either side of an
 * upgrade.
 *
 * The migrations are additive — no INSERT, no DELETE — so every one of these
 * numbers must be identical before and after. A number that grew means
 * something imported twice; a number that shrank means something was lost.
 * Either way the answer is to stop and restore the backup.
 *
 * Also reports rows that migration 003 could not link to an employee: it
 * backfills employee_id by matching emp_name, so a name that was spelled
 * differently leaves the row unlinked rather than losing it.
 */
const connectDB = require("../db");
const { DB_PATH } = require("../config");

const TABLES = [
  "employees",
  "time_entries",
  "admin_notes",
  "admin_edits",
  "active_sessions",
];

async function tableExists(db, name) {
  const row = await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name]
  );
  return Boolean(row);
}

async function dataCheck() {
  const db = await connectDB();
  console.log(`Database: ${DB_PATH}`);
  console.log(`Checked:  ${new Date().toLocaleString()}`);
  console.log("");

  for (const table of TABLES) {
    if (!(await tableExists(db, table))) {
      // admin_edits and the rest only exist after 001, so before the first
      // migration some of these are legitimately absent.
      console.log(`${table.padEnd(18)} (table not present yet)`);
      continue;
    }
    const { n } = await db.get(`SELECT COUNT(*) AS n FROM ${table}`);
    console.log(`${table.padEnd(18)} ${n}`);
  }

  console.log("");

  for (const table of ["time_entries", "admin_notes"]) {
    if (!(await tableExists(db, table))) continue;
    const columns = await db.all(`PRAGMA table_info(${table})`);
    if (!columns.some((c) => c.name === "employee_id")) {
      console.log(`${table}: employee_id not added yet (migration 003 pending)`);
      continue;
    }
    const { n } = await db.get(
      `SELECT COUNT(*) AS n FROM ${table} WHERE employee_id IS NULL`
    );
    console.log(
      n === 0
        ? `${table}: every row linked to an employee`
        : `${table}: ${n} row(s) NOT linked to an employee — check the names`
    );
  }

  await db.close();
}

if (require.main === module) {
  dataCheck()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = dataCheck;

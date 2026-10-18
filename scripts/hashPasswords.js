#!/usr/bin/env node
/**
 * One-time: turn the plaintext `employees.password` column into bcrypt
 * hashes in `password_hash`, then clear the plaintext.
 *
 * Everyone keeps logging in with the password they already use — nothing is
 * reset. Safe to re-run: rows that already have a hash are skipped.
 */
require("dotenv").config({ quiet: true });

const connectDB = require("../db");
const backupDb = require("./backupDb");
const { hashPassword } = require("../server/lib/employees");

async function hashPasswords() {
  backupDb();

  const db = await connectDB();
  const rows = await db.all(
    "SELECT id, name, password FROM employees WHERE password_hash IS NULL AND password IS NOT NULL AND TRIM(password) <> ''"
  );

  if (rows.length === 0) {
    console.log("Nothing to do — every employee already has a hashed password.");
    const leftover = await db.get(
      "SELECT COUNT(*) AS n FROM employees WHERE password IS NOT NULL AND TRIM(password) <> ''"
    );
    if (leftover.n > 0) {
      console.log(`Clearing ${leftover.n} leftover plaintext password(s).`);
      await db.run("UPDATE employees SET password = NULL WHERE password_hash IS NOT NULL");
    }
    return 0;
  }

  for (const row of rows) {
    await db.run(
      "UPDATE employees SET password_hash = ?, password = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [await hashPassword(row.password), row.id]
    );
    console.log(`Hashed password for ${row.name}`);
  }

  console.log(`\nDone — ${rows.length} password(s) hashed, plaintext cleared.`);
  return rows.length;
}

if (require.main === module) {
  hashPasswords()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = hashPasswords;

#!/usr/bin/env node
/**
 * Applies any migration in ./migrations that has not run yet, in filename
 * order, each inside a transaction, recording it in schema_migrations.
 *
 * Replaces the old initDb.js, which could only ever create tables that did
 * not exist — any change to an existing table had to be typed into sqlite3 by
 * hand on every machine.
 */
const fs = require("fs");
const path = require("path");
const connectDB = require("./db");
const backupDb = require("./scripts/backupDb");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function migrate({ quiet = false, backup = true } = {}) {
  const log = quiet ? () => {} : (...args) => console.log(...args);

  const db = await connectDB();
  await ensureMigrationsTable(db);

  const applied = new Set(
    (await db.all("SELECT name FROM schema_migrations")).map((r) => r.name)
  );
  const pending = listMigrationFiles().filter((f) => !applied.has(f));

  if (pending.length === 0) {
    log("Database is up to date.");
    return [];
  }

  if (backup) backupDb({ quiet });

  for (const name of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");

    // Foreign keys cannot be toggled inside a transaction, and ALTER TABLE
    // ADD COLUMN ... REFERENCES needs them off while the column is added.
    await db.exec("PRAGMA foreign_keys = OFF");
    await db.exec("BEGIN");
    try {
      await db.exec(sql);
      await db.run("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
      await db.exec("COMMIT");
      log(`Applied ${name}`);
    } catch (err) {
      await db.exec("ROLLBACK");
      throw new Error(`Migration ${name} failed: ${err.message}`);
    } finally {
      await db.exec("PRAGMA foreign_keys = ON");
    }
  }

  return pending;
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = migrate;

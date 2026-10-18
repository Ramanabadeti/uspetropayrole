#!/usr/bin/env node
/**
 * Timestamped copy of the live database into ./backups.
 *
 * Runs automatically before `npm run migrate` so no schema change can be the
 * first thing that touches real payroll data. Safe to run by hand any time.
 */
const fs = require("fs");
const path = require("path");
const { DB_PATH, BACKUP_DIR } = require("../config");

function backupDb({ quiet = false } = {}) {
  if (!fs.existsSync(DB_PATH)) {
    if (!quiet) console.log(`No database at ${DB_PATH} yet — nothing to back up.`);
    return null;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(BACKUP_DIR, `${path.basename(DB_PATH)}.${stamp}.bak`);

  fs.copyFileSync(DB_PATH, target);

  // WAL mode means recent commits can still be sitting in the -wal file, so a
  // copy of the .db alone is not necessarily complete.
  for (const suffix of ["-wal", "-shm"]) {
    if (fs.existsSync(DB_PATH + suffix)) {
      fs.copyFileSync(DB_PATH + suffix, target + suffix);
    }
  }

  if (!quiet) console.log(`Backed up ${DB_PATH} -> ${target}`);
  return target;
}

if (require.main === module) {
  backupDb();
}

module.exports = backupDb;

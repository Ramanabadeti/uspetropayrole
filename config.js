const path = require("path");
const os = require("os");
const crypto = require("crypto");
const fs = require("fs");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const PORT = Number(process.env.PORT || 5050);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "payroll.db");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");

// Defaults to the same "PunchWay" folder on the Desktop that this app has
// always used on Mac. Override with PUNCHWAY_DATA_DIR in .env on any machine
// (including Windows) where the folder lives somewhere else.
const DATA_DIR =
  process.env.PUNCHWAY_DATA_DIR || path.join(os.homedir(), "Desktop", "PunchWay");
const EMPLOYEE_SHEET_PATH =
  process.env.EMPLOYEE_SHEET_PATH || path.join(DATA_DIR, "blank pay sheet.xlsx");

const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug");

// How long a login lasts, and how long an employee may stay clocked in before
// the shift is treated as a mistake rather than a 30-hour day.
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000);
const MAX_SHIFT_HOURS = Number(process.env.MAX_SHIFT_HOURS || 24);

// Origins allowed to call the API with credentials. In production the app
// serves its own frontend from the same origin, so this only matters for the
// Vite dev server.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// A stable secret is required to keep people logged in across restarts. In
// development we generate one and stash it next to the database so restarting
// `npm run dev` does not log everyone out. In production a missing secret is
// a hard error — a random one per boot would invalidate every session on
// every restart, and silently.
function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  if (IS_PRODUCTION) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
        "and put it in .env before starting in production."
    );
  }

  const devSecretPath = path.join(path.dirname(DB_PATH), ".session-secret.dev");
  try {
    if (fs.existsSync(devSecretPath)) return fs.readFileSync(devSecretPath, "utf8").trim();
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(devSecretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString("hex");
  }
}

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  PORT,
  DB_PATH,
  BACKUP_DIR,
  DATA_DIR,
  EMPLOYEE_SHEET_PATH,
  LOG_LEVEL,
  SESSION_TTL_MS,
  MAX_SHIFT_HOURS,
  CORS_ORIGINS,
  get SESSION_SECRET() {
    return resolveSessionSecret();
  },
};

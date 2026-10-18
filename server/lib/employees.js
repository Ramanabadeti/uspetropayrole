const bcrypt = require("bcryptjs");
const connectDB = require("../../db");

const BCRYPT_ROUNDS = 10;

/** Columns safe to send to a browser. Deliberately excludes both password columns. */
const PUBLIC_COLUMNS = `
  id,
  emp_no AS no,
  name,
  role,
  mail_id AS mailID,
  hourly_rate AS hourlyRate,
  active
`;

function hashPassword(plaintext) {
  return bcrypt.hash(String(plaintext), BCRYPT_ROUNDS);
}

async function findByName(name) {
  const db = await connectDB();
  return db.get(
    `SELECT id, emp_no AS no, name, role, mail_id AS mailID, hourly_rate AS hourlyRate,
            active, password, password_hash AS passwordHash
     FROM employees
     WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))`,
    [String(name)]
  );
}

async function findById(id) {
  const db = await connectDB();
  return db.get(`SELECT ${PUBLIC_COLUMNS} FROM employees WHERE id = ?`, [id]);
}

async function listPublic({ includeInactive = false } = {}) {
  const db = await connectDB();
  return db.all(
    `SELECT ${PUBLIC_COLUMNS} FROM employees
     ${includeInactive ? "" : "WHERE active = 1"}
     ORDER BY emp_no ASC, name ASC`
  );
}

/**
 * Checks a password against an employee row.
 *
 * Accepts the legacy plaintext column as a fallback and upgrades the row to a
 * hash on the spot, so nobody is locked out if `npm run hash-passwords` has
 * not been run yet on a given machine. Once upgraded the plaintext is cleared.
 */
async function verifyPassword(employee, candidate) {
  if (!employee) return false;

  if (employee.passwordHash) {
    return bcrypt.compare(String(candidate), employee.passwordHash);
  }

  if (employee.password && String(employee.password) === String(candidate)) {
    const db = await connectDB();
    await db.run(
      "UPDATE employees SET password_hash = ?, password = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [await hashPassword(candidate), employee.id]
    );
    return true;
  }

  return false;
}

/** The rate the server uses for a shift — never a number the client sent. */
async function rateFor(employeeId) {
  const db = await connectDB();
  const row = await db.get("SELECT hourly_rate AS hourlyRate FROM employees WHERE id = ?", [
    employeeId,
  ]);
  return Number(row?.hourlyRate || 0);
}

module.exports = {
  BCRYPT_ROUNDS,
  PUBLIC_COLUMNS,
  findById,
  findByName,
  hashPassword,
  listPublic,
  rateFor,
  verifyPassword,
};

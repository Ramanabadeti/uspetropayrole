const express = require("express");
const rateLimit = require("express-rate-limit");
const connectDB = require("../../db");
const logger = require("../logger");
const validate = require("../middleware/validate");
const schemas = require("../lib/schemas");
const employees = require("../lib/employees");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAuth, currentUser } = require("../middleware/auth");

const router = express.Router();

// Password guessing against five short passwords is otherwise trivial.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Wait a few minutes and try again." },
});

function publicUser(employee) {
  return {
    id: employee.id,
    no: employee.no,
    name: employee.name,
    role: employee.role,
    mailID: employee.mailID,
    hourlyRate: employee.hourlyRate,
  };
}

router.post(
  "/login",
  loginLimiter,
  validate({ body: schemas.login }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const employee = await employees.findByName(username);

    const ok = await employees.verifyPassword(employee, password);

    // One message for both "no such user" and "wrong password", so the form
    // cannot be used to enumerate who works here.
    if (!employee || !ok) {
      logger.warn({ username }, "Failed sign-in");
      throw new HttpError(401, "Invalid username or password");
    }

    if (!employee.active) {
      throw new HttpError(403, "This account has been deactivated");
    }

    // A fresh session id on login, so a session fixated before sign-in cannot
    // be reused afterwards.
    await new Promise((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );

    req.session.user = publicUser(employee);

    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    logger.info({ name: employee.name, role: employee.role }, "Signed in");
    res.json({ user: req.session.user });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (!req.session) return res.json({ ok: true });
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie("punchway.sid");
    res.json({ ok: true });
  })
);

/** The frontend calls this on load to find out who, if anyone, is signed in. */
router.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "You are not signed in" });
  res.json({ user });
});

router.post(
  "/change-password",
  requireAuth,
  validate({ body: schemas.changePassword }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const me = currentUser(req);

    const employee = await employees.findByName(me.name);
    if (!(await employees.verifyPassword(employee, currentPassword))) {
      throw new HttpError(401, "Current password is incorrect");
    }

    const db = await connectDB();
    await db.run(
      "UPDATE employees SET password_hash = ?, password = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [await employees.hashPassword(newPassword), employee.id]
    );

    logger.info({ name: employee.name }, "Password changed");
    res.json({ ok: true });
  })
);

module.exports = router;

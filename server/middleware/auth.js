const { HttpError } = require("./errors");

/**
 * Route guards.
 *
 * Until now there were none: every endpoint was open, and "who is logged in"
 * was a localStorage entry the browser wrote for itself after comparing
 * passwords it had downloaded. req.session.user is set by POST
 * /api/auth/login and is the only thing these trust.
 */

function currentUser(req) {
  return req.session?.user || null;
}

function requireAuth(req, res, next) {
  if (!currentUser(req)) return next(new HttpError(401, "You are not signed in"));
  next();
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return next(new HttpError(401, "You are not signed in"));
  if (user.role !== "admin") return next(new HttpError(403, "Admins only"));
  next();
}

/**
 * Lets an employee read or write their own data, and an admin anyone's.
 *
 * @param {(req: import('express').Request) => string|undefined} getName
 *   pulls the employee name the request is about out of the body, query or
 *   params, depending on the route.
 */
function requireSelfOrAdmin(getName) {
  return (req, res, next) => {
    const user = currentUser(req);
    if (!user) return next(new HttpError(401, "You are not signed in"));
    if (user.role === "admin") return next();

    const requested = String(getName(req) ?? "").trim().toLowerCase();
    if (!requested) return next(new HttpError(400, "Employee name is required"));
    if (requested !== user.name.trim().toLowerCase()) {
      return next(new HttpError(403, "You can only view your own records"));
    }
    next();
  };
}

module.exports = { currentUser, requireAdmin, requireAuth, requireSelfOrAdmin };

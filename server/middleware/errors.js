const logger = require("../logger");
const { IS_PRODUCTION } = require("../../config");

/**
 * Wraps an async route handler so a rejected promise reaches the error
 * handler instead of hanging the request. Express 5 forwards rejections for
 * you, but being explicit keeps the intent obvious at each route.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** An error with an HTTP status attached, for deliberate rejections. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (details) this.details = details;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.path}` });
}

/**
 * Single place where errors become responses.
 *
 * Every route used to catch its own exception, log it, and reply with a
 * hand-written 500 — which meant a mix of shapes, and real causes lost. The
 * client always gets `{ error }` now, and the stack goes to the log, never to
 * the browser.
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, "Unhandled request error");
  } else {
    logger.warn({ path: req.path, method: req.method, message: err.message }, "Request rejected");
  }

  const body = {
    error:
      status >= 500 && IS_PRODUCTION
        ? "Something went wrong. Check the server log for details."
        : err.message || "Request failed",
  };

  if (err.details) body.details = err.details;

  res.status(status).json(body);
}

module.exports = { asyncHandler, errorHandler, HttpError, notFoundHandler };

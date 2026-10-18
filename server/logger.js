const pino = require("pino");
const { LOG_LEVEL } = require("../config");

/**
 * Structured JSON logs on stdout.
 *
 * Deliberately no pino `transport`: a transport spawns a worker thread, which
 * adds startup cost and an extra failure mode for what is a single-process
 * app on a desk. Whoever wants pretty output can pipe through pino-pretty.
 */
const logger = pino({
  level: LOG_LEVEL,
  base: undefined,
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "res.headers['set-cookie']",
      "req.body.password",
      "req.body.newPassword",
      "req.body.currentPassword",
      "password",
      "password_hash",
      "passwordHash",
    ],
    censor: "[redacted]",
  },
});

module.exports = logger;

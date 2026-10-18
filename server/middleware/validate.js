const { ZodError } = require("zod");
const { HttpError } = require("./errors");

/**
 * Validates and replaces req.body / req.query / req.params from a Zod schema.
 *
 * Routes previously poked at req.body directly, coercing with a `parseNumber`
 * helper that turned any garbage into 0 — so a typo in an hourly rate became
 * a silent $0 day. Anything that does not match the schema is now a 400 that
 * names the offending field.
 */
/**
 * Replaces req.body / req.query / req.params with the validated values.
 *
 * Express 5 made req.query a getter with no setter, so a plain assignment to
 * it is silently discarded and the handler keeps reading the raw, unparsed
 * querystring — no coercions, and no defaults. That is subtle rather than
 * loud: validation still *rejects* bad input, because parse() throws before
 * this runs, so everything looks fine until a handler depends on a default.
 * /api/time-entries did: its `limit` arrived undefined and SQLite rejected
 * the bind with SQLITE_MISMATCH.
 *
 * The property is configurable, so defineProperty replaces it cleanly.
 */
function assign(req, source, value) {
  // Always an own data property, never a plain assignment: req.query's getter
  // lives on the request prototype, so `req.query = value` reaches a setter
  // that is not there and is thrown away. Defining it here shadows the getter
  // for this request only.
  Object.defineProperty(req, source, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const source of ["body", "query", "params"]) {
        if (!schemas[source]) continue;
        assign(req, source, schemas[source].parse(req[source]));
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join(".") || "(root)",
          message: issue.message,
        }));
        return next(new HttpError(400, "Invalid request", details));
      }
      next(err);
    }
  };
}

module.exports = validate;

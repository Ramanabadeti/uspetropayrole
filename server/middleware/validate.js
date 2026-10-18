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
function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const source of ["body", "query", "params"]) {
        if (!schemas[source]) continue;
        req[source] = schemas[source].parse(req[source]);
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

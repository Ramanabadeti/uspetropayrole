const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const logger = require("./logger");
const SqliteSessionStore = require("./sessionStore");
const { errorHandler, notFoundHandler } = require("./middleware/errors");

const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const clockRoutes = require("./routes/clock");
const timeEntryRoutes = require("./routes/timeEntries");
const adminNoteRoutes = require("./routes/adminNotes");
const statsRoutes = require("./routes/stats");

const { CORS_ORIGINS, IS_PRODUCTION, SESSION_TTL_MS, SESSION_SECRET } = require("../config");

/**
 * Builds the Express app without starting it, so the tests can drive it over
 * supertest instead of booting a real server on a real port.
 */
function createApp({ serveFrontend = true } = {}) {
  const app = express();

  // Behind no proxy locally, but one hop is the usual shape if this ever sits
  // behind nginx — needed for secure cookies and for rate limiting by IP.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      // Successful static asset fetches are noise; everything else is logged.
      autoLogging: { ignore: (req) => req.url?.startsWith("/static/") },
    })
  );

  app.use(
    helmet({
      // The frontend is a plain bundle from the same origin, so a strict CSP
      // is viable; `unsafe-inline` for styles is what the CSS-in-JS chart
      // library needs.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // The login and showcase screens pull Playfair Display from Google
          // Fonts; a bare 'self' here silently drops the app's typography.
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", ...CORS_ORIGINS],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // The PDF export opens a blob in a new tab, which COEP would block.
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    // The delegate form, because deciding this needs the request: the browser
    // sends an Origin header for the app's own origin too, and rejecting that
    // turned every stylesheet and script fetch into a 500.
    cors((req, callback) => {
      const origin = req.headers.origin;
      const host = req.headers.host;

      // Non-browser callers (curl, the healthcheck) send no Origin at all.
      const sameOrigin = !!origin && !!host && origin.replace(/^https?:\/\//, "") === host;
      const allowed = !origin || sameOrigin || CORS_ORIGINS.includes(origin);

      // A disallowed origin gets a response without CORS headers, which the
      // browser then refuses to read. Throwing here would turn someone else's
      // stray request into a 500 in our own logs.
      callback(null, {
        origin: allowed,
        // Sessions travel in a cookie now, so the browser has to be told it
        // may send them during local Vite development.
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type"],
      });
    })
  );

  // A body limit, so a single request cannot be used to exhaust memory.
  app.use(express.json({ limit: "256kb" }));

  const sessionStore = new SqliteSessionStore({ ttlMs: SESSION_TTL_MS });
  sessionStore.startCleanup();

  app.use(
    session({
      name: "punchway.sid",
      secret: SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // Only over HTTPS in production; the client PC runs it over plain
        // localhost, where a secure cookie would never be sent at all.
        secure: IS_PRODUCTION && process.env.TRUST_HTTPS !== "false",
        maxAge: SESSION_TTL_MS,
      },
    })
  );

  // Routes need the store to end another user's sessions on password change.
  app.use((req, res, next) => {
    req.sessionStore = sessionStore;
    next();
  });

  // A broad ceiling on API traffic. The login route has its own, much
  // tighter, limiter.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests. Slow down." },
    })
  );

  app.get("/api/health", async (req, res) => {
    const connectDB = require("../db");
    try {
      const db = await connectDB();
      await db.get("SELECT 1");
      res.json({ status: "ok", database: "ok" });
    } catch (err) {
      res.status(503).json({ status: "degraded", database: err.message });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api", timeEntryRoutes);
  app.use("/api", adminNoteRoutes);
  app.use("/api", statsRoutes);
  app.use("/api", clockRoutes);

  // The old unprefixed clock endpoints, so an older built frontend on the
  // client PC keeps working after an update.
  app.use("/", clockRoutes);

  // `/api/employee-list` was a second, identical copy of the roster endpoint.
  app.get("/api/employee-list", (req, res, next) => {
    req.url = "/";
    employeeRoutes(req, res, next);
  });

  const buildPath = path.join(__dirname, "..", "build");
  if (serveFrontend && fs.existsSync(buildPath)) {
    app.use(
      express.static(buildPath, {
        // Hashed asset filenames can be cached hard; index.html must not be.
        setHeaders(res, filePath) {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get(/^(?!\/api|\/clock-in|\/clock-out|\/clock-data).*/, (req, res) => {
      res.sendFile(path.join(buildPath, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.locals.sessionStore = sessionStore;
  return app;
}

module.exports = createApp;

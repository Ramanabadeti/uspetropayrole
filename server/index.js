#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const migrate = require("../migrate");
const createApp = require("./app");
const logger = require("./logger");
const { closeDB } = require("../db");
const { PORT, NODE_ENV, DB_PATH } = require("../config");

/**
 * Runs pending migrations, then serves the API and the built frontend.
 *
 * Migrating on boot (rather than expecting whoever runs update.bat to
 * remember an extra command) is what makes the Windows client PC safe to
 * update: migrate.js backs the database up first and is a no-op when there is
 * nothing to apply.
 */
async function main() {
  await migrate();

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: NODE_ENV, database: DB_PATH }, "PunchWay payroll is running");
    console.log(`Server running on port ${PORT} — open http://localhost:${PORT}`);
  });

  // Without this, Ctrl+C leaves the SQLite WAL un-checkpointed and the port
  // held for a while, which made restarting after an update flaky.
  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutting down");
    app.locals.sessionStore?.stopCleanup();
    server.close(async () => {
      await closeDB().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start");
  console.error(err.message);
  process.exit(1);
});

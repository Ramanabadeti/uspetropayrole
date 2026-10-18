const { Store } = require("express-session");
const connectDB = require("../db");

/**
 * Session store backed by the app's own SQLite database.
 *
 * The default express-session store keeps sessions in memory, which means
 * everyone is logged out on every restart — and this app gets restarted by
 * update.bat/update.sh as a matter of routine. Keeping them in payroll.db
 * needs no extra service and no extra dependency.
 */
class SqliteSessionStore extends Store {
  constructor({ ttlMs }) {
    super();
    this.ttlMs = ttlMs;
    this.cleanupTimer = null;
  }

  /** Drops expired rows hourly. Unref'd so it never holds the process open. */
  startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.#reap().catch(() => {});
    }, 60 * 60 * 1000);
    if (typeof this.cleanupTimer.unref === "function") this.cleanupTimer.unref();
  }

  stopCleanup() {
    if (!this.cleanupTimer) return;
    clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  async #reap() {
    const db = await connectDB();
    await db.run("DELETE FROM login_sessions WHERE expires_at <= ?", [Date.now()]);
  }

  #expiryFor(session) {
    const cookieExpiry = session?.cookie?.expires;
    if (cookieExpiry) return new Date(cookieExpiry).getTime();
    return Date.now() + this.ttlMs;
  }

  get(sid, callback) {
    connectDB()
      .then((db) =>
        db.get("SELECT data, expires_at FROM login_sessions WHERE sid = ?", [sid])
      )
      .then((row) => {
        if (!row) return callback(null, null);
        if (row.expires_at <= Date.now()) return this.destroy(sid, () => callback(null, null));
        callback(null, JSON.parse(row.data));
      })
      .catch(callback);
  }

  set(sid, session, callback = () => {}) {
    connectDB()
      .then((db) =>
        db.run(
          `INSERT INTO login_sessions (sid, data, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
          [sid, JSON.stringify(session), this.#expiryFor(session)]
        )
      )
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, session, callback = () => {}) {
    connectDB()
      .then((db) =>
        db.run("UPDATE login_sessions SET expires_at = ? WHERE sid = ?", [
          this.#expiryFor(session),
          sid,
        ])
      )
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sid, callback = () => {}) {
    connectDB()
      .then((db) => db.run("DELETE FROM login_sessions WHERE sid = ?", [sid]))
      .then(() => callback(null))
      .catch(callback);
  }

  /** Called when an employee is deactivated or their password changes. */
  async destroyAllForEmployee(employeeId) {
    const db = await connectDB();
    const rows = await db.all("SELECT sid, data FROM login_sessions");
    const stale = rows.filter((row) => {
      try {
        return JSON.parse(row.data)?.user?.id === employeeId;
      } catch {
        return false;
      }
    });
    for (const row of stale) {
      await db.run("DELETE FROM login_sessions WHERE sid = ?", [row.sid]);
    }
    return stale.length;
  }
}

module.exports = SqliteSessionStore;

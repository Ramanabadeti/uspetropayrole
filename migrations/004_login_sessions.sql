-- Server-side login sessions. Replaces the old scheme, where the browser
-- downloaded every employee's password and decided for itself who was
-- logged in.

CREATE TABLE IF NOT EXISTS login_sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_expires ON login_sessions(expires_at);

const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const logger = require("../logger");
const { asyncHandler, HttpError } = require("../middleware/errors");
const { requireAdmin, requireAuth } = require("../middleware/auth");

const router = express.Router();

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const IS_WINDOWS = process.platform === "win32";
const UPDATE_SCRIPT = IS_WINDOWS ? "update.bat" : "update.sh";

/** Short commit and date of the code currently running, for the admin page. */
function readVersion() {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["log", "-1", "--format=%h|%cd|%s", "--date=format:%d %b %Y %H:%M"],
      { cwd: PROJECT_ROOT, timeout: 5000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const [commit, date, subject] = String(stdout).trim().split("|");
        resolve({ commit, date, subject });
      }
    );
  });
}

router.get(
  "/system/version",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({
      version: await readVersion(),
      updateScript: UPDATE_SCRIPT,
      canUpdate: fs.existsSync(path.join(PROJECT_ROOT, UPDATE_SCRIPT)),
    });
  })
);

/**
 * Runs the same update script the admin would otherwise type into a terminal:
 * pull, back up, install, rebuild, restart.
 *
 * It is launched detached and in its own window, because this process is
 * about to be replaced by the one that script starts — a child would die
 * with us halfway through an npm install. The window is deliberate: the
 * client's PC has no other way to show progress or an error, and an update
 * that fails silently is worse than one that fails loudly.
 */
router.post(
  "/system/update",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const script = path.join(PROJECT_ROOT, UPDATE_SCRIPT);
    if (!fs.existsSync(script)) {
      throw new HttpError(500, `${UPDATE_SCRIPT} is missing from the app folder`);
    }

    logger.warn({ by: req.session.user.name }, "Software update requested");

    const child = IS_WINDOWS
      ? spawn("cmd.exe", ["/c", "start", "", UPDATE_SCRIPT], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        })
      : spawn("bash", [script], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: "ignore",
        });
    child.unref();

    res.json({
      status: "updating",
      message:
        "The update is running in a new window. This app will stop for a " +
        "minute or two while it rebuilds, then start again on its own. " +
        "Reload this page once it is back.",
    });

    // Let the response reach the browser, then stand aside so the restarted
    // server can take the port.
    setTimeout(() => {
      logger.warn("Exiting so the update can restart the server");
      process.exit(0);
    }, 1000);
  })
);

module.exports = router;

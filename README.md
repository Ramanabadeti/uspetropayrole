# US Petro Payroll (PunchWay)

Employee time-clock and payroll admin app. A single Node/Express process
serves both the API and the built React frontend on one port.

## One-time setup (new machine, e.g. the client's Windows PC)

1. Install [Node.js](https://nodejs.org) 20 or newer and [Git](https://git-scm.com/downloads).
2. Clone the repo:
   ```
   git clone https://github.com/Ramanabadeti/uspetropayrole.git payroll
   cd payroll
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Copy `.env.example` to `.env`. Two values matter:
   - `SESSION_SECRET` — **required** when `NODE_ENV=production`. Generate one:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `PUNCHWAY_DATA_DIR` — where this machine's `PunchWay` folder (the monthly
     `*paysheet.xlsx` files and `blank pay sheet.xlsx`) actually lives.
5. Import the historical Excel data (safe to re-run; it skips anything already
   imported):
   ```
   npm run migrate-legacy
   ```
6. Convert any plaintext passwords to hashes. Everyone keeps the password they
   already use — nothing is reset:
   ```
   npm run hash-passwords
   ```
7. Build and start:
   - Windows: double-click `start.bat`
   - Mac/Linux: `./start.sh`
8. Open `http://localhost:5050`.

## Applying an update

Once changes are pushed to GitHub, on the machine you want to update:

- Windows: double-click `update.bat`
- Mac/Linux: `./update.sh`

This backs up the database, pulls, installs, rebuilds the frontend, and starts
the server. Any pending database migrations run automatically on startup —
after taking their own backup first. If the app is already running in another
window, stop it (Ctrl+C) first so the new build can take the same port.

`payroll.db` (the real data), `backups/` and `.env` (per-machine config) are
all gitignored — an update never touches or overwrites them.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm start` | Migrate if needed, then serve API + frontend on `PORT` |
| `npm run build` | Build the frontend into `build/` |
| `npm run dev` | Vite dev server on :3000, proxying the API to :5050 |
| `npm run dev:server` | API only, restarting on change |
| `npm test` | Run the test suite |
| `npm run migrate` | Apply pending migrations (backs up first) |
| `npm run backup` | Timestamped copy of the database into `backups/` |
| `npm run hash-passwords` | Hash any remaining plaintext passwords |

## How it fits together

```
server/
  index.js        entry point: migrate, then listen
  app.js          builds the Express app (no listen, so tests can drive it)
  routes/         auth, employees, clock, timeEntries, adminNotes, stats
  middleware/     auth guards, validation, error handling
  lib/payroll.js  every hours/pay calculation in the app
  lib/schemas.js  the request shape for every endpoint
migrations/       numbered .sql files, applied in order and recorded
src/              React frontend (Vite)
tests/            node:test suite
```

### Accounts and roles

Sign-in is server-side. Credentials go to `POST /api/auth/login`, which checks
a bcrypt hash and sets an httpOnly session cookie; the session is stored in the
database so a restart does not log everyone out. Every API route requires that
session. An **employee** can only read and write their own records; an
**admin** can see everyone, manage the roster, correct entries, and record
payments.

### How pay is calculated

All of it happens on the server, in `server/lib/payroll.js`:

- An employee's **hourly rate lives on their employee record**. Clock-out
  prices the shift from that rate; a rate sent by a browser is ignored.
- Hours are rounded to 2 decimals, and pay is derived from the *rounded* hours,
  so the dollar figure on a paysheet always reconciles with the hours printed
  next to it.
- Dates and times are read as **local wall-clock time**. A shift is "I started
  at 8am here", not an instant in UTC.
- A shift longer than `MAX_SHIFT_HOURS` (default 24) is **refused** rather than
  paid out — that is a forgotten clock-out, not a 31-hour day.
- The pay period of a shift is the month it **started** in, so a shift across
  midnight on the 1st does not land in the wrong month.

### Hours vs pay on the Statistics chart

These two numbers come from different places, on purpose:

- **Hours** come from the time entries — that is simply how much was worked.
- **Pay** comes *only* from Admin Notes, because a Note is the record that
  money actually changed hands. It never comes from `day_pay`, which is an
  in-progress running calculation of hours worked so far. Clocking in, clocking
  out, or correcting a day's hours must never move the pay figure; only
  submitting a Note does.

### Correcting an entry

An admin edit requires a reason and is recorded in `admin_edits`, readable at
`GET /api/time-entry/:id/edits`. An edit **keeps the entry's existing hourly
rate** unless the admin explicitly ticks "Also change this day's pay rate" —
the previous behaviour sent the admin page's on-screen "Pay Rate" filter box
with every edit, which silently repriced a day whenever someone corrected a
clock-out time.

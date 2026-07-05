# US Petro Payroll

Employee time-clock and payroll admin app. Single Node/Express process serves
both the API and the built React frontend on one port.

## One-time setup (new machine, e.g. the client's Windows PC)

1. Install [Node.js](https://nodejs.org) (LTS) and [Git](https://git-scm.com/downloads).
2. Clone the repo:
   ```
   git clone https://github.com/Ramanabadeti/uspetropayrole.git payroll
   cd payroll
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Copy `.env.example` to `.env` and set `PUNCHWAY_DATA_DIR` to wherever this
   machine's `PunchWay` folder (the one with the monthly `*paysheet.xlsx`
   files and `blank pay sheet.xlsx`) actually lives.
5. Import all the historical Excel data into the database (safe to re-run,
   it skips anything already imported):
   ```
   npm run migrate-legacy
   ```
6. Build and start the app:
   - Windows: double-click `start.bat`
   - Mac/Linux: `./start.sh`
7. Open `http://localhost:5050` in a browser.

## Applying an update after changes were made on the dev Mac

Once changes are pushed to GitHub, on the machine you want to update:

- Windows: double-click `update.bat`
- Mac/Linux: `./update.sh`

This pulls the latest code, installs any new dependencies, rebuilds the
frontend, and starts the server. If the app is already running in another
window, stop it (Ctrl+C) first so the new build can start on the same port.

`payroll.db` (the real data) and `.env` (per-machine config) are gitignored —
an update never touches or overwrites them.

## Notes

- `PORT` (default `5050`) and `DB_PATH` (default `./payroll.db`) can also be
  set in `.env` if needed.
- The admin "Notes" ledger and employee time entries live in the database
  now, not in Excel. The Excel files under `PUNCHWAY_DATA_DIR` are only read
  for the employee roster (`blank pay sheet.xlsx`) and the one-time
  `migrate-legacy` import.

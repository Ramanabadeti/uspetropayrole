# Deploying an update to the client's Windows PC

The client's PC holds the only real database. Nothing in this repository
ever carries a database: `payroll.db`, `clockInData.json`, `.env` and
`/backups` are all gitignored, so a `git pull` brings code and nothing else.
The client's data stays where it is and the new code adapts to it.

Work through this in order. Steps 4 and 9 are the ones that prove no data
was lost or duplicated.

---

## Part A — on the Mac, before going anywhere near the client

### 1. Merge the work into `main`

`update.bat` runs `git pull --ff-only`, which follows `main`. Code sitting on
a branch is invisible to the client PC.

```
git checkout main
git merge --no-ff upgrade/production-hardening
```

### 2. Decide what to do about the public repository

The repository is currently **public**, and an early commit contains a
`payroll.db` holding 5 employees with plaintext passwords and 628 time
entries. Deleting the file later did not remove it from history.

**If you make the repository private** — the right call — be aware that
`git pull` on the client PC will then ask for GitHub credentials, and
`update.bat` will stall waiting for them. Before the next update over there,
either sign in once with Git Credential Manager, or create a personal access
token and set the remote to use it. Sort this out while you are at the
machine, not remotely.

Changing the passwords of those 5 accounts matters regardless of visibility.

### 3. Push

```
git push origin main
```

---

## Part B — on the client's Windows PC

### 4. Stop the app, and record what is in the database

Close the window running the app. If it starts at logon from the Startup
folder, close that window too — the app must not be running while the
database is upgraded.

Then, from the project folder:

```
npm run data-check
```

**Write these numbers down.** Employees, time entries, admin notes, admin
edits. Step 9 compares against them, and they are the whole basis for
knowing nothing was lost or duplicated.

### 5. Take your own backup

`update.bat` backs up automatically, and the migration runner backs up again
before touching anything. Take a third one anyway, somewhere off the machine
— a USB stick or a cloud folder:

```
copy payroll.db payroll-before-upgrade.db
copy payroll.db-wal payroll-before-upgrade.db-wal
copy payroll.db-shm payroll-before-upgrade.db-shm
```

Copy all three files. The database runs in WAL mode, so recent writes may
live in the `-wal` file rather than the main one. Copying only `payroll.db`
can miss the most recent entries.

### 6. Run the update

```
.\update.bat
```

It pulls, backs up, installs dependencies, rebuilds and starts. This run will
be slower than you are used to: the build system changed from Create React
App to Vite, so `npm install` has a lot to fetch.

### 7. Watch the migrations apply

On startup you should see, once each:

```
Applied 001_baseline.sql
Applied 002_employee_credentials_and_rate.sql
Applied 003_employee_ids.sql
Applied 004_login_sessions.sql
Applied 005_indexes.sql
```

They run inside transactions. If one fails it rolls back and the app stops
with the reason — nothing is left half-applied. If that happens, go to
"If something goes wrong" below rather than trying the next step.

`001_baseline` is every-statement-`IF NOT EXISTS`; on an existing database it
does nothing. The rest only add columns, backfill them, and add indexes.
None of them inserts or deletes a row.

### 8. Set the production settings

Open `.env` and add:

```
NODE_ENV=production
SESSION_SECRET=<paste the generated value>
```

Generate the secret with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_SECRET` is required when `NODE_ENV=production` and the app refuses
to start without it. Everyone is logged out if it later changes, so set it
once and leave it. Restart the app after editing `.env`.

### 9. Prove nothing changed

```
npm run data-check
```

Every count must match step 4 **exactly**. A number that grew means
something imported twice; one that shrank means something was lost. Either
way, stop and restore the backup.

It also reports rows it could not link to an employee. Migration 003 adds a
proper employee link and fills it in by matching the name on the entry
against the employee list, so an entry filed under a name that no longer
exists in `employees` stays unlinked. Those rows are intact and still appear
in timesheets — they are just not joined to an employee record. On the Mac
this is 55 entries under "Rishi", "mahesh" and one junk row named "0". If the
client's database reports some, check whether they are former employees
before worrying.

### 10. Check the app itself

- Log in as admin. **Existing passwords still work** — the first correct
  login hashes that password and clears the plaintext automatically, one
  account at a time. Nobody needs a new password and nothing needs running
  by hand.
- Pick an employee, month and year, and Search. Figures should match what the
  client saw before the upgrade.
- Check Statistics — the chart should show real months.
- Click **Print** (floating, right-hand side) and confirm the statement looks
  right.
- Have one employee clock in and out, and confirm the entry appears with the
  correct pay.

### 11. Put the automatic start back

If you closed an auto-started window in step 4, start it again or reboot.
`autostart.bat` only serves the already-built app; it never pulls or
rebuilds, so always run `update.bat` by hand for future updates.

---

## If something goes wrong

Stop the app, then restore:

```
copy payroll-before-upgrade.db payroll.db
copy payroll-before-upgrade.db-wal payroll.db-wal
copy payroll-before-upgrade.db-shm payroll.db-shm
```

To go back to the previous code as well:

```
git log --oneline
git checkout <the commit before the merge>
npm install
npm run build
npm start
```

The automatic backups in `backups\` are a second route — they are named by
timestamp, newest last.

---

## Never do these on the client's PC

- **Do not run `npm run migrate-legacy`.** It imports the old PunchWay Excel
  files. It is a one-time command for a brand-new machine, and on a database
  that already has the data it is the one real duplication risk.
- **Do not copy the Mac's `payroll.db` across.** The Mac copy is a
  development database and is months out of date. The client's file is the
  real one.
- **Do not run `npm run hash-passwords` on the client.** Logins upgrade
  themselves. Running it is not harmful, but it is unnecessary and it needs
  the plaintext passwords to still be present.
- **Do not leave DB Browser for SQLite open** while the app runs. It holds a
  write lock and the app fails with `SQLITE_BUSY: database is locked` at
  login.

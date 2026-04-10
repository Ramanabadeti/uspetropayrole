# PunchWay — Employee Time Tracking & Payroll System

**A full-stack payroll app that replaces spreadsheets and manual timekeeping for small businesses.** Employees clock in/out from any browser; admins review hours, fix errors, and export payroll PDFs — all backed by a local SQLite database that works offline.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=flat-square&logo=vercel)](https://uspetropayrole.vercel.app)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite)

---

## The Problem It Solves

Small businesses (gas stations, shops, service teams) track attendance in Excel files or on paper. The result: miscalculated pay, overwritten data, impossible-to-audit edits, and hours of manual work every payday. PunchWay eliminates all of that.

---

## Live Demo

**[https://uspetropayrole.vercel.app](https://uspetropayrole.vercel.app)**

---

## Screenshots

> _Add screenshots or a demo GIF here — e.g. employee clock-in screen, admin payroll table, PDF export_

| Employee Dashboard | Admin Payroll View |
|---|---|
| ![Employee Dashboard](screenshots/employee-dashboard.png) | ![Admin View](screenshots/admin-payroll.png) |

---

## Key Features

**Employee**
- Secure login, one-click clock in / clock out
- Session survives page refresh (no lost clock-ins)
- Monthly attendance log with total and decimal hours

**Admin**
- Search any employee's records by month and year
- Enter hourly rate → daily and monthly pay calculated instantly
- Edit incorrect clock times → pay recalculates automatically, edit logged in an audit trail
- Add payment notes, track paid vs. pending amounts
- Export payroll summary as a PDF
- Import historical attendance data from Excel

**System**
- Runs entirely offline — SQLite on local disk, no cloud dependency
- Full audit log of every admin correction
- Status tracking: `completed` / `corrected` / `imported`

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, React Router v7 |
| Backend | Node.js, Express 5 |
| Database | SQLite (`sqlite3`) |
| PDF Export | jsPDF + html2canvas |
| Excel Import | xlsx |

---

## Architecture

```
React (port 3000)
      │
      │  JSON REST API
      ▼
Express (port 5050)
      │
      │  SQL
      ▼
SQLite — payroll.db (local file)
```

Single-machine deployment. No external services, no environment variables required to get running.

---

## Setup & Installation

**Prerequisites:** Node.js v18+

```bash
# Clone
git clone https://github.com/ramanabadeti/uspetropayrole.git
cd uspetropayrole

# Install dependencies
npm install

# Initialize database (creates payroll.db + all tables)
node initDb.js

# Seed employees
node importEmployees.js

# Optional: import historical Excel data
node importHistoricalEntries.js
```

**Run:**

```bash
# Terminal 1 — API server
node server.js          # http://localhost:5050

# Terminal 2 — React frontend
npm run dev             # http://localhost:3000
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/login` | Authenticate employee or admin |
| `POST` | `/clock-in` | Start a clock-in session |
| `POST` | `/clock-data` | Save completed clock entry with calculated hours/pay |
| `GET` | `/clock-in/:name` | Get active session for an employee |
| `POST` | `/api/employee-logs` | Fetch logs filtered by employee, month, year |
| `GET` | `/api/employees` | List all employees |
| `GET` | `/api/time-entries` | All time entries (optional query filters) |
| `PUT` | `/api/time-entry/:id` | Edit entry → recalculate + write to audit log |
| `POST` | `/api/save-admin-note` | Attach payment note to an entry |
| `GET` | `/api/emails` | Get employee email addresses |

---

## Database Schema (condensed)

```
employees        → id, emp_no, name, password, role, mail_id
active_sessions  → emp_name, clock_in_time, in_date, month, year
time_entries     → id, emp_name, clock times, total_hours, decimal_hours,
                   hourly_rate, day_pay, month, year, status, updated_at
admin_edits      → time_entry_id, old/new times, old/new pay, edit_reason,
                   edited_by, edited_at
```

---

## Author

**Raman Abadeti** — Full-Stack Developer

- GitHub: [@ramanabadeti](https://github.com/ramanabadeti)
- Live: [uspetropayrole.vercel.app](https://uspetropayrole.vercel.app)

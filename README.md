PUNCHWAY – EMPLOYEE TIME TRACKING & PAYROLL SYSTEM

PunchWay is a fullstack employee attendance and payroll management
system built for small businesses such as gas stations, shops, and
service companies.

It allows employees to clock in and clock out easily, while
administrators can review work hours, edit incorrect entries, and
calculate payroll accurately.

The system works offline because it stores data locally using SQLite
database.

------------------------------------------------------------------------

PROJECT PURPOSE

Many small businesses track attendance manually or using Excel files,
which can lead to:

• incorrect pay calculations • lost or overwritten data • difficulty
editing past records • dependency on internet tools • manual errors

PunchWay solves these problems by providing a simple, reliable, and
offline-capable payroll system.

------------------------------------------------------------------------

MAIN FEATURES

EMPLOYEE FEATURES

Employees can:

• login securely • clock in • clock out • automatically record work date
and time • refresh page without losing session • see their work logs •
view total hours worked • system works even without internet

------------------------------------------------------------------------

ADMIN FEATURES

Admin can:

• search employee logs by month and year • see total hours worked • see
decimal hours for accurate payroll calculation • manually enter hourly
pay rate • edit incorrect clock-in or clock-out times • automatically
recalculate pay after edit • see corrected entries • add notes and
payment remarks • track paid amount and pending amount • generate
payroll summary PDF • send payroll email • view historical attendance
records

------------------------------------------------------------------------

SYSTEM FEATURES

• local SQLite database storage • offline-first design • automatic hour
calculation • automatic pay calculation • admin edit tracking •
historical Excel import supported • responsive UI • clean aligned table
layout • modular backend API structure

------------------------------------------------------------------------

TECHNOLOGY STACK

FRONTEND React.js HTML CSS JavaScript

BACKEND Node.js Express.js

DATABASE SQLite

LIBRARIES USED sqlite3 xlsx html2canvas jspdf cors body-parser

------------------------------------------------------------------------

APPLICATION ARCHITECTURE

Frontend (React) | | API Requests | Backend (Node + Express) | | SQL
Queries | SQLite Database (Local Storage)

------------------------------------------------------------------------

PROJECT FOLDER STRUCTURE

PunchWay

client src components Login Home Admin Header

server server.js db.js initDb.js importEmployees.js
importHistoricalEntries.js

payroll.db

README.txt

------------------------------------------------------------------------

HOW THE SYSTEM WORKS

EMPLOYEE WORKFLOW

1.  employee logs in
2.  employee clicks Clock In
3.  system stores start time
4.  employee works shift
5.  employee clicks Clock Out
6.  system calculates: total hours decimal hours daily pay
7.  record stored in database
8.  employee can see monthly logs

------------------------------------------------------------------------

ADMIN WORKFLOW

1.  admin logs in
2.  selects employee
3.  selects month and year
4.  enters hourly rate
5.  clicks search
6.  system displays: work dates clock in time clock out time total hours
    decimal hours pay per day
7.  admin can edit incorrect time
8.  system recalculates hours automatically
9.  admin can add notes or payment details
10. admin can generate PDF report
11. admin can send email

------------------------------------------------------------------------

DATABASE STRUCTURE

DATABASE FILE payroll.db

TABLE: employees id name password

TABLE: active_sessions emp_name clock_in_time in_time in_date month year

TABLE: time_entries id emp_name clock_in_date clock_in_time
clock_out_date clock_out_time total_hours decimal_hours hourly_rate
day_pay month year status updated_at

status values: normal corrected imported

TABLE: admin_edits id time_entry_id old_clock_in_time new_clock_in_time
edit_reason edited_by edited_at

------------------------------------------------------------------------

API ENDPOINTS

POST /login POST /clock-in POST /clock-data GET /clock-in/{employeeName}
POST /api/employee-logs GET /api/employees GET /api/time-entries PUT
/api/time-entry/{id} POST /api/save-admin-note POST /api/admin-note-list
GET /api/emails

------------------------------------------------------------------------

INSTALLATION STEPS

1.  clone project git clone repository_url

2.  install frontend cd client npm install

3.  install backend cd server npm install

4.  create database node initDb.js

5.  import employees node importEmployees.js

6.  import historical Excel data node importHistoricalEntries.js

7.  start backend node server.js

8.  start frontend cd client npm start

frontend runs on http://localhost:3000 backend runs on
http://localhost:5050

------------------------------------------------------------------------

OFFLINE CAPABILITY

PunchWay works without internet connection because:

• SQLite database runs locally • all API requests run on local server •
data stored on local machine • no cloud dependency

Employees can clock in and clock out even if internet stops working.

------------------------------------------------------------------------

AUTHOR

Fullstack payroll system demonstrating:

React frontend Node backend REST API design SQLite database real
business logic
# PunchWay

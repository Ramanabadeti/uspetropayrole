-- Time entries, notes and active sessions referenced employees by free-text
-- name, so renaming an employee orphaned their whole history. Add a real
-- foreign key and backfill it from the existing names.
--
-- emp_name is kept alongside it: 628 historical rows and every existing
-- query depend on it, and it stays useful as a record of the name the entry
-- was filed under. employee_id is the authoritative link from now on.

ALTER TABLE time_entries ADD COLUMN employee_id INTEGER REFERENCES employees(id);
ALTER TABLE admin_notes ADD COLUMN employee_id INTEGER REFERENCES employees(id);
ALTER TABLE active_sessions ADD COLUMN employee_id INTEGER REFERENCES employees(id);

UPDATE time_entries
SET employee_id = (
  SELECT e.id FROM employees e WHERE TRIM(LOWER(e.name)) = TRIM(LOWER(time_entries.emp_name))
)
WHERE employee_id IS NULL;

UPDATE admin_notes
SET employee_id = (
  SELECT e.id FROM employees e WHERE TRIM(LOWER(e.name)) = TRIM(LOWER(admin_notes.emp_name))
)
WHERE employee_id IS NULL;

UPDATE active_sessions
SET employee_id = (
  SELECT e.id FROM employees e WHERE TRIM(LOWER(e.name)) = TRIM(LOWER(active_sessions.emp_name))
)
WHERE employee_id IS NULL;

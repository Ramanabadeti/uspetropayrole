-- The admin screens filter almost exclusively by employee + pay period, and
-- every one of those queries was a full table scan.

CREATE INDEX IF NOT EXISTS idx_time_entries_emp_period
  ON time_entries(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_time_entries_name_period
  ON time_entries(emp_name, year, month);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in
  ON time_entries(clock_in_full_time);

CREATE INDEX IF NOT EXISTS idx_admin_notes_emp_period
  ON admin_notes(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_admin_notes_name_period
  ON admin_notes(emp_name, year, month);

CREATE INDEX IF NOT EXISTS idx_admin_edits_time_entry
  ON admin_edits(time_entry_id);

-- Give employees a real hourly rate and a place for a hashed password.
--
-- `password` (plaintext) is deliberately left in place by this migration so
-- nobody is locked out mid-upgrade. `npm run hash-passwords` fills
-- password_hash from it, and 006 clears the plaintext column afterwards.

ALTER TABLE employees ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN password_hash TEXT;
ALTER TABLE employees ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- The app has only ever paid $15/hr (it was hardcoded in the employee Home
-- screen), so seed every existing employee at that rate rather than at 0,
-- which would silently zero out new pay calculations.
UPDATE employees SET hourly_rate = 15 WHERE hourly_rate = 0;

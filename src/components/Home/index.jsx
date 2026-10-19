import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DateTime from "../DateTime";
import api, { ApiError } from "../../api";
import { useAuth } from "../../auth";
import "./index.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A punch is dead for this long afterwards, so a double click or an
// impatient second press cannot file two entries for one shift.
const CLOCK_COOLDOWN_SECONDS = 6;

/**
 * The employee's own timesheet and clock.
 *
 * Two things moved to the server here. The clock-in instant is the server's
 * clock rather than the browser's, and clock-out no longer computes hours,
 * rate and pay in JavaScript and post them for storage — it just says "I am
 * done" and the server does the arithmetic with the employee's configured
 * rate. The pay rate was hardcoded to 15 in this file.
 */
function EmployeeHome({ empName }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const [entries, setEntries] = useState([]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  // Seconds the clock button stays dead after a punch. A second click while
  // the first was still in flight is how an employee ends up with two
  // entries for one shift, and the fix has to outlast the request itself.
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleError = useCallback(
    (err) => {
      if (err instanceof ApiError && err.isAuthError) {
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message || "Something went wrong");
    },
    [navigate]
  );

  const loadActive = useCallback(async () => {
    try {
      setActive(await api.activeSession(empName));
    } catch (err) {
      // A 404 just means "not clocked in", which is the normal case.
      if (err instanceof ApiError && err.status === 404) {
        setActive(null);
        return;
      }
      handleError(err);
    }
  }, [empName, handleError]);

  const loadEntries = useCallback(async () => {
    try {
      setEntries(await api.employeeLogs({ employeeName: empName, month, year }));
    } catch (err) {
      handleError(err);
    }
  }, [empName, month, year, handleError]);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onClockIn = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.clockIn(empName);
      await loadActive();
      setNotice("Clocked in. Enjoy your shift.");
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
      setCooldown(CLOCK_COOLDOWN_SECONDS);
    }
  };

  const onClockOut = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { entry } = await api.clockOut(empName);
      setActive(null);
      await loadEntries();
      setNotice(`Clocked out — ${entry.totalHours} worked today.`);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
      setCooldown(CLOCK_COOLDOWN_SECONDS);
    }
  };

  const onLogOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const totalHoursWorked = entries
    .reduce((sum, entry) => sum + Number(entry.decimalHours || 0), 0)
    .toFixed(2);

  const years = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(current - i));
  }, [now]);

  return (
    <div>
      <nav className="navbar">
        <h1 className="nav-title">Time Sheet</h1>
        <button className="logout-btn" onClick={onLogOut}>
          Logout
        </button>
      </nav>

      <div>
        <h3>{empName}</h3>
      </div>

      <DateTime />

      {error && <p className="employee-error" role="alert">{error}</p>}
      {notice && <p className="employee-notice">{notice}</p>}

      {active ? (
        <button
          className="clock-out"
          onClick={onClockOut}
          disabled={busy || cooldown > 0}
        >
          {busy ? "Working…" : cooldown > 0 ? `Please wait… ${cooldown}s` : "Clock Out"}
        </button>
      ) : (
        <button
          className="clock-in"
          onClick={onClockIn}
          disabled={busy || cooldown > 0}
        >
          {busy ? "Working…" : cooldown > 0 ? `Please wait… ${cooldown}s` : "Clock In"}
        </button>
      )}

      {active ? (
        <div>
          <h4>Today You Started At</h4>
          <h1>
            {active.inDate} {active.inTime}
          </h1>
          <h3>Enjoy Your Shift</h3>
        </div>
      ) : (
        <h4>Go ahead and Clock In</h4>
      )}

      <div className="timesheet-filters">
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1)}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="employee-logs">
        <table className="timesheet-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>IN</th>
              <th>OUT</th>
              <th>TOTAL HOURS</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4}>No entries for {MONTHS[Number(month) - 1]} {year}.</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.clockInDate}</td>
                  <td>{entry.clockInTime}</td>
                  <td>{entry.clockOutTime}</td>
                  <td>{entry.totalHours}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="timesheet-total">Total Number Of Hours : {totalHoursWorked}</div>
      </div>
    </div>
  );
}

export default EmployeeHome;

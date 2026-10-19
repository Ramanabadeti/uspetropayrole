/**
 * Every pay figure in the app is produced here.
 *
 * Previously the browser computed hours and dollars and the server stored
 * whatever it was handed, so a client could post any amount it liked and the
 * hourly rate was a hardcoded 15 in the employee screen. These functions are
 * the only place that math happens now, and the API calls them on the way in.
 */

const MS_PER_HOUR = 3600000;

/** Dollars, rounded to the cent, never -0 or NaN. */
function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100 || 0;
}

/** Hours, rounded to 2 decimals — the precision the paysheets have always used. */
function roundHours(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100 || 0;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Parses the date/time shapes that actually exist in this database.
 *
 * Historical rows hold US locale strings (`7/5/2026`, `3:04:05 PM`) because
 * they were written with toLocaleDateString()/toLocaleTimeString(); newer
 * input from date/time pickers is ISO (`2026-07-05`, `15:04`). Both are read
 * as local wall-clock time on purpose: a shift is "I started at 8am here",
 * not an instant in UTC. Feeding these strings straight to `new Date()` — the
 * old behaviour — silently shifted ISO dates by the UTC offset, which is the
 * timezone bug commit 5f01c6b was chasing.
 *
 * @returns {Date|null} null when the input cannot be understood.
 */
function parseLocalDateTime(dateInput, timeInput) {
  const dateStr = normalizeText(dateInput);
  const timeStr = normalizeText(timeInput);
  if (!dateStr) return null;

  let year;
  let month;
  let day;

  const iso = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const us = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (iso) {
    [, year, month, day] = iso.map(Number);
  } else if (us) {
    [, month, day, year] = us.map(Number);
  } else {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeStr) {
    const time = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
    if (!time) return null;

    hours = Number(time[1]);
    minutes = Number(time[2]);
    seconds = Number(time[3] || 0);

    const meridiem = time[4] ? time[4].toUpperCase() : null;
    if (meridiem) {
      if (hours < 1 || hours > 12) return null;
      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  // Rejects things like 2/30: the Date constructor rolls them over silently.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** `7:05:09` from a duration in seconds. */
function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

class PayrollError extends Error {
  constructor(message) {
    super(message);
    this.name = "PayrollError";
    this.status = 400;
  }
}

/**
 * Turns a clock-in/clock-out pair plus an hourly rate into the numbers stored
 * on a time entry.
 *
 * @param {object} input
 * @param {number} [input.maxShiftHours] reject anything longer — a shift that
 *   runs for days is someone who forgot to clock out, not a 60-hour day, and
 *   silently paying it out is worse than refusing it.
 * @throws {PayrollError} on unparseable or out-of-order times.
 */
function calculateWorkData({
  clockInDate,
  clockInTime,
  clockOutDate,
  clockOutTime,
  hourlyRate,
  maxShiftHours = 24,
}) {
  const start = parseLocalDateTime(clockInDate, clockInTime);
  const end = parseLocalDateTime(clockOutDate, clockOutTime);

  if (!start) throw new PayrollError("Could not read the clock-in date and time");
  if (!end) throw new PayrollError("Could not read the clock-out date and time");

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) throw new PayrollError("Clock-out is before clock-in");

  const hours = diffMs / MS_PER_HOUR;
  if (maxShiftHours && hours > maxShiftHours) {
    throw new PayrollError(
      `Shift is ${hours.toFixed(1)} hours, longer than the ${maxShiftHours}-hour maximum. ` +
        "Correct the clock-out time instead."
    );
  }

  const rate = parseNumber(hourlyRate);
  if (rate < 0) throw new PayrollError("Hourly rate cannot be negative");

  const decimalHours = roundHours(hours);

  return {
    totalHours: formatDuration(Math.floor(diffMs / 1000)),
    decimalHours,
    // Pay is derived from the rounded hours, not the raw millisecond
    // difference, so the dollar figure always reconciles with the hours
    // printed next to it on the paysheet.
    dayPay: roundCurrency(decimalHours * rate),
    hourlyRate: roundCurrency(rate),
    clockInFullTime: start.toISOString(),
    clockOutFullTime: end.toISOString(),
  };
}

/**
 * Same math as calculateWorkData, but from two Date instants.
 *
 * Used by clock-out, where the start comes from the stored active session and
 * the end is the server's clock, so there are no strings to parse. Also
 * returns the display date/time strings to store on the entry, in the ISO
 * shapes the pickers produce rather than the locale strings the browser used
 * to send.
 */
function calculateFromInstants({ start, end, hourlyRate, maxShiftHours = 24 }) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new PayrollError("Clock-in time is unreadable");
  }
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new PayrollError("Clock-out time is unreadable");
  }

  const pad = (n) => String(n).padStart(2, "0");
  const dateOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const computed = calculateWorkData({
    clockInDate: dateOf(start),
    clockInTime: timeOf(start),
    clockOutDate: dateOf(end),
    clockOutTime: timeOf(end),
    hourlyRate,
    maxShiftHours,
  });

  return {
    ...computed,
    clockInDate: dateOf(start),
    clockInTime: timeOf(start),
    clockOutDate: dateOf(end),
    clockOutTime: timeOf(end),
  };
}

/**
 * Totals per pay period for the Statistics chart.
 *
 * Hours come from the time entries — that is simply how much was worked, and
 * should always be current. Pay comes *only* from Admin Notes, because a Note
 * is the record that money actually changed hands. day_pay is an in-progress
 * running calculation of hours worked so far, not a payment, so clocking in,
 * clocking out, or correcting a day's hours must never move the pay number;
 * only submitting a Note does. Commits 402e37a and c4298e1 both landed on
 * this rule the hard way — it is pinned by tests now.
 *
 * @param {Array<{month: string, year: string, totalHours: number}>} hoursRows
 * @param {Array<{month: string, year: string, notesSum: number}>} notesRows
 */
function buildEmployeeStats(hoursRows, notesRows) {
  const key = (r) => `${r.year}-${r.month}`;
  const notesByKey = new Map();

  for (const row of notesRows) {
    notesByKey.set(key(row), roundCurrency(row.notesSum));
  }

  const rows = hoursRows.map((r) => ({
    month: r.month,
    year: r.year,
    totalHours: roundHours(r.totalHours),
    totalPay: notesByKey.get(key(r)) || 0,
  }));

  // A month can be paid for without any hours clocked against it (a
  // historical payment imported from a paysheet), and it still belongs on the
  // chart.
  const seen = new Set(rows.map(key));
  for (const row of notesRows) {
    if (seen.has(key(row))) continue;
    rows.push({
      month: row.month,
      year: row.year,
      totalHours: 0,
      totalPay: roundCurrency(row.notesSum),
    });
  }

  rows.sort((a, b) => Number(a.year) - Number(b.year) || Number(a.month) - Number(b.month));
  return rows;
}

module.exports = {
  MS_PER_HOUR,
  PayrollError,
  buildEmployeeStats,
  calculateFromInstants,
  calculateWorkData,
  formatDuration,
  normalizeText,
  parseLocalDateTime,
  parseNumber,
  roundCurrency,
  roundHours,
};

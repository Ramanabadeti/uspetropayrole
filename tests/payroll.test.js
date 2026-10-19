const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEmployeeStats,
  calculateFromInstants,
  calculateWorkData,
  formatDuration,
  parseLocalDateTime,
  roundCurrency,
} = require("../server/lib/payroll");

describe("parseLocalDateTime", () => {
  it("reads the US locale strings the historical rows are stored in", () => {
    const d = parseLocalDateTime("3/31/2026", "8:39:41 PM");
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 31);
    assert.equal(d.getHours(), 20);
    assert.equal(d.getMinutes(), 39);
  });

  it("reads the ISO strings the date pickers produce", () => {
    const d = parseLocalDateTime("2026-03-31", "20:39");
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 31);
    assert.equal(d.getHours(), 20);
  });

  // The timezone bug: `new Date("2026-03-31")` is parsed as UTC midnight, so
  // west of Greenwich it lands on the 30th. Reading it as local wall-clock
  // time is what keeps a date field from drifting a day when it is saved.
  it("does not shift an ISO date by the UTC offset", () => {
    const d = parseLocalDateTime("2026-03-31", "00:00");
    assert.equal(d.getDate(), 31);
    assert.equal(d.getMonth(), 2);
  });

  it("handles 12-hour midnight and noon", () => {
    assert.equal(parseLocalDateTime("1/1/2026", "12:00:00 AM").getHours(), 0);
    assert.equal(parseLocalDateTime("1/1/2026", "12:00:00 PM").getHours(), 12);
    assert.equal(parseLocalDateTime("1/1/2026", "12:30:00 AM").getHours(), 0);
  });

  it("rejects dates that do not exist and unparseable input", () => {
    assert.equal(parseLocalDateTime("2/30/2026", "09:00"), null);
    assert.equal(parseLocalDateTime("not a date", "09:00"), null);
    assert.equal(parseLocalDateTime("1/1/2026", "25:00"), null);
    assert.equal(parseLocalDateTime("1/1/2026", "13:00 PM"), null);
    assert.equal(parseLocalDateTime("", "09:00"), null);
  });
});

describe("calculateWorkData", () => {
  it("computes hours and pay for a plain shift", () => {
    const r = calculateWorkData({
      clockInDate: "7/5/2026",
      clockInTime: "8:00:00 AM",
      clockOutDate: "7/5/2026",
      clockOutTime: "4:30:00 PM",
      hourlyRate: 15,
    });
    assert.equal(r.decimalHours, 8.5);
    assert.equal(r.dayPay, 127.5);
    assert.equal(r.totalHours, "8:30:00");
  });

  it("handles a shift that crosses midnight", () => {
    const r = calculateWorkData({
      clockInDate: "3/31/2026",
      clockInTime: "8:39:41 PM",
      clockOutDate: "4/1/2026",
      clockOutTime: "4:14:22 AM",
      hourlyRate: 15,
    });
    assert.equal(r.decimalHours, 7.58);
    assert.equal(r.dayPay, 113.7);
  });

  it("refuses a clock-out that precedes the clock-in", () => {
    assert.throws(() =>
      calculateWorkData({
        clockInDate: "7/5/2026",
        clockInTime: "5:00:00 PM",
        clockOutDate: "7/5/2026",
        clockOutTime: "9:00:00 AM",
        hourlyRate: 15,
      }),
      /before clock-in/
    );
  });

  // A 31.58-hour "shift" is in the real data, from a forgotten clock-out that
  // was then paid out at 410.54. Refusing it is better than pricing it.
  it("refuses a shift longer than the maximum", () => {
    assert.throws(() =>
      calculateWorkData({
        clockInDate: "3/31/2026",
        clockInTime: "8:39:41 PM",
        clockOutDate: "4/2/2026",
        clockOutTime: "4:14:22 AM",
        hourlyRate: 13,
        maxShiftHours: 24,
      }),
      /longer than the 24-hour maximum/
    );
  });

  it("rejects a negative rate", () => {
    assert.throws(() =>
      calculateWorkData({
        clockInDate: "7/5/2026",
        clockInTime: "8:00:00 AM",
        clockOutDate: "7/5/2026",
        clockOutTime: "9:00:00 AM",
        hourlyRate: -5,
      }),
      /negative/
    );
  });

  it("prices a zero-length shift at nothing rather than failing", () => {
    const r = calculateWorkData({
      clockInDate: "7/5/2026",
      clockInTime: "8:00:00 AM",
      clockOutDate: "7/5/2026",
      clockOutTime: "8:00:00 AM",
      hourlyRate: 15,
    });
    assert.equal(r.decimalHours, 0);
    assert.equal(r.dayPay, 0);
  });
});

/**
 * The regression that matters most.
 *
 * admin_edits rows 7 and 8 recorded entry 626 being edited and then reverted
 * to exactly its original times. The hours came back (7.58 -> 31.58 -> 7.58)
 * but the pay did not: 113.70 -> 410.54 -> 98.54, a $15.16 shortfall on a
 * round trip. The cause was the rate, not the arithmetic — the admin page
 * sent its on-screen "Pay Rate" box with every edit, so the day was silently
 * repriced from $15 to $13 while the times went back to where they started.
 */
describe("round-trip edit of entry 626", () => {
  const times = {
    clockInDate: "3/31/2026",
    clockInTime: "8:39:41 PM",
    clockOutDate: "4/1/2026",
    clockOutTime: "4:14:22 AM",
  };

  it("returns to the original pay when the rate is held steady", () => {
    const first = calculateWorkData({ ...times, hourlyRate: 15 });
    const reverted = calculateWorkData({ ...times, hourlyRate: 15 });

    assert.equal(first.decimalHours, 7.58);
    assert.equal(first.dayPay, 113.7);
    assert.equal(reverted.dayPay, first.dayPay);
  });

  it("reproduces the wrong figure only when the rate is allowed to drift", () => {
    // Documents the old behaviour so the cause stays unambiguous: the same
    // hours at $13 is exactly the 98.54 that was recorded.
    assert.equal(calculateWorkData({ ...times, hourlyRate: 13 }).dayPay, 98.54);
    assert.equal(roundCurrency(113.7 - 98.54), 15.16);
  });
});

describe("calculateFromInstants", () => {
  it("derives the stored date and time strings from the two instants", () => {
    const r = calculateFromInstants({
      start: new Date(2026, 2, 31, 20, 39, 41),
      end: new Date(2026, 3, 1, 4, 14, 22),
      hourlyRate: 15,
    });
    assert.equal(r.clockInDate, "2026-03-31");
    assert.equal(r.clockInTime, "20:39:41");
    assert.equal(r.clockOutDate, "2026-04-01");
    assert.equal(r.decimalHours, 7.58);
    assert.equal(r.dayPay, 113.7);
  });
});

describe("formatDuration", () => {
  it("pads minutes and seconds", () => {
    assert.equal(formatDuration(0), "0:00:00");
    assert.equal(formatDuration(3661), "1:01:01");
    assert.equal(formatDuration(27296), "7:34:56");
  });
});

describe("roundCurrency", () => {
  it("rounds half up at the cent and never returns -0", () => {
    assert.equal(roundCurrency(0.005), 0.01);
    assert.equal(roundCurrency(113.695), 113.7);
    assert.equal(roundCurrency(-0), 0);
    assert.equal(roundCurrency("12.344"), 12.34);
    assert.equal(roundCurrency(Number.NaN), 0);
  });
});

/**
 * The Notes-vs-day_pay rule, which commits 402e37a and c4298e1 both landed on
 * the hard way. Pay on the Statistics chart is what was actually paid out,
 * recorded as a Note — never day_pay, which is a running calculation of hours
 * worked so far.
 */
describe("buildEmployeeStats", () => {
  it("takes hours from entries and pay only from notes", () => {
    const rows = buildEmployeeStats(
      [{ month: "7", year: "2026", totalHours: 120.5 }],
      [{ month: "7", year: "2026", notesSum: 1800 }]
    );
    assert.deepEqual(rows, [{ month: "7", year: "2026", totalHours: 120.5, totalPay: 1800 }]);
  });

  it("reports zero pay for a month with hours but no note", () => {
    const rows = buildEmployeeStats([{ month: "8", year: "2026", totalHours: 40 }], []);
    assert.equal(rows[0].totalHours, 40);
    assert.equal(rows[0].totalPay, 0);
  });

  it("never double-counts a month that has both notes and edited entries", () => {
    const rows = buildEmployeeStats(
      [{ month: "7", year: "2026", totalHours: 80 }],
      [{ month: "7", year: "2026", notesSum: 1200 }]
    );
    assert.equal((rows).length, 1);
    assert.equal(rows[0].totalPay, 1200);
  });

  it("keeps a historical payment with no clocked hours on the chart", () => {
    const rows = buildEmployeeStats([], [{ month: "6", year: "2025", notesSum: 900 }]);
    assert.deepEqual(rows, [{ month: "6", year: "2025", totalHours: 0, totalPay: 900 }]);
  });

  it("sorts chronologically across a year boundary", () => {
    const rows = buildEmployeeStats(
      [
        { month: "1", year: "2026", totalHours: 10 },
        { month: "12", year: "2025", totalHours: 20 },
        { month: "2", year: "2026", totalHours: 30 },
      ],
      []
    );
    assert.deepEqual(rows.map((r) => `${r.year}-${r.month}`), ["2025-12", "2026-1", "2026-2"]);
  });
});

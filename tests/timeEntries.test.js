const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createTestContext, signIn } = require("./helpers/testApp");

let ctx;
let admin;
let employee;
let adminCookie;
let employeeCookie;

before(async () => {
  ctx = await createTestContext();
  admin = await ctx.addEmployee({ no: 1, name: "admin", password: "adminpass1", role: "admin" });
  employee = await ctx.addEmployee({ no: 2, name: "Ramana", password: "ramanapass1", hourlyRate: 15 });
  adminCookie = await signIn(request, ctx.app, "admin", "adminpass1");
  employeeCookie = await signIn(request, ctx.app, "Ramana", "ramanapass1");
});

after(async () => ctx?.cleanup());

/**
 * The server is now the only thing that decides what a shift is worth. These
 * tests cover the two ways the old code let a client decide instead.
 */
describe("the clock", () => {
  it("records a shift and prices it from the employee's own rate", async () => {
    await request(ctx.app).post("/clock-in").set("Cookie", employeeCookie).send({}).expect(200);

    const out = await request(ctx.app)
      .post("/clock-out")
      .set("Cookie", employeeCookie)
      .send({})
      .expect(200);

    assert.equal(out.body.entry.hourlyRate, 15);
    // A near-instant shift, so the figures are tiny but must be consistent.
    assert.ok(Math.abs((out.body.entry.dayPay) - (out.body.entry.decimalHours * 15)) < 0.01);

    const row = await ctx.db.get("SELECT * FROM time_entries WHERE id = ?", [out.body.id]);
    assert.equal(row.employee_id, employee.id);
    assert.equal(row.hourly_rate, 15);
  });

  // The old POST /clock-data took decimalHours, hourlyRate and dayPay from
  // the request body and stored them verbatim.
  it("ignores hours, rate and pay sent by the client", async () => {
    await request(ctx.app).post("/clock-in").set("Cookie", employeeCookie).send({}).expect(200);

    const out = await request(ctx.app)
      .post("/clock-out")
      .set("Cookie", employeeCookie)
      .send({ decimalHours: 99, hourlyRate: 500, dayPay: 49500, totalHours: "99:00:00" })
      .expect(200);

    assert.equal(out.body.entry.hourlyRate, 15);
    assert.ok((out.body.entry.decimalHours) < (1));
    assert.ok((out.body.entry.dayPay) < (15));
  });

  it("refuses a clock-out with no shift open", async () => {
    const res = await request(ctx.app)
      .post("/clock-out")
      .set("Cookie", employeeCookie)
      .send({})
      .expect(409);
    assert.match(String(res.body.error), /Not currently clocked in/);
  });

  it("stops an employee clocking in as somebody else", async () => {
    const res = await request(ctx.app)
      .post("/clock-in")
      .set("Cookie", employeeCookie)
      .send({ empName: "admin" })
      .expect(403);
    assert.match(String(res.body.error), /only clock in and out for yourself/);
  });

  it("lets an admin clock someone in on their behalf", async () => {
    await request(ctx.app)
      .post("/clock-in")
      .set("Cookie", adminCookie)
      .send({ empName: "Ramana" })
      .expect(200);
    await request(ctx.app)
      .delete("/clock-in/Ramana")
      .set("Cookie", adminCookie)
      .expect(200);
  });

  it("needs a session at all", async () => {
    await request(ctx.app).post("/clock-in").send({}).expect(401);
    await request(ctx.app).post("/clock-out").send({}).expect(401);
  });
});

/**
 * The $15.16 bug, end to end through the API.
 *
 * admin_edits rows 7 and 8 are an edit of entry 626 and its exact reversal.
 * The hours returned to 7.58 but the pay did not return to 113.70, because
 * the admin page sent its "Pay Rate" filter box with every edit and the
 * handler stored it — repricing the day from $15 to $13 behind the scenes.
 */
describe("admin correction of an entry", () => {
  async function seedEntry626() {
    return ctx.addTimeEntry({
      employeeId: employee.id,
      empName: "Ramana",
      clockInDate: "3/31/2026",
      clockInTime: "8:39:41 PM",
      clockOutDate: "4/1/2026",
      clockOutTime: "4:14:22 AM",
      hourlyRate: 15,
      decimalHours: 7.58,
      dayPay: 113.7,
      month: "3",
      year: "2026",
    });
  }

  it("returns to the original pay when an edit is reversed", async () => {
    const id = await seedEntry626();

    // Move the clock-out an hour later...
    await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({
        clockInDate: "3/31/2026",
        clockInTime: "8:39:41 PM",
        clockOutDate: "4/1/2026",
        clockOutTime: "5:14:22 AM",
        editReason: "employee forgot to clock out",
      })
      .expect(200);

    // ...then put it back exactly where it was.
    const reverted = await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({
        clockInDate: "3/31/2026",
        clockInTime: "8:39:41 PM",
        clockOutDate: "4/1/2026",
        clockOutTime: "4:14:22 AM",
        editReason: "reverting, that was wrong",
      })
      .expect(200);

    assert.equal(reverted.body.entry.decimalHours, 7.58);
    assert.equal(reverted.body.entry.hourlyRate, 15);
    assert.equal(reverted.body.entry.dayPay, 113.7);
  });

  it("does not reprice the day when no rate is supplied", async () => {
    const id = await seedEntry626();

    const res = await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ clockOutTime: "4:14:22 AM", editReason: "no rate in this request" })
      .expect(200);

    assert.equal(res.body.entry.hourlyRate, 15);
    assert.equal(res.body.entry.dayPay, 113.7);
  });

  it("reprices only when the rate is explicitly given", async () => {
    const id = await seedEntry626();

    const res = await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ hourlyRate: 13, editReason: "rate was wrong for this period" })
      .expect(200);

    assert.equal(res.body.entry.hourlyRate, 13);
    assert.equal(res.body.entry.dayPay, 98.54);
  });

  // admin_edits 4 and 5 changed no times at all but moved day_pay from 0.00
  // to 122.40 and 138.60 — entries that had been stored with no rate.
  it("falls back to the employee's rate for an entry stored at zero", async () => {
    const id = await ctx.addTimeEntry({
      employeeId: employee.id,
      empName: "Ramana",
      clockInDate: "10/18/2025",
      clockInTime: "6:03:09 AM",
      clockOutDate: "10/18/2025",
      clockOutTime: "2:12:41 PM",
      hourlyRate: 0,
      decimalHours: 8.16,
      dayPay: 0,
      month: "10",
      year: "2025",
    });

    const res = await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ editReason: "this day was never priced" })
      .expect(200);

    assert.equal(res.body.entry.hourlyRate, 15);
    assert.equal(res.body.entry.dayPay, 122.4);
  });

  it("refuses an edit that produces an impossible shift", async () => {
    const id = await seedEntry626();

    const res = await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ clockOutDate: "4/2/2026", editReason: "forgot to clock out for a day" })
      .expect(400);
    assert.match(String(res.body.error), /longer than the 24-hour maximum/);

    // The stored row is untouched.
    const row = await ctx.db.get("SELECT day_pay FROM time_entries WHERE id = ?", [id]);
    assert.equal(row.day_pay, 113.7);
  });

  it("requires a reason", async () => {
    const id = await seedEntry626();
    const res = await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ clockOutTime: "5:00:00 AM" })
      .expect(400);
    assert.ok((res.body.details.map((d) => d.field)).includes("editReason"));
  });

  it("rejects a bad date or a negative rate instead of coercing it to zero", async () => {
    const id = await seedEntry626();

    await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ clockOutDate: "not a date", editReason: "x" })
      .expect(400);

    await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ hourlyRate: -10, editReason: "x" })
      .expect(400);
  });

  it("404s for an entry that does not exist", async () => {
    await request(ctx.app)
      .put("/api/time-entry/999999")
      .set("Cookie", adminCookie)
      .send({ editReason: "x" })
      .expect(404);
  });

  it("records who made the correction, and is readable back", async () => {
    const id = await seedEntry626();

    await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", adminCookie)
      .send({ clockOutTime: "5:14:22 AM", editReason: "late clock-out" })
      .expect(200);

    const edits = await request(ctx.app)
      .get(`/api/time-entry/${id}/edits`)
      .set("Cookie", adminCookie)
      .expect(200);

    assert.equal((edits.body).length, 1);
    assert.equal(edits.body[0].editedBy, "admin");
    assert.equal(edits.body[0].editReason, "late clock-out");
    assert.equal(edits.body[0].oldDayPay, 113.7);
  });

  it("is admin-only", async () => {
    const id = await seedEntry626();
    await request(ctx.app)
      .put(`/api/time-entry/${id}`)
      .set("Cookie", employeeCookie)
      .send({ editReason: "let me pay myself more" })
      .expect(403);
  });
});

describe("listing entries", () => {
  it("caps how many rows one request can pull", async () => {
    const res = await request(ctx.app)
      .get("/api/time-entries?limit=5")
      .set("Cookie", adminCookie)
      .expect(200);
    assert.ok((res.body.length) <= (5));
  });

  it("rejects a nonsense month or year", async () => {
    await request(ctx.app)
      .get("/api/time-entries?month=13")
      .set("Cookie", adminCookie)
      .expect(400);
    await request(ctx.app)
      .get("/api/time-entries?year=26")
      .set("Cookie", adminCookie)
      .expect(400);
  });
});

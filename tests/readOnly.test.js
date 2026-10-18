const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createTestContext, signIn } = require("./helpers/testApp");

let ctx;
let admin;
let adminCookie;
let entryId;

before(async () => {
  ctx = await createTestContext();
  await ctx.addEmployee({ no: 1, name: "admin", password: "adminpass1", role: "admin" });
  admin = await ctx.addEmployee({ no: 2, name: "Ramana", password: "ramanapass1", hourlyRate: 15 });
  adminCookie = await signIn(request, ctx.app, "admin", "adminpass1");

  // An imported-shaped row: real hours, no rate, no pay — the shape 615 of
  // the 628 live entries are in.
  entryId = await ctx.addTimeEntry({
    employeeId: admin.id,
    empName: "Ramana",
    clockInDate: "3/1/2026",
    decimalHours: 10.49,
    hourlyRate: 0,
    dayPay: 0,
    month: "3",
    year: "2026",
  });
});

after(async () => ctx?.cleanup());

/**
 * The admin page works out the day pay it displays from the hours on each
 * entry and the rate typed into the Pay Rate box, because the stored day_pay
 * is 0 for almost every imported row and would otherwise show $0.00.
 *
 * That projection must stay on screen. An earlier version of the page sent
 * the same box to the server with every edit, which permanently repriced
 * entry 626 from $15/hr to $13/hr. These tests pin the boundary: reading
 * entries never changes what they are priced at.
 */
describe("displaying pay never changes stored pay", () => {
  async function storedPay() {
    const row = await ctx.db.get(
      "SELECT hourly_rate AS rate, day_pay AS pay FROM time_entries WHERE id = ?",
      [entryId]
    );
    return row;
  }

  it("leaves an unpriced entry unpriced however often it is read", async () => {
    const before = await storedPay();
    assert.equal(before.rate, 0);
    assert.equal(before.pay, 0);

    for (const url of [
      "/api/employee-logs?employeeName=Ramana&month=3&year=2026",
      "/api/time-entries?employeeName=Ramana&month=3&year=2026",
      "/api/employee-stats?employeeName=Ramana",
    ]) {
      const r = await request(ctx.app).get(url).set("Cookie", adminCookie);
      assert.equal(r.status, 200, `${url} -> ${JSON.stringify(r.body)}`);
    }

    const after = await storedPay();
    assert.deepEqual(after, before);
  });

  it("serves the hours the projection is built from", async () => {
    const res = await request(ctx.app)
      .get("/api/employee-logs?employeeName=Ramana&month=3&year=2026")
      .set("Cookie", adminCookie)
      .expect(200);

    const entry = res.body.find((e) => e.id === entryId);
    assert.equal(entry.decimalHours, 10.49);
    // $0.00 stored, but the page will show 10.49 x the typed rate.
    assert.equal(entry.dayPay, 0);
    assert.equal(Number((entry.decimalHours * 15).toFixed(2)), 157.35);
  });

  it("still refuses to reprice an entry without an explicit rate", async () => {
    await request(ctx.app)
      .put(`/api/time-entry/${entryId}`)
      .set("Cookie", adminCookie)
      .send({ editReason: "no rate supplied" })
      .expect(200);

    // Falls back to the employee's own rate, never to anything a page sent.
    const after = await storedPay();
    assert.equal(after.rate, 15);
  });
});

/**
 * Express 5 made req.query a getter with no setter, so the validate
 * middleware's plain assignment to it was silently dropped and handlers read
 * the raw querystring instead of the parsed one. Rejection still worked, so
 * the only visible symptom was a handler that needed a default:
 * /api/time-entries got limit = undefined and SQLite answered
 * SQLITE_MISMATCH.
 */
describe("validated query values reach the handler", () => {
  it("applies the default limit when none is given", async () => {
    await request(ctx.app).get("/api/time-entries").set("Cookie", adminCookie).expect(200);
  });

  it("still honours an explicit limit", async () => {
    for (let i = 0; i < 3; i += 1) {
      await ctx.addTimeEntry({
        employeeId: admin.id,
        empName: "Ramana",
        clockInDate: "4/1/2026",
        decimalHours: 8,
        month: "4",
        year: "2026",
      });
    }

    const res = await request(ctx.app)
      .get("/api/time-entries?limit=2")
      .set("Cookie", adminCookie)
      .expect(200);

    assert.equal(res.body.length, 2);
  });

  it("still rejects a limit outside the allowed range", async () => {
    await request(ctx.app).get("/api/time-entries?limit=9999").set("Cookie", adminCookie).expect(400);
    await request(ctx.app).get("/api/time-entries?limit=0").set("Cookie", adminCookie).expect(400);
  });
});

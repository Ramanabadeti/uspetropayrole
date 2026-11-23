const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createTestContext, signIn } = require("./helpers/testApp");

let ctx;
let employee;
let adminCookie;
let employeeCookie;

before(async () => {
  ctx = await createTestContext();
  await ctx.addEmployee({ no: 1, name: "admin", password: "adminpass1", role: "admin" });
  employee = await ctx.addEmployee({ no: 2, name: "Ramana", password: "ramanapass1" });
  adminCookie = await signIn(request, ctx.app, "admin", "adminpass1");
  employeeCookie = await signIn(request, ctx.app, "Ramana", "ramanapass1");
});

after(async () => ctx?.cleanup());

/**
 * A running shift used to be visible only to the person in it. An employee
 * who clocked in at the wrong time, or forgot to clock out, could not be
 * corrected by anyone until the shift closed.
 */
describe("active sessions", () => {
  it("lists who is clocked in, and flags a forgotten clock-out", async () => {
    await request(ctx.app).post("/clock-in").set("Cookie", employeeCookie).send({}).expect(200);

    let res = await request(ctx.app)
      .get("/api/active-sessions")
      .set("Cookie", adminCookie)
      .expect(200);

    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].empName, "Ramana");
    assert.equal(res.body[0].overMaxShift, false);

    // Push the start back over the limit: that is a forgotten clock-out.
    await ctx.db.run(
      "UPDATE active_sessions SET clock_in_full_time = ? WHERE employee_id = ?",
      [new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), employee.id]
    );

    res = await request(ctx.app)
      .get("/api/active-sessions")
      .set("Cookie", adminCookie)
      .expect(200);

    assert.equal(res.body[0].overMaxShift, true);
    assert.ok(res.body[0].hoursSoFar > 24);
  });

  it("corrects the start time of a running shift", async () => {
    const before = await ctx.db.get("SELECT id FROM active_sessions LIMIT 1");

    await request(ctx.app)
      .put(`/api/active-session/${before.id}`)
      .set("Cookie", adminCookie)
      .send({ clockInDate: "2026-11-22", clockInTime: "08:30:00" })
      .expect(200);

    const row = await ctx.db.get("SELECT * FROM active_sessions WHERE id = ?", [before.id]);
    assert.equal(row.in_date, "2026-11-22");
    assert.equal(row.in_time, "08:30:00");
    assert.equal(row.month, "11");
    assert.equal(row.year, "2026");
    assert.ok(row.clock_in_full_time.startsWith("2026-11-22T"));
  });

  it("refuses a start time in the future", async () => {
    const row = await ctx.db.get("SELECT id FROM active_sessions LIMIT 1");
    const nextYear = String(new Date().getFullYear() + 1);

    const res = await request(ctx.app)
      .put(`/api/active-session/${row.id}`)
      .set("Cookie", adminCookie)
      .send({ clockInDate: `${nextYear}-01-01`, clockInTime: "08:00:00" })
      .expect(400);
    assert.match(String(res.body.error), /cannot start in the future/);
  });

  it("is admin-only", async () => {
    await request(ctx.app).get("/api/active-sessions").set("Cookie", employeeCookie).expect(403);
    await request(ctx.app).get("/api/active-sessions").expect(401);

    const row = await ctx.db.get("SELECT id FROM active_sessions LIMIT 1");
    await request(ctx.app)
      .put(`/api/active-session/${row.id}`)
      .set("Cookie", employeeCookie)
      .send({ clockInDate: "2026-11-22", clockInTime: "08:30:00" })
      .expect(403);
  });
});

describe("the software update endpoint", () => {
  // The update itself is deliberately not exercised: it exits the process.
  it("reports the running version to an admin", async () => {
    const res = await request(ctx.app)
      .get("/api/system/version")
      .set("Cookie", adminCookie)
      .expect(200);
    assert.ok(res.body.updateScript);
    assert.equal(typeof res.body.canUpdate, "boolean");
  });

  it("is closed to employees and to anyone signed out", async () => {
    await request(ctx.app).get("/api/system/version").set("Cookie", employeeCookie).expect(403);
    await request(ctx.app).post("/api/system/update").set("Cookie", employeeCookie).expect(403);
    await request(ctx.app).post("/api/system/update").expect(401);
  });
});

/**
 * Removing someone who has left must not take the record of what they were
 * paid with them.
 */
describe("deleting an employee", () => {
  it("keeps their timesheets, under their name", async () => {
    const leaver = await ctx.addEmployee({ no: 3, name: "Mahesh", password: "maheshpass1" });
    const leaverCookie = await signIn(request, ctx.app, "Mahesh", "maheshpass1");
    await request(ctx.app).post("/clock-in").set("Cookie", leaverCookie).send({}).expect(200);
    await request(ctx.app).post("/clock-out").set("Cookie", leaverCookie).send({}).expect(200);

    const res = await request(ctx.app)
      .delete(`/api/employees/${leaver.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    assert.equal(res.body.entriesKept, 1);

    const gone = await ctx.db.get("SELECT id FROM employees WHERE id = ?", [leaver.id]);
    assert.equal(gone, undefined);

    const entry = await ctx.db.get(
      "SELECT emp_name, employee_id FROM time_entries WHERE emp_name = 'Mahesh'"
    );
    assert.ok(entry, "the timesheet entry is still there");
    assert.equal(entry.employee_id, null, "but detached from the deleted record");

    // And their login no longer works.
    await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Mahesh", password: "maheshpass1" })
      .expect(401);
  });

  it("refuses to delete the signed-in account or the last admin", async () => {
    const me = await ctx.db.get("SELECT id FROM employees WHERE name = 'admin'");
    const res = await request(ctx.app)
      .delete(`/api/employees/${me.id}`)
      .set("Cookie", adminCookie)
      .expect(409);
    assert.match(String(res.body.error), /signed in as|only admin/i);
  });

  it("is admin-only", async () => {
    await request(ctx.app)
      .delete(`/api/employees/${employee.id}`)
      .set("Cookie", employeeCookie)
      .expect(403);
  });
});

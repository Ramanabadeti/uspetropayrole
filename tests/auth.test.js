const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createTestContext, signIn } = require("./helpers/testApp");

let ctx;
let adminCookie;
let employeeCookie;

before(async () => {
  ctx = await createTestContext();
  await ctx.addEmployee({ no: 1, name: "admin", password: "adminpass1", role: "admin" });
  await ctx.addEmployee({ no: 2, name: "Ramana", password: "ramanapass1", hourlyRate: 15 });
  await ctx.addEmployee({ no: 3, name: "Gone", password: "gonepass1", active: 0 });

  adminCookie = await signIn(request, ctx.app, "admin", "adminpass1");
  employeeCookie = await signIn(request, ctx.app, "Ramana", "ramanapass1");
});

after(async () => ctx?.cleanup());

describe("sign-in", () => {
  it("accepts correct credentials and sets an httpOnly cookie", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Ramana", password: "ramanapass1" })
      .expect(200);

    assert.equal(res.body.user.name, "Ramana");
    assert.equal(res.body.user.role, "employee");
    assert.match(String(String(res.headers["set-cookie"])), /HttpOnly/i);
  });

  it("is case-insensitive on the username, as the old client-side check was", async () => {
    await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "ramana", password: "ramanapass1" })
      .expect(200);
  });

  it("rejects a wrong password", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Ramana", password: "wrong" })
      .expect(401);
    assert.match(String(res.body.error), /Invalid username or password/);
  });

  // Same message either way, so the form cannot be used to find out who
  // works here.
  it("gives an unknown user the same message as a wrong password", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "whatever" })
      .expect(401);
    assert.match(String(res.body.error), /Invalid username or password/);
  });

  it("refuses a deactivated account", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Gone", password: "gonepass1" })
      .expect(403);
    assert.match(String(res.body.error), /deactivated/);
  });

  it("validates the body", async () => {
    const res = await request(ctx.app).post("/api/auth/login").send({}).expect(400);
    assert.ok((res.body.details.map((d) => d.field)).includes("username"));
  });

  it("never returns a password or hash", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Ramana", password: "ramanapass1" })
      .expect(200);
    const body = JSON.stringify(res.body);
    assert.doesNotMatch(String(body), /ramanapass1/);
    assert.doesNotMatch(String(body), /\$2[aby]\$/);
  });
});

describe("the session", () => {
  it("reports the signed-in user", async () => {
    const res = await request(ctx.app).get("/api/auth/me").set("Cookie", employeeCookie).expect(200);
    assert.equal(res.body.user.name, "Ramana");
  });

  it("401s with no cookie", async () => {
    await request(ctx.app).get("/api/auth/me").expect(401);
  });

  it("stops working after logout", async () => {
    const cookie = await signIn(request, ctx.app, "Ramana", "ramanapass1");
    await request(ctx.app).post("/api/auth/logout").set("Cookie", cookie).expect(200);
    await request(ctx.app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  });
});

/**
 * The headline finding. GET /api/employees used to return every employee's
 * plaintext password to anyone who asked, and the login screen depended on
 * that. Both halves are tested here.
 */
describe("the roster is no longer a credential dump", () => {
  it("requires a session", async () => {
    await request(ctx.app).get("/api/employees").expect(401);
    await request(ctx.app).get("/api/employee-list").expect(401);
  });

  it("never includes a password or hash", async () => {
    const res = await request(ctx.app).get("/api/employees").set("Cookie", adminCookie).expect(200);
    const body = JSON.stringify(res.body);
    assert.doesNotMatch(String(body), /adminpass1|ramanapass1/);
    assert.doesNotMatch(String(body), /\$2[aby]\$/);
    for (const row of res.body) {
      assert.ok(!("password" in row));
      assert.ok(!("passwordHash" in row));
    }
  });

  it("shows an employee only themselves, and an admin everyone", async () => {
    const mine = await request(ctx.app)
      .get("/api/employees")
      .set("Cookie", employeeCookie)
      .expect(200);
    assert.deepEqual(mine.body.map((e) => e.name), ["Ramana"]);

    const all = await request(ctx.app)
      .get("/api/employees")
      .set("Cookie", adminCookie)
      .expect(200);
    assert.ok((all.body.length) > (1));
  });
});

describe("role enforcement", () => {
  it("keeps an employee out of the admin endpoints", async () => {
    await request(ctx.app).get("/api/time-entries").set("Cookie", employeeCookie).expect(403);
    await request(ctx.app)
      .post("/api/employees")
      .set("Cookie", employeeCookie)
      .send({ name: "Sneaky", password: "sneaky12", role: "admin" })
      .expect(403);
    await request(ctx.app)
      .post("/api/admin-notes")
      .set("Cookie", employeeCookie)
      .send({ empName: "Ramana", noteDate: "2026-07-05", amountPaid: 500, month: "7", year: "2026" })
      .expect(403);
  });

  it("stops an employee reading someone else's timesheet", async () => {
    await request(ctx.app)
      .get("/api/employee-logs?employeeName=admin")
      .set("Cookie", employeeCookie)
      .expect(403);
    await request(ctx.app)
      .get("/api/employee-stats?employeeName=admin")
      .set("Cookie", employeeCookie)
      .expect(403);
  });

  it("lets an employee read their own", async () => {
    await request(ctx.app)
      .get("/api/employee-logs?employeeName=Ramana")
      .set("Cookie", employeeCookie)
      .expect(200);
  });
});

describe("changing a password", () => {
  it("requires the current one and then works for the new one", async () => {
    await ctx.addEmployee({ no: 9, name: "Changer", password: "oldpass123" });
    const cookie = await signIn(request, ctx.app, "Changer", "oldpass123");

    await request(ctx.app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "nope", newPassword: "brandnew123" })
      .expect(401);

    await request(ctx.app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "oldpass123", newPassword: "brandnew123" })
      .expect(200);

    await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Changer", password: "oldpass123" })
      .expect(401);
    await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Changer", password: "brandnew123" })
      .expect(200);
  });

  it("refuses a short new password", async () => {
    await request(ctx.app)
      .post("/api/auth/change-password")
      .set("Cookie", employeeCookie)
      .send({ currentPassword: "ramanapass1", newPassword: "short" })
      .expect(400);
  });
});

describe("legacy plaintext passwords", () => {
  // Nobody is locked out if hash-passwords has not been run on a machine:
  // the first successful sign-in upgrades the row and clears the plaintext.
  it("still sign in, and are upgraded to a hash on first use", async () => {
    await ctx.db.run(
      "INSERT INTO employees (emp_no, name, password, role, hourly_rate) VALUES (?, ?, ?, ?, ?)",
      [42, "Legacy", "1234", "employee", 15]
    );

    await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Legacy", password: "1234" })
      .expect(200);

    const row = await ctx.db.get(
      "SELECT password, password_hash FROM employees WHERE name = 'Legacy'"
    );
    assert.equal(row.password, null);
    assert.match(String(row.password_hash), /^\$2[aby]\$/);

    await request(ctx.app)
      .post("/api/auth/login")
      .send({ username: "Legacy", password: "1234" })
      .expect(200);
  });
});

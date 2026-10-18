const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createTestContext } = require("./helpers/testApp");

let ctx;

before(async () => {
  ctx = await createTestContext();
});

after(async () => ctx?.cleanup());

/**
 * The app serves its own frontend, and a browser sends an Origin header for
 * same-origin requests too. An allowlist that did not account for that
 * rejected the app's own origin, and because the rejection was thrown from
 * the cors origin callback it surfaced as a 500 — so every stylesheet and
 * script fetch failed and the page rendered blank. curl never caught it,
 * because curl sends no Origin header at all.
 */
describe("CORS", () => {
  it("allows the app's own origin", async () => {
    const res = await request(ctx.app)
      .get("/api/health")
      .set("Origin", "http://localhost:5050")
      .set("Host", "localhost:5050");
    assert.equal(res.status, 200);
  });

  it("allows a request with no Origin at all", async () => {
    await request(ctx.app).get("/api/health").expect(200);
  });

  it("allows a configured development origin", async () => {
    const res = await request(ctx.app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
  });

  it("serves an unknown origin without CORS headers rather than erroring", async () => {
    const res = await request(ctx.app)
      .get("/api/health")
      .set("Origin", "http://evil.example.com");
    // Not a 500: the response is simply not readable by that origin.
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });
});

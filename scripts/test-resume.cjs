/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { Buffer } = require("node:buffer");
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const js = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("module", "exports", "require", js)(mod, mod.exports, (n) => {
    if (n in mocks) return mocks[n];
    throw Error(n);
  });
  return mod.exports;
}
const {
  createResumeController,
  BACKGROUND_HOME_THRESHOLD_MS: threshold,
  RESUME_LINK_GRACE_MS: grace,
  safeResumeRoutes,
} = load("src/lib/resume/controller.ts");
function clock() {
  let time = 1000;
  return {
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
  };
}
function fixture() {
  const c = clock();
  const r = createResumeController(c.now);
  return {
    ...c,
    r,
    long() {
      r.state("background");
      c.advance(threshold);
      r.state("active");
      c.advance(grace);
    },
  };
}
test("brief background return preserves route", () => {
  const { r, advance } = fixture();
  r.state("background");
  advance(threshold - 1);
  r.state("active");
  advance(grace);
  assert.equal(r.consume("/jobs", false), false);
});
test("long return resets exactly once despite repeated active events", () => {
  const f = fixture();
  f.long();
  assert.equal(f.r.consume("/jobs", false), true);
  f.r.state("active");
  assert.equal(f.r.consume("/jobs", false), false);
});
test("inactive notification shade/dialog does not start an absence", () => {
  const f = fixture();
  f.r.state("inactive");
  f.advance(threshold * 2);
  f.r.state("active");
  assert.equal(f.r.pending(), false);
});
test("repeated background events preserve the first timestamp", () => {
  const f = fixture();
  f.r.state("background");
  f.advance(threshold - 100);
  f.r.state("background");
  f.advance(100);
  f.r.state("active");
  f.advance(grace);
  assert.equal(f.r.consume("/", false), true);
});
test("cold launch does not reset", () => {
  const f = fixture();
  f.advance(threshold);
  f.r.state("active");
  assert.equal(f.r.pending(), false);
});
test("configurable threshold uses controllable clock", () => {
  const c = clock(),
    r = createResumeController(c.now, 20);
  r.state("background");
  c.advance(20);
  r.state("active");
  c.advance(grace);
  assert.equal(r.consume("/", false), true);
});
test("deep link wins before or after active and during grace", () => {
  for (const after of [false, true]) {
    const f = fixture();
    f.r.state("background");
    f.advance(threshold);
    if (!after) f.r.destination();
    f.r.state("active");
    if (after) f.r.destination();
    f.advance(grace);
    assert.equal(f.r.consume("/jobs", false), false);
  }
});
test("link delivery grace defers routing without blocking rendering", () => {
  const f = fixture();
  f.r.state("background");
  f.advance(threshold);
  f.r.state("active");
  assert.equal(f.r.consume("/jobs", false), false);
  f.advance(grace);
  assert.equal(f.r.consume("/jobs", false), true);
});
test("draft/auth/application/settings routes defer reset until safe browsing", () => {
  for (const route of [
    "/community/new",
    "/community/id",
    "/profile",
    "/auth",
    "/account-delete",
    "/account-delete-callback",
    "/circular-jobs/apply",
    "/circular-jobs/id",
    "/cv-maker",
    "/z83",
    "/notifications",
    "/preferences",
    "/settings",
  ]) {
    const f = fixture();
    f.long();
    assert.equal(safeResumeRoutes.has(route), false);
    assert.equal(f.r.consume(route, false), false);
    assert.equal(f.r.pending(), true);
    assert.equal(f.r.consume("/jobs", false), true);
  }
});
test("fullscreen ad, consent and permission flow suppress their background cycle", () => {
  const f = fixture();
  f.r.state("background", true);
  f.advance(threshold * 2);
  f.r.state("active");
  assert.equal(f.r.pending(), false);
});
test("busy foreground blocks consumption; release does not reset twice", () => {
  const f = fixture();
  f.long();
  assert.equal(f.r.consume("/", true), false);
  assert.equal(f.r.consume("/", false), true);
  assert.equal(f.r.consume("/", false), false);
});
test("account change / disposal cancels pending routing", () => {
  const f = fixture();
  f.long();
  f.r.cancel();
  assert.equal(f.r.consume("/", false), false);
});
test("new absence is independent of old notification priority", () => {
  const f = fixture();
  f.r.destination();
  f.long();
  assert.equal(f.r.consume("/", false), true);
});
test("native auth refresh uses supported hints, no logout or explicit session restore", async () => {
  const calls = [];
  const { nativeAuthState } = load("src/lib/resume/auth-refresh.ts");
  const auth = {
    startAutoRefresh: async () => {
      calls.push("start");
      throw Error("offline");
    },
    stopAutoRefresh: async () => {
      calls.push("stop");
    },
  };
  for (const state of ["active", "inactive", "background", "active"])
    nativeAuthState(auth, state);
  await Promise.resolve();
  assert.deepEqual(calls, ["start", "stop", "stop", "start"]);
});
const { createOwnerCache } = load("src/lib/circular/state.ts");
test("expired list cache remains available while revalidating, owner scoped and bounded to one hour", () => {
  const c = clock(),
    cache = createOwnerCache(c.now),
    data = { items: [{ id: "1" }] };
  cache.set("alice", "/list", data);
  c.advance(300001);
  assert.equal(cache.get("alice", "/list"), undefined);
  assert.equal(cache.peek("alice", "/list"), data);
  assert.equal(cache.peek("bob", "/list"), undefined);
  c.advance(55 * 60000);
  assert.equal(cache.peek("alice", "/list"), undefined);
});
test("cache clear removes stale private records; empty responses never revive old jobs", () => {
  const cache = createOwnerCache();
  cache.set("a", "p", { items: [1] });
  cache.set("a", "p", { items: [] });
  assert.equal(cache.peek("a", "p"), undefined);
  cache.set("a", "p", { items: [1] });
  cache.clear();
  assert.equal(cache.peek("a", "p"), undefined);
});
test("cache memory cap evicts oldest keys", () => {
  const cache = createOwnerCache();
  for (let i = 0; i < 101; i++) cache.set("a", String(i), { items: [i] });
  assert.equal(cache.peek("a", "0"), undefined);
  assert.ok(cache.peek("a", "100"));
});
const events = load("src/lib/resume/events.ts");
test("resume events unsubscribe cleanly and do not call advertising session methods", () => {
  let homes = 0,
    links = 0;
  const a = events.subscribeHomeResume(() => homes++),
    b = events.subscribeResumeDestination(() => links++);
  events.refreshResumedHome();
  events.prioritizeResumeDestination();
  a();
  b();
  events.refreshResumedHome();
  events.prioritizeResumeDestination();
  assert.deepEqual([homes, links], [1, 1]);
});

test("timing diagnostics measure body/network separately without credentials", async () => {
  const diagnostics = load("src/lib/circular/diagnostics.ts");
  assert.equal(diagnostics.utf8Bytes("aé🙂"), 7);
  let now = 0;
  const trace = [];
  const { createCircularTransport } = load("src/lib/circular/transport.ts", {
    "./diagnostics": diagnostics,
    "./response": load("src/lib/circular/response.ts"),
  });
  const session = { access_token: "fixture-secret", user: { id: "alice" } };
  const payload = {
    items: [{ id: "one", post_title: "Clerk" }],
    page: 1,
    page_size: 20,
    total: 1,
    has_more: false,
  };
  const transport = createCircularTransport(
    {
      getSession: async () => ({ data: { session } }),
      refreshSession: async () => ({ data: { session } }),
    },
    async () => {
      now += 120;
      return {
        status: 200,
        ok: true,
        text: async () => {
          now += 3;
          return JSON.stringify(payload);
        },
      };
    },
    () => now,
    (entry) => trace.push(entry),
  );
  await transport.request("alice", "/circular-jobs?page=1&page_size=20");
  assert.equal(trace[0].headersMs, 120);
  assert.equal(trace[0].bodyMs, 3);
  assert.equal(trace[0].parseMs, 0);
  assert.equal(trace[0].requestMs, 123);
  assert.equal(trace[0].itemCount, 1);
  assert.equal(
    trace[0].payloadBytes,
    Buffer.byteLength(JSON.stringify(payload)),
  );
  assert.equal(JSON.stringify(trace).includes("fixture-secret"), false);
});

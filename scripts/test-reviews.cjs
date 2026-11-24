const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load, hooks } = require("./resume-fixture.cjs");
const { createReviewController, REVIEW_POLICY } = load(
  "src/lib/reviews/controller.ts",
  {},
);
const DAY = 86400000;
function fixture(seed = {}, overrides = {}) {
  let now = Date.parse("2026-11-24T10:00:00Z"),
    available = true,
    writable = true,
    readable = true;
  let value = JSON.stringify({
    v: 1,
    firstSeen: now - 8 * DAY,
    sessions: 2,
    actions: 1,
    attempts: [],
    manualAt: 0,
    ...seed,
  });
  const calls = [];
  const port = {
    supported: true,
    version: "1.0.2",
    now: () => now,
    read: async () => {
      if (!readable) throw Error("storage");
      return value;
    },
    write: async (s) => {
      if (!writable) throw Error("storage");
      value = s;
      calls.push("write");
    },
    available: async () => {
      calls.push("available");
      return available;
    },
    request: async (guard) => {
      assert.equal(guard(), true);
      assert.equal(JSON.parse(value).attempts.length > 0, true);
      calls.push("request");
    },
    ...overrides,
  };
  const controller = createReviewController(port);
  return {
    controller,
    port,
    calls,
    read: () => JSON.parse(value),
    raw: (s) => (value = s),
    advance: (ms) => (now += ms),
    available: (b) => (available = b),
    writable: (b) => (writable = b),
    readable: (b) => (readable = b),
  };
}
async function qualify(f) {
  await f.controller.startSession();
  await f.controller.positive("saved:fixture");
}
test("fresh installs never prompt on open; engagement needs seven days, three sessions and two meaningful actions", async () => {
  const f = fixture({
    firstSeen: Date.parse("2026-11-24T10:00:00Z"),
    sessions: 0,
    actions: 0,
  });
  await qualify(f);
  assert.equal(f.controller.hasPending(), false);
  assert.equal(await f.controller.tryRequest(() => true), false);
  assert.equal(f.calls.includes("request"), false);
  for (const seed of [
    { sessions: 0 },
    { actions: 0 },
    { firstSeen: Date.parse("2026-11-24T10:00:00Z") - 6 * DAY },
  ]) {
    const x = fixture(seed);
    await qualify(x);
    assert.equal(x.controller.hasPending(), false);
  }
});
test("a qualified fresh milestone requests native UI only once, persisting intent first without recording a rating", async () => {
  const f = fixture();
  await qualify(f);
  assert.equal(f.controller.hasPending(), true);
  assert.equal(await f.controller.tryRequest(() => true), true);
  assert.equal(await f.controller.tryRequest(() => true), false);
  assert.equal(f.calls.filter((x) => x === "request").length, 1);
  assert.equal(f.read().attempts[0].version, "1.0.2");
  assert.equal("rated" in f.read(), false);
  assert.equal("stars" in f.read(), false);
});
test("same-version attempts, the 90-day cooldown and rolling three-per-year limit all suppress automatic prompts", async () => {
  const now = Date.parse("2026-11-24T10:00:00Z");
  for (const attempts of [
    [{ at: now - 100 * DAY, version: "1.0.2" }],
    [{ at: now - 20 * DAY, version: "1.0.1" }],
    [
      { at: now - 300 * DAY, version: "old-a" },
      { at: now - 190 * DAY, version: "old-b" },
      { at: now - 95 * DAY, version: "old-c" },
    ],
  ]) {
    const f = fixture({ firstSeen: now - 500 * DAY, attempts });
    await qualify(f);
    assert.equal(f.controller.hasPending(), false);
    assert.equal(await f.controller.tryRequest(() => true), false);
  }
  const allowed = fixture({
    attempts: [{ at: now - 91 * DAY, version: "old" }],
  });
  await qualify(allowed);
  assert.equal(await allowed.controller.tryRequest(() => true), true);
});
test("session startup is idempotent across root remounts; long real background returns count once", async () => {
  const f = fixture();
  await Promise.all([f.controller.startSession(), f.controller.startSession()]);
  assert.equal(f.read().sessions, 3);
  await f.controller.resumeSession(5 * 60000);
  assert.equal(f.read().sessions, 3);
  f.advance(31 * 60000);
  await f.controller.resumeSession(31 * 60000);
  await f.controller.resumeSession(31 * 60000);
  assert.equal(f.read().sessions, 4);
});
test("success keys deduplicate in memory and never persist job or user identifiers", async () => {
  const f = fixture();
  await f.controller.startSession();
  await Promise.all([
    f.controller.positive("private-job-id"),
    f.controller.positive("private-job-id"),
  ]);
  assert.equal(f.read().actions, 2);
  assert.equal(JSON.stringify(f.read()).includes("private-job-id"), false);
});
test("pending milestones expire and never replay across account/background/deep-link clearing", async () => {
  const f = fixture();
  await qualify(f);
  f.advance(REVIEW_POLICY.pendingMs + 1);
  assert.equal(await f.controller.tryRequest(() => true), false);
  await f.controller.positive("second");
  f.controller.clearPending();
  assert.equal(await f.controller.tryRequest(() => true), false);
});
test("unavailable native review never redirects automatically or consumes the request quota", async () => {
  const f = fixture();
  f.available(false);
  await qualify(f);
  assert.equal(await f.controller.tryRequest(() => true), false);
  assert.equal(f.read().attempts.length, 0);
  assert.equal(f.controller.hasPending(), false);
  assert.equal(f.calls.includes("request"), false);
});
test("storage read/write failure and corrupt records fail quietly without a native prompt", async () => {
  for (const mode of ["read", "write", "corrupt"]) {
    const f = fixture();
    if (mode === "read") f.readable(false);
    if (mode === "write") f.writable(false);
    if (mode === "corrupt") f.raw("{bad");
    await qualify(f);
    assert.equal(await f.controller.tryRequest(() => true), false);
    assert.equal(f.calls.includes("request"), false);
  }
});
test("concurrent requests and route changes while checking availability cannot create duplicate or late prompts", async () => {
  let resolve;
  const ready = new Promise((r) => (resolve = r));
  let safe = true;
  const f = fixture({}, { available: () => ready });
  await qualify(f);
  const pending = f.controller.tryRequest(() => safe);
  await Promise.resolve();
  assert.equal(await f.controller.tryRequest(() => true), false);
  safe = false;
  resolve(true);
  assert.equal(await pending, false);
  assert.equal(f.calls.includes("request"), false);
});
test("manual store intent suppresses automatic prompts without claiming the user rated the app", async () => {
  const f = fixture();
  await qualify(f);
  f.controller.manualAttempt();
  assert.equal(f.controller.hasPending(), false);
  await f.controller.positive("next");
  assert.equal(await f.controller.tryRequest(() => true), false);
  assert.ok(f.read().manualAt > 0);
});
test("native errors consume an attempt rather than retrying repeatedly or blocking the app", async () => {
  const f = fixture(
    {},
    {
      request: async () => {
        throw Error("OS failure");
      },
    },
  );
  await qualify(f);
  assert.equal(await f.controller.tryRequest(() => true), false);
  assert.equal(f.read().attempts.length, 1);
  assert.equal(f.controller.hasPending(), false);
});
function runtimeFixture(os = "android", modulePresent = false, sdk = null) {
  const calls = [];
  let failMarket = false;
  const controller = { manualAttempt: () => calls.push("manual") };
  let captured;
  const runtime = load("src/lib/reviews/runtime.ts", {
    "../../ads/fullscreen-lock": {
      fullscreenLock: {
        tryAcquire: () => {
          calls.push("acquire");
          return true;
        },
        release: () => {
          calls.push("release");
        },
      },
    },
    "@react-native-async-storage/async-storage": {
      getItem: async () => null,
      setItem: async () => {},
    },
    "expo-constants": { nativeAppVersion: "1.0.2" },
    "expo-store-review": sdk,
    expo: {
      requireOptionalNativeModule: (name) => {
        calls.push(name);
        return modulePresent
          ? { requestReview() {}, isAvailableAsync() {} }
          : null;
      },
    },
    "react-native": {
      Platform: { OS: os },
      Linking: {
        openURL: async (url) => {
          calls.push(url);
          if (failMarket && url.startsWith("market:"))
            throw Error("No Play Store");
        },
      },
    },
    "../runtime-environment": { isExpoGo: false },
    "./controller": {
      createReviewController: (port) => {
        captured = port;
        return controller;
      },
    },
    "./store-links": load("src/lib/reviews/store-links.ts", {}),
  });
  return {
    runtime,
    calls,
    port: () => captured,
    failMarket: () => (failMarket = true),
  };
}
test("manual Android button opens this app directly and falls back to HTTPS when Play Store is missing", async () => {
  const f = runtimeFixture();
  f.failMarket();
  await f.runtime.openReviewStore("android");
  assert.equal(f.calls[0], "manual");
  assert.match(f.calls[1], /^market:\/\/details\?id=com.first.firstjobly/);
  assert.match(
    f.calls[2],
    /^https:\/\/play.google.com\/store\/apps\/details\?id=com.first.firstjobly/,
  );
  assert.equal(f.calls.includes("ExpoStoreReview"), false);
});
test("manual iOS button uses the real write-review link; older binaries safely report automatic API unavailable", async () => {
  const f = runtimeFixture("ios");
  await f.runtime.openReviewStore("ios");
  assert.ok(
    f.calls.includes(
      "https://apps.apple.com/app/id6834798190?action=write-review",
    ),
  );
  assert.equal(await f.port().available(), false);
});
test("web disables automatic native reviews but keeps explicit store links usable", async () => {
  const f = runtimeFixture("web");
  assert.equal(f.port().supported, false);
  assert.equal(await f.port().available(), false);
  await f.runtime.openReviewStore("android");
  assert.equal(
    f.calls.some((x) => x.startsWith("https://play.google.com/")),
    true,
  );
});
function lifecycleFixture(t, pathname = "/") {
  t.mock.timers.enable({
    apis: ["setTimeout", "Date"],
    now: Date.parse("2026-11-24T10:00:00Z"),
  });
  const h = hooks();
  let pending = false,
    requests = 0,
    blocked = false,
    typing = false,
    consent = false,
    reminder = false;
  let success, touch, appChange, link, scroll;
  const notify = new Set();
  const subscribe = (fn) => {
    notify.add(fn);
    return () => notify.delete(fn);
  };
  const app = {
    currentState: "active",
    addEventListener: (_, fn) => {
      appChange = fn;
      return { remove() {} };
    },
  };
  const controller = {
    clearPending: () => {
      pending = false;
      notify.forEach((fn) => fn());
    },
    hasPending: () => pending,
    startSession: async () => {},
    resumeSession: async () => {},
    positive: async () => {
      pending = true;
    },
    subscribe,
    tryRequest: async (guard) => {
      if (pending && guard()) {
        requests++;
        pending = false;
        return true;
      }
      return false;
    },
  };
  const m = load("src/components/review-lifecycle.tsx", {
    react: h.react,
    "react-native": {
      AppState: app,
      Keyboard: { addListener: () => ({ remove() {} }) },
      Linking: {
        addEventListener: (_, fn) => {
          link = fn;
          return { remove() {} };
        },
      },
      TextInput: { State: { currentlyFocusedInput: () => typing } },
    },
    "../ads/viewport-events": {
      subscribeAdViewportChanges: (fn) => {
        scroll = fn;
        return () => {};
      },
    },
    "../ads/fullscreen-lock": {
      fullscreenLock: { canAcquire: () => !blocked, subscribe },
    },
    "../ads/privacy": {
      adsPrivacy: {
        getSnapshot: () => ({ presenting: consent, lastUiAt: 0 }),
        subscribe,
      },
    },
    "../lib/reminders/runtime": {
      weeklyReminders: { getSnapshot: () => ({ busy: reminder }), subscribe },
    },
    "../lib/reviews/runtime": { reviewPrompts: controller },
    "../lib/reviews/events": {
      subscribeReviewSuccess: (fn) => {
        success = fn;
        return () => {};
      },
      subscribeReviewInteraction: (fn) => {
        touch = fn;
        return () => {};
      },
    },
  });
  const props = { ready: true, pathname, userId: "alice" };
  const render = () => h.render(() => m.ReviewLifecycle(props));
  render();
  t.after(() => h.dispose());
  return {
    props,
    render,
    requests: () => requests,
    notify: () => notify.forEach((fn) => fn()),
    positive: async () => {
      success("saved");
      await Promise.resolve();
    },
    touch: () => touch(),
    scroll: () => scroll(),
    blocked: (b) => (blocked = b),
    typing: (b) => (typing = b),
    consent: (b) => (consent = b),
    reminder: (b) => (reminder = b),
    state: (s) => {
      app.currentState = s;
      appChange(s);
    },
    link: () => link(),
  };
}
test("coordinator never prompts on launch; a fresh milestone prompts only after idle Home", async (t) => {
  const f = lifecycleFixture(t);
  t.mock.timers.tick(20000);
  assert.equal(f.requests(), 0);
  await f.positive();
  t.mock.timers.tick(4999);
  assert.equal(f.requests(), 0);
  t.mock.timers.tick(1);
  assert.equal(f.requests(), 1);
  t.mock.timers.tick(20000);
  assert.equal(f.requests(), 1);
});
test("coordinator waits out ad/keyboard/consent/reminder blockers and resets idle time on interaction", async (t) => {
  const f = lifecycleFixture(t);
  await f.positive();
  for (const blocker of ["blocked", "typing", "consent", "reminder"]) {
    f[blocker](true);
    t.mock.timers.tick(5000);
    await Promise.resolve();
    assert.equal(f.requests(), 0);
    f[blocker](false);
  }
  f.touch();
  t.mock.timers.tick(4999);
  assert.equal(f.requests(), 0);
  t.mock.timers.tick(1);
  assert.equal(f.requests(), 1);
});
test("sensitive routes, backgrounding, account changes and deep links prevent queued prompts", async (t) => {
  const f = lifecycleFixture(t, "/circular-jobs/apply");
  await f.positive();
  t.mock.timers.tick(20000);
  assert.equal(f.requests(), 0);
  f.props.pathname = "/";
  f.render();
  f.state("background");
  f.state("active");
  t.mock.timers.tick(10000);
  assert.equal(f.requests(), 0);
  await f.positive();
  f.link();
  t.mock.timers.tick(10000);
  assert.equal(f.requests(), 0);
  await f.positive();
  f.props.userId = "bob";
  f.render();
  t.mock.timers.tick(10000);
  assert.equal(f.requests(), 0);
});

test("native request rechecks the live guard after async availability and does not seize an ad lock on a stale route", async () => {
  let resolve;
  const availability = new Promise((r) => (resolve = r));
  let safe = true,
    requests = 0;
  const f = runtimeFixture("android", true, {
    isAvailableAsync: () => availability,
    requestReview: async () => requests++,
  });
  const pending = f.port().request(() => safe);
  await Promise.resolve();
  safe = false;
  resolve(true);
  await pending;
  assert.equal(requests, 0);
  assert.equal(f.calls.includes("acquire"), false);
});
test("a stalled native review callback releases its reservation and queue after the safety deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish;
  const request = new Promise((r) => (finish = r));
  const f = runtimeFixture("android", true, {
    isAvailableAsync: async () => true,
    requestReview: () => request,
  });
  const pending = f.port().request(() => true);
  await new Promise((r) => setImmediate(r));
  assert.equal(f.calls.includes("acquire"), true);
  t.mock.timers.tick(60000);
  await pending;
  assert.equal(f.calls.filter((x) => x === "release").length, 1);
  finish();
  await Promise.resolve();
  assert.equal(f.calls.filter((x) => x === "release").length, 1);
});
test("review links and shipped store configuration identify the real FirstJobly listings", () => {
  const config = require("../app.json").expo;
  const links = load("src/lib/reviews/store-links.ts", {});
  assert.equal(config.ios.appStoreUrl, links.APP_STORE_URL);
  assert.equal(config.android.playStoreUrl, links.PLAY_STORE_URL);
  assert.equal(config.ios.supportsTablet, true);
});

test("inertial scrolling postpones the idle Home prompt until scrolling has settled", async (t) => {
  const f = lifecycleFixture(t);
  await f.positive();
  t.mock.timers.tick(4000);
  f.scroll();
  t.mock.timers.tick(4000);
  f.scroll();
  assert.equal(f.requests(), 0);
  t.mock.timers.tick(4999);
  assert.equal(f.requests(), 0);
  t.mock.timers.tick(1);
  assert.equal(f.requests(), 1);
});

test("very slow storage cannot turn an old milestone into a fresh automatic request", async () => {
  const f = fixture();
  await f.controller.startSession();
  let resolve;
  f.port.write = () => new Promise((r) => (resolve = r));
  const saved = f.controller.positive("old-save");
  await new Promise((r) => setImmediate(r));
  f.advance(REVIEW_POLICY.pendingMs + 1);
  resolve();
  await saved;
  assert.equal(f.controller.hasPending(), false);
});
test("optional review observers cannot break a completed action or touch handler", () => {
  const events = load("src/lib/reviews/events.ts", {});
  let received = 0;
  const cleanup = events.subscribeReviewSuccess(() => {
    throw Error("observer");
  });
  const cleanup2 = events.subscribeReviewSuccess(() => received++);
  events.recordReviewSuccess("saved");
  assert.equal(received, 1);
  const touch = events.subscribeReviewInteraction(() => {
    throw Error("observer");
  });
  assert.doesNotThrow(() => events.recordReviewInteraction());
  cleanup();
  cleanup2();
  touch();
});

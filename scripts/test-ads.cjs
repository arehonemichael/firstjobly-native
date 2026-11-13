/* global __dirname */
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { load } = require("./ads-load.cjs");
const { createAdConsent } = load("src/ads/consent-controller.ts");
const { createAppOpenController } = load("src/ads/app-open-controller.ts");
const { createFullscreenLock } = load("src/ads/fullscreen-lock.ts");
const { ADS_CONFIG, shouldInsertNative } = load("src/ads/config.ts");
const { createInterstitialManager } = load("src/ads/interstitial-manager.ts");
const { createAdRecovery, loadNativeWithTimeout } = load("src/ads/recovery.ts");
const tick = () => new Promise((r) => setImmediate(r));
function privacy({
  status = "NOT_REQUIRED",
  canRequestAds = true,
  refused = false,
  error = false,
} = {}) {
  const calls = { info: 0, form: 0, initialize: 0 };
  const info = {
    status,
    canRequestAds,
    privacyOptionsRequirementStatus: "REQUIRED",
  };
  const port = {
    requestInfoUpdate: async () => {
      calls.info++;
      if (error) throw Error("missing form");
      return info;
    },
    showFormIfRequired: async () => {
      calls.form++;
      return { ...info, status: "OBTAINED", canRequestAds: true };
    },
    showPrivacyOptions: async () => ({ ...info, status: "OBTAINED" }),
    choices: async () => ({
      storeAndAccessInformationOnDevice: !refused,
      selectBasicAds: !refused,
    }),
    initialize: async () => {
      calls.initialize++;
    },
  };
  return { calls, port, control: createAdConsent(port) };
}
test("consent is gathered once; SDK initialization follows provider permission", async () => {
  const p = privacy();
  await Promise.all([
    p.control.prepare(() => true),
    p.control.prepare(() => true),
  ]);
  assert.equal(p.calls.info, 1);
  assert.equal(p.calls.initialize, 1);
  assert.equal(p.control.getSnapshot().canRequestAds, true);
});
test("consent refusal, missing configuration, and unsupported SDK never initialize/request ads", async () => {
  for (const opts of [
    { status: "OBTAINED", refused: true },
    { canRequestAds: false },
    { error: true },
  ]) {
    const p = privacy(opts);
    await p.control.prepare(() => true);
    assert.equal(p.calls.initialize, 0);
    assert.equal(p.control.getSnapshot().canRequestAds, false);
  }
  const p = createAdConsent(null);
  await p.prepare(() => true);
  assert.equal(p.getSnapshot().supported, false);
});
test("required consent uses the provider form; leaving Home defers its presentation", async () => {
  const p = privacy({ status: "REQUIRED" });
  await p.control.prepare(() => false);
  assert.equal(p.calls.form, 0);
  await p.control.prepare(() => true);
  assert.equal(p.calls.form, 1);
  assert.equal(p.control.getSnapshot().canRequestAds, true);
});
test("privacy choices can revoke an already granted permission", async () => {
  const p = privacy();
  await p.control.prepare(() => true);
  p.port.choices = async () => ({
    storeAndAccessInformationOnDevice: false,
    selectBasicAds: false,
  });
  await p.control.openPrivacy(() => true);
  assert.equal(p.control.getSnapshot().canRequestAds, false);
});
function lifecycle({ count = 2, last = 0 } = {}) {
  let time = Date.parse("2026-11-12T10:00:00Z");
  const ads = [],
    stored = new Map([
      ["fj_admob_launch_count", String(count)],
      ["fj_admob_last_app_open", String(last)],
    ]);
  const queue = new Set();
  const flush = () => {
    for (const f of [...queue]) {
      queue.delete(f);
      f();
    }
  };
  const control = createAppOpenController({
    schedule: (action) => {
      queue.add(action);
      return () => queue.delete(action);
    },
    now: () => time,
    lock: createFullscreenLock(ADS_CONFIG.fullscreenMinGapMs, () => time),
    storage: {
      getItem: async (k) => stored.get(k) ?? null,
      setItem: async (k, v) => {
        stored.set(k, v);
      },
    },
    createAd: () => {
      const handlers = new Map();
      const ad = {
        loads: 0,
        shows: 0,
        removed: 0,
        reject: false,
        load() {
          this.loads++;
        },
        show() {
          this.shows++;
          return this.reject
            ? Promise.reject(Error("presentation failed"))
            : Promise.resolve();
        },
        removeAllListeners() {
          this.removed++;
          handlers.clear();
        },
        addAdEventListener(e, f) {
          handlers.set(e, f);
          return () => handlers.delete(e);
        },
        emit(e) {
          handlers.get(e)?.();
        },
      };
      ads.push(ad);
      return ad;
    },
  });
  return {
    control,
    ads,
    flush,
    advance(ms) {
      time += ms;
    },
    resume() {
      control.onState("background");
      time += 2000;
      control.onState("active");
      flush();
    },
  };
}
async function ready(options) {
  const f = lifecycle(options);
  f.control.setContext({ eligible: true, consent: true });
  await f.control.initialize();
  f.ads[0].emit("loaded");
  return f;
}
test("app-open preloads without showing on cold startup, then shows once per eligible resume", async () => {
  const f = await ready();
  assert.equal(f.ads[0].shows, 0);
  f.resume();
  f.control.onState("active");
  assert.equal(f.ads[0].shows, 1);
  f.ads[0].emit("closed");
  f.ads[1].emit("loaded");
  f.control.onState("inactive");
  f.control.onState("active");
  f.resume();
  assert.equal(
    f.ads.reduce((n, a) => n + a.shows, 0),
    1,
  );
  f.control.dispose();
});
test("not-ready/no-fill events continue immediately; a later load never presents late", async () => {
  const f = lifecycle();
  f.control.setContext({ eligible: true, consent: true });
  await f.control.initialize();
  f.resume();
  f.control.markInteraction();
  f.ads[0].emit("loaded");
  assert.equal(f.ads[0].shows, 0);
  f.control.onState("active");
  assert.equal(f.ads[0].shows, 0);
  f.control.dispose();
});
test("expired app-open inventory is replaced without showing during that event", async () => {
  const f = await ready();
  f.advance(12600000);
  f.resume();
  assert.equal(f.ads[0].shows, 0);
  assert.ok(f.ads[0].removed > 0);
  assert.equal(f.ads.length, 2);
  f.control.dispose();
});
test("auth/onboarding/application routes, consent refusal, first launches and cooldown block presentation", async () => {
  for (const type of ["route", "consent", "launches", "cooldown"]) {
    const f = await ready(
      type === "launches"
        ? { count: 0 }
        : type === "cooldown"
          ? { last: Date.parse("2026-11-12T09:59:00Z") }
          : {},
    );
    if (type === "route")
      f.control.setContext({ eligible: false, consent: true });
    if (type === "consent")
      f.control.setContext({ eligible: true, consent: false });
    f.resume();
    assert.equal(f.ads[0].shows, 0);
    f.control.dispose();
  }
});
test("ad failure/dismissal clean up and never retry presentation in the same foreground", async () => {
  const f = await ready();
  f.ads[0].reject = true;
  f.resume();
  await tick();
  assert.equal(f.control.getDebugState().showing, false);
  assert.equal(f.ads[0].shows, 1);
  f.ads[1].emit("loaded");
  f.control.onState("active");
  assert.equal(f.ads[1].shows, 0);
  f.control.dispose();
});
test("brief background and inactive-only returns do not show app-open ads", async () => {
  const f = await ready();
  f.control.onState("inactive");
  f.control.onState("active");
  f.control.onState("background");
  f.advance(100);
  f.control.onState("active");
  assert.equal(f.ads[0].shows, 0);
  f.control.dispose();
});

test("foreground URL, navigation and interaction races cancel an otherwise ready app-open ad", async () => {
  for (const event of ["url", "touch", "route", "background", "late"]) {
    const f = await ready();
    f.control.onState("background");
    f.advance(2000);
    f.control.onState("active");
    if (event === "url" || event === "touch") f.control.markInteraction();
    if (event === "route")
      f.control.setContext({ eligible: false, consent: true });
    if (event === "background") f.control.onState("background");
    if (event === "late") f.advance(201);
    f.flush();
    assert.equal(f.ads[0].shows, 0);
    f.control.dispose();
  }
});

function fakeAd() {
  const handlers = new Map();
  return {
    loads: 0,
    shows: 0,
    removed: 0,
    reject: false,
    throws: false,
    load() {
      this.loads++;
    },
    show() {
      this.shows++;
      if (this.throws) throw Error("synchronous presentation failure");
      return this.reject
        ? Promise.reject(Error("presentation failure"))
        : Promise.resolve();
    },
    removeAllListeners() {
      this.removed++;
      handlers.clear();
    },
    addAdEventListener(event, fn) {
      handlers.set(event, fn);
      return () => handlers.delete(event);
    },
    emit(event) {
      handlers.get(event)?.();
    },
  };
}
function interstitial(t, override = {}) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10000000 });
  let allowed = true;
  const ads = [],
    lock = createFullscreenLock(ADS_CONFIG.fullscreenMinGapMs);
  const manager = createInterstitialManager(
    {
      permitted: () => allowed,
      events: {
        LOADED: "loaded",
        OPENED: "opened",
        CLOSED: "closed",
        ERROR: "error",
      },
      createAd() {
        const ad = fakeAd();
        ads.push(ad);
        return ad;
      },
    },
    { ...ADS_CONFIG.interstitial, ...override },
    lock,
  );
  t.after(() => {
    allowed = false;
    manager._test.reset();
  });
  manager.prepare();
  return {
    manager,
    ads,
    lock,
    deny() {
      allowed = false;
      manager.revoke();
    },
  };
}
function third(f, proceed) {
  f.ads[0].emit("loaded");
  f.manager.onJobOpen(() => {});
  f.manager.onJobOpen(() => {});
  f.manager.onJobOpen(proceed);
}
for (const event of [
  "closed",
  "error",
  "rejected",
  "throw",
  "start-timeout",
  "safety-timeout",
]) {
  test(`interstitial proceeds exactly once after ${event}`, async (t) => {
    const f = interstitial(t);
    let proceeds = 0;
    if (event === "rejected") f.ads[0].reject = true;
    if (event === "throw") f.ads[0].throws = true;
    third(f, () => proceeds++);
    if (event === "safety-timeout") f.ads[0].emit("opened");
    if (event === "closed" || event === "error") {
      f.ads[0].emit("opened");
      f.ads[0].emit(event);
    }
    if (event === "start-timeout")
      t.mock.timers.tick(ADS_CONFIG.interstitial.startTimeoutMs);
    if (event === "safety-timeout")
      t.mock.timers.tick(ADS_CONFIG.interstitial.safetyTimeoutMs);
    await tick();
    f.ads[0].emit("closed");
    f.ads[0].emit("error");
    t.mock.timers.tick(ADS_CONFIG.interstitial.safetyTimeoutMs);
    assert.equal(proceeds, 1);
    assert.equal(f.lock.isHeld(), false);
    assert.equal(f.ads[0].removed, 1);
    assert.equal(f.ads.length, 2, "next inventory is preloaded");
  });
}
test("interstitial waits for the third open, skips unloaded taps without consuming the opportunity", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  for (let i = 0; i < 3; i++) f.manager.onJobOpen(() => proceeds++);
  assert.equal(proceeds, 3);
  assert.equal(f.ads[0].shows, 0);
  f.ads[0].emit("loaded");
  f.manager.onJobOpen(() => proceeds++);
  assert.equal(f.ads[0].shows, 1);
  assert.equal(proceeds, 3);
  f.ads[0].emit("opened");
  assert.equal(f.manager._test.state().shownThisSession, 1);
  assert.equal(f.manager._test.state().opens, 0);
  f.ads[0].emit("closed");
  assert.equal(proceeds, 4);
});
test("no interstitial on the first two opens even when already loaded", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  f.ads[0].emit("loaded");
  for (let i = 0; i < 2; i++) f.manager.onJobOpen(() => proceeds++);
  assert.equal(proceeds, 2);
  assert.equal(f.ads[0].shows, 0);
});
test("interstitial cooldown and four-per-session cap are enforced on OPENED", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  for (let cycle = 0; cycle < 4; cycle++) {
    const ad = f.ads[cycle];
    ad.emit("loaded");
    for (let i = 0; i < 3; i++) f.manager.onJobOpen(() => proceeds++);
    assert.equal(ad.shows, 1);
    ad.emit("opened");
    ad.emit("closed");
    f.ads[cycle + 1].emit("loaded");
    for (let i = 0; i < 3; i++) f.manager.onJobOpen(() => proceeds++);
    assert.equal(f.ads[cycle + 1].shows, 0, "no show inside cooldown");
    t.mock.timers.tick(ADS_CONFIG.interstitial.cooldownMs);
  }
  for (let i = 0; i < 20; i++) f.manager.onJobOpen(() => proceeds++);
  assert.equal(
    f.ads.reduce((n, a) => n + a.shows, 0),
    4,
  );
  assert.equal(f.manager._test.state().shownThisSession, 4);
  assert.equal(proceeds, 38); // Six extra taps during presentation are deliberately ignored.
});
test("interstitial respects another format's lock and the gap after release", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  f.lock.tryAcquire("app-open");
  third(f, () => proceeds++);
  assert.equal(proceeds, 1);
  assert.equal(f.ads[0].shows, 0);
  f.lock.release("app-open");
  f.manager.onJobOpen(() => proceeds++);
  t.mock.timers.tick(ADS_CONFIG.fullscreenMinGapMs - 1);
  f.manager.onJobOpen(() => proceeds++);
  assert.equal(f.ads[0].shows, 0);
  t.mock.timers.tick(1);
  f.manager.onJobOpen(() => proceeds++);
  assert.equal(f.ads[0].shows, 1);
  f.ads[0].emit("closed");
  assert.equal(proceeds, 4);
});
test("rapid second tap is ignored until the first navigation completes", (t) => {
  const f = interstitial(t);
  let first = 0,
    second = 0;
  third(f, () => first++);
  f.manager.onJobOpen(() => second++);
  f.ads[0].emit("opened");
  f.ads[0].emit("closed");
  assert.equal(first, 1);
  assert.equal(second, 0);
  f.manager.onJobOpen(() => second++);
  assert.equal(second, 1);
});
test("interstitial load retry backoff is bounded and the next prepare resumes after exhaustion", (t) => {
  const f = interstitial(t);
  for (let i = 0; i < 3; i++) {
    f.ads[i].emit("error");
    f.manager.prepare();
    t.mock.timers.tick(ADS_CONFIG.interstitial.retryBackoffMs[i] - 1);
    assert.equal(f.ads.length, i + 1);
    t.mock.timers.tick(1);
    assert.equal(f.ads.length, i + 2);
  }
  f.ads[3].emit("error");
  t.mock.timers.tick(100000);
  assert.equal(f.ads.length, 4);
  assert.equal(f.manager._test.state().retryExhausted, true);
  f.manager.prepare();
  assert.equal(f.ads.length, 5);
});
test("consent withdrawal releases pending navigation, discards ads and stops retry requests", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  third(f, () => proceeds++);
  f.deny();
  assert.equal(proceeds, 1);
  assert.equal(f.lock.isHeld(), false);
  t.mock.timers.tick(120000);
  f.manager.prepare();
  assert.equal(f.ads.length, 1);
});
test("disabled interstitial does not load or block navigation", (t) => {
  const f = interstitial(t, { enabled: false });
  let proceeds = 0;
  for (let i = 0; i < 10; i++) f.manager.onJobOpen(() => proceeds++);
  assert.equal(proceeds, 10);
  assert.equal(f.ads.length, 0);
});
test("fullscreen lock is owner-specific and resettable", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const lock = createFullscreenLock();
  assert.equal(lock.tryAcquire("a"), true);
  lock.release("b");
  assert.equal(lock.tryAcquire("b"), false);
  lock.release("a");
  assert.equal(lock.tryAcquire("b"), false);
  t.mock.timers.setTime(60000);
  assert.equal(lock.tryAcquire("b"), true);
  lock._reset();
  assert.equal(lock.tryAcquire("c"), true);
});
test("personalization uses NOT_REQUIRED or the SDK's selectPersonalisedAds choice and defaults closed", async () => {
  for (const [status, choice, expected] of [
    ["NOT_REQUIRED", undefined, false],
    ["OBTAINED", true, false],
    ["OBTAINED", false, true],
    ["OBTAINED", undefined, true],
    ["UNKNOWN", undefined, true],
  ]) {
    const p = privacy({ status });
    if (status === "UNKNOWN")
      p.port.showFormIfRequired = async () => ({
        status: "UNKNOWN",
        canRequestAds: true,
      });
    p.port.choices = async () => ({
      storeAndAccessInformationOnDevice: true,
      selectBasicAds: true,
      selectPersonalisedAds: choice,
    });
    await p.control.prepare(() => true);
    assert.equal(
      p.control.getRequestOptions().requestNonPersonalizedAdsOnly,
      expected,
      status,
    );
  }
  const p = createAdConsent(null);
  assert.equal(p.getRequestOptions().requestNonPersonalizedAdsOnly, true);
});
test("consent retries on a later foreground, never while a provider form is presenting", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 100000 });
  const p = privacy({ error: true });
  await p.control.prepare(() => true);
  await p.control.retryOnForeground(() => true);
  assert.equal(p.calls.info, 1);
  t.mock.timers.setTime(129999);
  await p.control.retryOnForeground(() => true);
  assert.equal(p.calls.info, 1);
  let resolveForm;
  p.port.requestInfoUpdate = async () => {
    p.calls.info++;
    return { status: "REQUIRED", canRequestAds: false };
  };
  p.port.showFormIfRequired = () =>
    new Promise((resolve) => {
      resolveForm = resolve;
    });
  t.mock.timers.setTime(130000);
  const pending = p.control.retryOnForeground(() => true);
  await tick();
  assert.equal(p.control.getSnapshot().presenting, true);
  t.mock.timers.setTime(200000);
  await p.control.retryOnForeground(() => true);
  assert.equal(p.calls.info, 2);
  resolveForm({ status: "NOT_REQUIRED", canRequestAds: true });
  await pending;
  assert.equal(p.control.getSnapshot().failed, false);
  assert.equal(p.calls.initialize, 1);
});
test("banner recovery follows all configured delays, resets after load and cancels on disposal", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let retries = 0;
  const recovery = createAdRecovery(
    ADS_CONFIG.banner.retryBackoffMs,
    () => retries++,
  );
  for (const delay of ADS_CONFIG.banner.retryBackoffMs) {
    recovery.failed();
    recovery.failed();
    t.mock.timers.tick(delay - 1);
    const prior = retries;
    t.mock.timers.tick(1);
    assert.equal(retries, prior + 1);
  }
  recovery.failed();
  t.mock.timers.tick(999999);
  assert.equal(retries, 3);
  recovery.loaded();
  recovery.failed();
  t.mock.timers.tick(30000);
  assert.equal(retries, 4);
  recovery.failed();
  recovery.dispose();
  t.mock.timers.tick(999999);
  assert.equal(retries, 4);
  recovery.failed();
  t.mock.timers.tick(999999);
  assert.equal(retries, 4);
});
test("native timeout collapses once, destroys late resolution, and cleanup destroys loaded inventory", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve,
    loaded = 0,
    failed = 0,
    destroyed = 0;
  const cancel = loadNativeWithTimeout(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    () => loaded++,
    () => failed++,
  );
  t.mock.timers.tick(9999);
  assert.equal(failed, 0);
  t.mock.timers.tick(1);
  assert.equal(failed, 1);
  resolve({
    destroy() {
      destroyed++;
    },
  });
  await tick();
  assert.equal(loaded, 0);
  assert.equal(destroyed, 1);
  cancel();
  assert.equal(destroyed, 1);
  const dispose = loadNativeWithTimeout(
    async () => ({
      destroy() {
        destroyed++;
      },
    }),
    () => loaded++,
    () => failed++,
  );
  await tick();
  assert.equal(loaded, 1);
  dispose();
  dispose();
  assert.equal(destroyed, 2);
});
test("native load rejection and unmount before resolution clean up without duplicate failure", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let failed = 0,
    destroyed = 0,
    resolve;
  loadNativeWithTimeout(
    () => Promise.reject(Error("no fill")),
    () => assert.fail(),
    () => failed++,
  );
  await tick();
  t.mock.timers.tick(10000);
  assert.equal(failed, 1);
  const cancel = loadNativeWithTimeout(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    () => assert.fail(),
    () => failed++,
  );
  cancel();
  resolve({
    destroy() {
      destroyed++;
    },
  });
  await tick();
  assert.equal(destroyed, 1);
});
test("native insertion uses zero-based indices 3, 9, 15 and the actual feed flag", () => {
  assert.deepEqual(
    Array.from({ length: 21 }, (_, i) => i).filter(shouldInsertNative),
    [3, 9, 15],
  );
  const enabled = ADS_CONFIG.native.feedEnabled;
  ADS_CONFIG.native.feedEnabled = false;
  try {
    assert.equal(shouldInsertNative(3), false);
  } finally {
    ADS_CONFIG.native.feedEnabled = enabled;
  }
});

test("app-open uses the shared lock/gap, second-launch threshold and three-hour cooldown", async (t) => {
  t.mock.timers.enable({
    apis: ["setTimeout", "Date"],
    now: Date.parse("2026-11-13T10:00:00Z"),
  });
  const lock = createFullscreenLock(),
    ads = [];
  const control = createAppOpenController({
    lock,
    storage: {
      getItem: async (key) => (key.includes("launch_count") ? "1" : "0"),
      setItem: async () => {},
    },
    createAd() {
      const ad = fakeAd();
      ads.push(ad);
      return ad;
    },
  });
  t.after(() => control.dispose());
  control.setContext({ eligible: true, consent: true });
  await control.initialize();
  assert.equal(control.getDebugState().launches, 2);
  ads[0].emit("loaded");
  function resume() {
    control.onState("background");
    t.mock.timers.tick(1000);
    control.onState("active");
    t.mock.timers.tick(75);
  }
  assert.equal(lock.tryAcquire("interstitial"), true);
  resume();
  assert.equal(ads[0].shows, 0);
  lock.release("interstitial");
  resume();
  assert.equal(ads[0].shows, 0);
  t.mock.timers.tick(60000);
  resume();
  assert.equal(ads[0].shows, 1);
  ads[0].emit("closed");
  assert.equal(lock.isHeld(), false);
  ads[1].emit("loaded");
  resume();
  assert.equal(ads[1].shows, 0);
  t.mock.timers.tick(ADS_CONFIG.appOpen.cooldownMs);
  resume();
  assert.equal(ads[1].shows, 1);
});
test("app-open errors, promise rejection and safety timeout release its lock", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000000 });
  for (const mode of ["error", "reject", "safety"]) {
    const lock = createFullscreenLock(),
      ads = [];
    const control = createAppOpenController({
      lock,
      storage: { getItem: async () => "2", setItem: async () => {} },
      createAd() {
        const ad = fakeAd();
        ads.push(ad);
        return ad;
      },
    });
    control.setContext({ eligible: true, consent: true });
    await control.initialize();
    ads[0].emit("loaded");
    if (mode === "reject") ads[0].reject = true;
    control.onState("background");
    t.mock.timers.tick(1000);
    control.onState("active");
    t.mock.timers.tick(75);
    if (mode === "error") ads[0].emit("error");
    if (mode === "safety") t.mock.timers.tick(120000);
    await tick();
    assert.equal(lock.isHeld(), false);
    assert.equal(ads.length, 2);
    control.dispose();
  }
});
test("all enabled flags suppress their real request/render paths", async () => {
  const old = ADS_CONFIG.appOpen.enabled;
  ADS_CONFIG.appOpen.enabled = false;
  const f = lifecycle();
  try {
    f.control.setContext({ eligible: true, consent: true });
    await f.control.initialize();
    f.resume();
    assert.equal(f.ads.length, 0);
  } finally {
    f.control.dispose();
    ADS_CONFIG.appOpen.enabled = old;
  }
  // Component flags are tested in the native-boundary suite. Assert config
  // leaves are consumed outside config itself, so future unused knobs fail.
  const fs = require("node:fs"),
    path = require("node:path");
  const sources = fs
    .readdirSync(path.join(__dirname, "../src/ads"))
    .filter((p) => !p.includes(".web."))
    .map((p) => fs.readFileSync(path.join(__dirname, "../src/ads", p), "utf8"))
    .join("\n");
  for (const [format, values] of Object.entries(ADS_CONFIG)) {
    if (typeof values !== "object") {
      assert.ok(sources.includes(`ADS_CONFIG.${format}`));
      continue;
    }
    for (const key of Object.keys(values)) {
      const pattern = `ADS_CONFIG.${format}.${key}`;
      assert.ok(
        sources.includes(pattern) || sources.includes(`policy.${key}`),
        `used config: ${format}.${key}`,
      );
    }
  }
});

test("failed UMP update recovers only permission explicitly retained by the SDK", async () => {
  for (const status of ["NOT_REQUIRED", "OBTAINED"]) {
    const p = privacy({ error: true });
    p.port.getConsentInfo = async () => ({ status, canRequestAds: true });
    p.port.choices = async () => ({
      storeAndAccessInformationOnDevice: true,
      selectBasicAds: true,
      selectPersonalisedAds: true,
    });
    await p.control.prepare(() => true);
    assert.equal(p.control.getSnapshot().canRequestAds, true);
    assert.equal(p.calls.initialize, 1);
    assert.equal(p.control.getSnapshot().failed, true);
    assert.equal(
      p.control.getRequestOptions().requestNonPersonalizedAdsOnly,
      true,
    );
  }
});
test("publisher misconfiguration cannot authorize fresh, unknown, denied or unreadable consent", async () => {
  for (const cached of [
    { status: "UNKNOWN", canRequestAds: false },
    { status: "UNKNOWN", canRequestAds: true },
    { status: "REQUIRED", canRequestAds: true },
    { status: "NOT_REQUIRED", canRequestAds: false },
    null,
  ]) {
    const p = privacy({ error: true });
    p.port.getConsentInfo = async () => cached;
    await p.control.prepare(() => true);
    assert.equal(p.control.getSnapshot().canRequestAds, false);
    assert.equal(p.calls.initialize, 0);
    assert.equal(p.control.getSnapshot().errorMessage, "missing form");
  }
  const p = privacy({ error: true });
  p.port.getConsentInfo = async () => {
    throw Error("SDK unavailable");
  };
  await p.control.prepare(() => true);
  assert.equal(p.calls.initialize, 0);
});
test("cached OBTAINED permission still requires storage/basic-ad choices", async () => {
  const p = privacy({ error: true, refused: true });
  p.port.getConsentInfo = async () => ({
    status: "OBTAINED",
    canRequestAds: true,
  });
  await p.control.prepare(() => true);
  assert.equal(p.control.getSnapshot().canRequestAds, false);
  assert.equal(p.calls.initialize, 0);
});
test("cached recovery retries later, clears its error and does not initialize twice", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 100000 });
  const p = privacy({ error: true });
  p.port.getConsentInfo = async () => ({
    status: "NOT_REQUIRED",
    canRequestAds: true,
  });
  await p.control.prepare(() => true);
  p.port.requestInfoUpdate = async () => ({
    status: "NOT_REQUIRED",
    canRequestAds: true,
  });
  t.mock.timers.setTime(130000);
  await p.control.retryOnForeground(() => true);
  assert.equal(p.control.getSnapshot().failed, false);
  assert.equal(p.control.getSnapshot().errorMessage, null);
  assert.equal(p.calls.initialize, 1);
});
test("privacy-form failure after withdrawal never recovers cached ad permission", async () => {
  const p = privacy();
  await p.control.prepare(() => true);
  let cachedReads = 0;
  p.port.getConsentInfo = async () => {
    cachedReads++;
    return { status: "NOT_REQUIRED", canRequestAds: true };
  };
  p.port.showPrivacyOptions = async () => {
    throw Error("privacy form unavailable");
  };
  await p.control.openPrivacy(() => true);
  assert.equal(cachedReads, 0);
  assert.equal(p.control.getSnapshot().canRequestAds, false);
});

test("development diagnostics redact secrets/identifiers and ignore non-whitelisted fields", () => {
  const { createAdDiagnostics } = load("src/ads/diagnostics.ts"),
    entries = [];
  const diag = createAdDiagnostics(true, (e) => entries.push(e));
  diag.error("consent", "consent.update-failed", {
    code: "consent-update-failed",
    message:
      "Publisher misconfiguration: no forms configured token=shortsecret TCString=privateconsent https://example.test/?token=hidden user@example.test 00000000-0000-4000-8000-000000000001 abcdefghijklmnopqrstuvwxyz0123456789",
  });
  diag.record("runtime", {
    platform: "android",
    access_token: "must-not-log",
    personalConsent: "must-not-log",
  });
  const output = JSON.stringify(entries);
  for (const secret of [
    "shortsecret",
    "privateconsent",
    "https://example.test",
    "user@example.test",
    "00000000-0000-4000-8000-000000000001",
    "abcdefghijklmnopqrstuvwxyz0123456789",
    "must-not-log",
  ])
    assert.equal(output.includes(secret), false, secret);
  assert.equal(entries[0].reason, "publisher-configuration");
  assert.equal(entries[1].platform, "android");
});
test("diagnostics stay silent when disabled, deduplicate gates and never propagate a logging failure", () => {
  const { createAdDiagnostics } = load("src/ads/diagnostics.ts");
  let count = 0;
  const off = createAdDiagnostics(false, () => count++);
  off.record("request");
  off.error("native", "load.failed", Error("network"));
  assert.equal(count, 0);
  const on = createAdDiagnostics(true, () => count++);
  on.record("skip", { reason: "consent" }, true);
  on.record("skip", { reason: "consent" }, true);
  assert.equal(count, 1);
  on.record("request");
  on.record("request");
  assert.equal(count, 3);
  assert.doesNotThrow(() =>
    createAdDiagnostics(true, () => {
      throw Error("logger unavailable");
    }).record("loaded"),
  );
});
test("no-fill diagnostics remain failures and do not imply loaded, rendered or impressed", () => {
  const { createAdDiagnostics } = load("src/ads/diagnostics.ts"),
    entries = [];
  createAdDiagnostics(true, (e) => entries.push(e)).error(
    "banner",
    "load.failed",
    { code: "googleMobileAds/error-code-no-fill", message: "No fill" },
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].reason, "no-fill");
  assert.equal(entries[0].event, "load.failed");
});
test("exact publisher-error trace distinguishes blocked permission from valid cached recovery", async (t) => {
  const { adDiagnostics, createAdDiagnostics } = load("src/ads/diagnostics.ts");
  const original = { ...adDiagnostics };
  t.after(() => Object.assign(adDiagnostics, original));
  for (const cachedPermission of [false, true]) {
    const entries = [],
      capture = createAdDiagnostics(true, (e) => entries.push(e));
    Object.assign(adDiagnostics, capture);
    const p = privacy();
    p.port.requestInfoUpdate = async () => {
      throw Object.assign(
        Error(
          "Publisher misconfiguration: no form(s) configured for the input app ID",
        ),
        { code: "consent-update-failed" },
      );
    };
    p.port.getConsentInfo = async () => ({
      status: cachedPermission ? "NOT_REQUIRED" : "UNKNOWN",
      canRequestAds: cachedPermission,
    });
    await p.control.prepare(() => true);
    const ads = [];
    const manager = createInterstitialManager(
      {
        permitted: () => p.control.getSnapshot().canRequestAds,
        events: {
          LOADED: "loaded",
          OPENED: "opened",
          CLOSED: "closed",
          ERROR: "error",
        },
        createAd() {
          const ad = fakeAd();
          ads.push(ad);
          return ad;
        },
      },
      ADS_CONFIG.interstitial,
      createFullscreenLock(),
    );
    manager.prepare();
    assert.ok(
      entries.some(
        (e) =>
          e.event === "consent.update-failed" &&
          e.reason === "publisher-configuration",
      ),
    );
    assert.ok(
      entries.some(
        (e) =>
          e.event === "consent.cached" && e.canRequestAds === cachedPermission,
      ),
    );
    assert.equal(p.calls.initialize, cachedPermission ? 1 : 0);
    assert.equal(ads.length, cachedPermission ? 1 : 0);
    assert.equal(
      entries.some((e) => e.event === "impression"),
      false,
    );
    if (cachedPermission) {
      ads[0].emit("loaded");
      manager.onJobOpen(() => {});
      manager.onJobOpen(() => {});
      manager.onJobOpen(() => {});
      ads[0].emit("opened");
      ads[0].emit("closed");
      assert.ok(entries.some((e) => e.event === "opened"));
      assert.equal(
        entries.some((e) => e.event === "impression"),
        false,
        "full-screen OPENED is not an impression count",
      );
    } else
      assert.equal(
        entries.some(
          (e) => e.event === "initialize.ready" || e.event === "request",
        ),
        false,
      );
    manager._test.reset();
  }
});

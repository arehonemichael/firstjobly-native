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
const { createRewardedManager } = load("src/ads/rewarded-manager.ts");
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
function lifecycle({
  count = 2,
  last = 0,
  minLaunches = ADS_CONFIG.appOpen.minLaunches,
} = {}) {
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
    minLaunches,
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
test("auth/onboarding/application routes, consent refusal, configured launch thresholds and cooldown block presentation", async () => {
  for (const type of ["route", "consent", "launches", "cooldown"]) {
    const f = await ready(
      type === "launches"
        ? { count: 0, minLaunches: 2 }
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
function firstEligible(f, proceed) {
  f.ads[0].emit("loaded");
  for (let i = 1; i < ADS_CONFIG.interstitial.firstJobOpen; i++)
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
    firstEligible(f, () => proceeds++);
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
test("unloaded job taps proceed without consuming the first eligible interstitial opportunity", (t) => {
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
test("ready interstitials are eligible on job taps 1, 3 and 6 outside the shared gap", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  const shownAt = [];
  f.ads[0].emit("loaded");
  for (let tap = 1; tap <= 6; tap++) {
    const before = f.ads.reduce((n, a) => n + a.shows, 0);
    f.manager.onJobOpen(() => proceeds++);
    const after = f.ads.reduce((n, a) => n + a.shows, 0);
    if (after > before) {
      shownAt.push(tap);
      const ad = f.ads.find((a) => a.shows && !a.removed);
      ad.emit("opened");
      ad.emit("closed");
      t.mock.timers.tick(ADS_CONFIG.fullscreenMinGapMs);
      f.ads[f.ads.length - 1].emit("loaded");
    }
  }
  assert.deepEqual(shownAt, [1, 3, 6]);
  assert.equal(proceeds, 6);
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
  assert.equal(proceeds, 36); // Eight extra taps during presentation are deliberately ignored.
});
test("interstitial respects another format's lock and the gap after release", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  f.lock.tryAcquire("app-open");
  firstEligible(f, () => proceeds++);
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
  firstEligible(f, () => first++);
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
  firstEligible(f, () => proceeds++);
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
  for (const status of ["NOT_REQUIRED", "OBTAINED", "UNKNOWN"]) {
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
test("publisher misconfiguration cannot authorize denied, required or unreadable consent", async () => {
  for (const cached of [
    { status: "UNKNOWN", canRequestAds: false },
    { status: "UNRECOGNIZED", canRequestAds: true },
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
  assert.equal(entries[0].code, "googleMobileAds/error-code-no-fill");
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
      status: "UNKNOWN",
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

test("device regression: UNKNOWN plus explicit SDK permission initializes once and requests NPA after publisher error", async () => {
  const p = privacy({ error: true });
  p.port.getConsentInfo = async () => ({
    status: "UNKNOWN",
    canRequestAds: true,
  });
  await Promise.all([
    p.control.prepare(() => true),
    p.control.prepare(() => true),
  ]);
  assert.equal(p.calls.initialize, 1);
  assert.equal(p.calls.form, 0);
  assert.equal(p.control.getSnapshot().canRequestAds, true);
  assert.equal(p.control.getSnapshot().personalized, false);
  assert.equal(
    p.control.getRequestOptions().requestNonPersonalizedAdsOnly,
    true,
  );
});
test("successful UNKNOWN status with explicit permission needs no forced form and remains NPA", async () => {
  const p = privacy({ status: "UNKNOWN", canRequestAds: true });
  await p.control.prepare(() => true);
  assert.equal(p.calls.form, 0);
  assert.equal(p.calls.initialize, 1);
  assert.equal(p.control.getSnapshot().canRequestAds, true);
  assert.equal(
    p.control.getRequestOptions().requestNonPersonalizedAdsOnly,
    true,
  );
});
test("UNKNOWN without permission still needs a form and cannot initialize if unresolved", async () => {
  const p = privacy({ status: "UNKNOWN", canRequestAds: false });
  p.port.showFormIfRequired = async () => {
    p.calls.form++;
    return { status: "UNKNOWN", canRequestAds: false };
  };
  await p.control.prepare(() => true);
  assert.equal(p.calls.form, 1);
  assert.equal(p.calls.initialize, 0);
  assert.equal(p.control.getSnapshot().canRequestAds, false);
});

test("an unloaded first tap proceeds and the next ready tap keeps the first-ad opportunity", (t) => {
  const f = interstitial(t);
  let proceeds = 0;
  f.manager.onJobOpen(() => proceeds++);
  assert.equal(proceeds, 1);
  assert.equal(f.ads[0].shows, 0);
  f.ads[0].emit("loaded");
  f.manager.onJobOpen(() => proceeds++);
  assert.equal(f.ads[0].shows, 1);
  assert.equal(proceeds, 1);
  f.ads[0].emit("opened");
  f.ads[0].emit("closed");
  assert.equal(proceeds, 2);
});
test("first-job threshold can be raised independently without changing the repeat cadence", (t) => {
  const f = interstitial(t, { firstJobOpen: 3 });
  let proceeds = 0;
  f.ads[0].emit("loaded");
  for (let i = 0; i < 2; i++) f.manager.onJobOpen(() => proceeds++);
  assert.equal(f.ads[0].shows, 0);
  assert.equal(proceeds, 2);
  f.manager.onJobOpen(() => proceeds++);
  assert.equal(f.ads[0].shows, 1);
  f.ads[0].emit("opened");
  f.ads[0].emit("closed");
  assert.equal(proceeds, 3);
});

async function coldFixture(
  t,
  {
    eligible = true,
    consent = true,
    count = 2,
    last = 0,
    coldEnabled = true,
  } = {},
) {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-11-13T10:00:00Z"),
  });
  const ads = [],
    lock = createFullscreenLock();
  const control = createAppOpenController({
    lock,
    coldStartEnabled: () => coldEnabled,
    storage: {
      getItem: async (key) =>
        String(key.includes("launch_count") ? count : last),
      setItem: async () => {},
    },
    createAd() {
      const ad = fakeAd();
      ads.push(ad);
      return ad;
    },
  });
  t.after(() => control.dispose());
  control.setContext({ eligible, consent });
  await control.initialize();
  return { control, ads, lock };
}
test("cold app-open shows ready inventory once at first Home entry and never replays on remount", async (t) => {
  const f = await coldFixture(t);
  f.ads[0].emit("loaded");
  f.control.beginColdStart(true);
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 1);
  f.ads[0].emit("closed");
  f.ads[1].emit("loaded");
  f.control.beginColdStart(true);
  t.mock.timers.tick(2000);
  assert.equal(f.ads[1].shows, 0);
});
test("cold app-open may load only inside the bounded startup window without delaying Home", async (t) => {
  const f = await coldFixture(t);
  f.control.beginColdStart(true);
  t.mock.timers.tick(500);
  assert.equal(f.ads[0].shows, 0);
  f.ads[0].emit("loaded");
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 1);
});
test("cold app-open skips late inventory instead of popping over Home later", async (t) => {
  const f = await coldFixture(t);
  f.control.beginColdStart(true);
  t.mock.timers.tick(ADS_CONFIG.appOpen.coldStartWindowMs);
  f.ads[0].emit("loaded");
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 0);
});
test("startup deadline cancels a show scheduled too close to its end", async (t) => {
  const f = await coldFixture(t);
  f.control.beginColdStart(true);
  t.mock.timers.tick(ADS_CONFIG.appOpen.coldStartWindowMs - 10);
  f.ads[0].emit("loaded");
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 0);
});
for (const event of [
  "touch",
  "background",
  "deep-link",
  "before-ready-touch",
]) {
  test(`cold app-open cancels on ${event} and never reappears from late load`, async (t) => {
    const f = await coldFixture(t);
    if (event === "before-ready-touch") f.control.markInteraction();
    f.control.beginColdStart(event !== "deep-link");
    if (event === "touch") f.control.markInteraction();
    if (event === "background") f.control.onState("background");
    f.ads[0].emit("loaded");
    f.control.beginColdStart(true);
    t.mock.timers.tick(2000);
    assert.equal(f.ads[0].shows, 0);
  });
}
test("cold app-open waits for confirmed Home eligibility but cannot display after its deadline", async (t) => {
  const f = await coldFixture(t, { eligible: false });
  f.control.beginColdStart(true);
  f.ads[0].emit("loaded");
  t.mock.timers.tick(2000);
  f.control.setContext({ eligible: true, consent: true });
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 0);
});
test("cold app-open can use profile confirmation within the startup window", async (t) => {
  const f = await coldFixture(t, { eligible: false });
  f.control.beginColdStart(true);
  f.ads[0].emit("loaded");
  t.mock.timers.tick(100);
  f.control.setContext({ eligible: true, consent: true });
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 1);
});
test("cold app-open never requests without consent", async (t) => {
  const f = await coldFixture(t, { consent: false });
  f.control.beginColdStart(true);
  t.mock.timers.tick(2000);
  assert.equal(f.ads.length, 0);
});
test("cold app-open flag independently disables startup offers", async (t) => {
  const f = await coldFixture(t, { coldEnabled: false });
  f.ads[0].emit("loaded");
  f.control.beginColdStart(true);
  t.mock.timers.tick(2000);
  assert.equal(f.ads[0].shows, 0);
});
test("cold app-open keeps the shared full-screen lock and gap", async (t) => {
  const f = await coldFixture(t);
  f.lock.tryAcquire("interstitial");
  f.ads[0].emit("loaded");
  f.control.beginColdStart(true);
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 0);
  f.lock.release("interstitial");
  t.mock.timers.tick(ADS_CONFIG.fullscreenMinGapMs);
  f.control.beginColdStart(true);
  assert.equal(f.ads[0].shows, 0);
});
for (const mode of ["reject", "error"]) {
  test(`cold app-open ${mode} releases the lock and cannot retry presentation in the same launch`, async (t) => {
    const f = await coldFixture(t);
    f.ads[0].reject = mode === "reject";
    f.ads[0].emit("loaded");
    f.control.beginColdStart(true);
    t.mock.timers.tick(75);
    if (mode === "error") f.ads[0].emit("error");
    await tick();
    assert.equal(f.lock.isHeld(), false);
    assert.equal(f.ads.length, 2);
    f.ads[1].emit("loaded");
    f.control.beginColdStart(true);
    t.mock.timers.tick(2000);
    assert.equal(f.ads[1].shows, 0);
  });
}

test("cold app-open is eligible on the first launch when existing account/profile permission is ready", async (t) => {
  const f = await coldFixture(t, { count: 0 });
  f.ads[0].emit("loaded");
  f.control.beginColdStart(true);
  t.mock.timers.tick(75);
  assert.equal(f.ads[0].shows, 1);
});
test("cold app-open retains its persisted three-hour cooldown", async (t) => {
  const f = await coldFixture(t, { last: Date.parse("2026-11-13T10:00:00Z") });
  f.ads[0].emit("loaded");
  f.control.beginColdStart(true);
  t.mock.timers.tick(2000);
  assert.equal(f.ads[0].shows, 0);
});

function rewardFixture(t, { allowed = true, enabled = true } = {}) {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-11-13T12:00:00Z"),
  });
  const ads = [],
    lock = createFullscreenLock();
  const control = createRewardedManager(
    {
      permitted: () => allowed,
      events: {
        LOADED: "rewarded_loaded",
        OPENED: "opened",
        EARNED: "rewarded_earned_reward",
        CLOSED: "closed",
        ERROR: "error",
      },
      createAd() {
        const ad = fakeAd();
        ads.push(ad);
        return ad;
      },
    },
    { ...ADS_CONFIG.rewarded, enabled },
    lock,
  );
  t.after(() => control._test.reset());
  control.prepare();
  return {
    control,
    ads,
    lock,
    deny() {
      allowed = false;
      control.revoke();
    },
  };
}
test("rewarded download waits for EARNED_REWARD and close; reward payload on load is not completion", async (t) => {
  const f = rewardFixture(t);
  f.ads[0].emit("rewarded_loaded");
  let result;
  const pending = f.control.request().then((value) => {
    result = value;
  });
  f.ads[0].emit("opened");
  await tick();
  assert.equal(result, undefined);
  assert.equal(f.control.getCredit(), false);
  f.ads[0].emit("rewarded_earned_reward");
  await tick();
  assert.equal(result, undefined);
  assert.equal(
    await f.control.request(),
    "busy",
    "never download beneath the active ad",
  );
  f.ads[0].emit("closed");
  await pending;
  assert.equal(result, "earned");
  assert.equal(f.lock.isHeld(), false);
});
test("closing a rewarded ad early cancels only that download attempt", async (t) => {
  const f = rewardFixture(t);
  f.ads[0].emit("rewarded_loaded");
  const pending = f.control.request();
  f.ads[0].emit("opened");
  f.ads[0].emit("closed");
  assert.equal(await pending, "cancelled");
  assert.equal(f.control.getCredit(), false);
  assert.equal(f.lock.isHeld(), false);
});
test("earned download survives a failed PDF/save attempt until a successful download consumes it", async (t) => {
  const f = rewardFixture(t);
  f.ads[0].emit("rewarded_loaded");
  const pending = f.control.request();
  f.ads[0].emit("opened");
  f.ads[0].emit("rewarded_earned_reward");
  f.ads[0].emit("rewarded_earned_reward");
  f.ads[0].emit("closed");
  assert.equal(await pending, "earned");
  assert.equal(await f.control.request(), "earned");
  assert.equal(f.ads.length, 1);
  f.control.consumeReward();
  assert.equal(f.control.getCredit(), false);
  assert.equal(f.ads.length, 2);
});
for (const type of [
  "error",
  "reject",
  "throw",
  "start-timeout",
  "safety-timeout",
]) {
  test(`rewarded ${type} resolves once with free fallback and releases the lock`, async (t) => {
    const f = rewardFixture(t);
    f.ads[0].emit("rewarded_loaded");
    let calls = 0;
    if (type === "reject") f.ads[0].reject = true;
    if (type === "throw") f.ads[0].throws = true;
    const pending = f.control.request().then((value) => {
      calls++;
      return value;
    });
    if (type === "error") f.ads[0].emit("error");
    if (type === "start-timeout")
      t.mock.timers.tick(ADS_CONFIG.rewarded.startTimeoutMs);
    if (type === "safety-timeout") {
      f.ads[0].emit("opened");
      t.mock.timers.tick(ADS_CONFIG.rewarded.safetyTimeoutMs);
    }
    assert.equal(await pending, "unavailable");
    assert.equal(calls, 1);
    assert.equal(f.lock.isHeld(), false);
    f.ads[0].emit("closed");
    assert.equal(calls, 1);
  });
}
test("unloaded rewarded requests continue without waiting and may preload for later opt-in", async (t) => {
  const f = rewardFixture(t);
  assert.equal(await f.control.request(), "unavailable");
  assert.equal(f.ads[0].shows, 0);
});
test("rewarded loading times out and retries with bounded backoff", (t) => {
  const f = rewardFixture(t);
  t.mock.timers.tick(ADS_CONFIG.rewarded.loadTimeoutMs);
  assert.equal(f.ads.length, 1);
  t.mock.timers.tick(ADS_CONFIG.rewarded.retryBackoffMs[0] - 1);
  assert.equal(f.ads.length, 1);
  t.mock.timers.tick(1);
  assert.equal(f.ads.length, 2);
  f.ads[1].emit("error");
  t.mock.timers.tick(ADS_CONFIG.rewarded.retryBackoffMs[1]);
  assert.equal(f.ads.length, 3);
  f.ads[2].emit("error");
  t.mock.timers.tick(ADS_CONFIG.rewarded.retryBackoffMs[2]);
  assert.equal(f.ads.length, 4);
  f.ads[3].emit("error");
  t.mock.timers.tick(600000);
  assert.equal(f.ads.length, 4);
  f.control.prepare();
  assert.equal(f.ads.length, 5);
});
test("disabled or unpermitted rewarded paths never request an ad and downloads stay available", async (t) => {
  const f = rewardFixture(t, { allowed: false });
  assert.equal(f.ads.length, 0);
  assert.equal(await f.control.request(), "unavailable");
  const disabled = createRewardedManager(
    {
      permitted: () => true,
      events: {},
      createAd() {
        assert.fail();
      },
    },
    { ...ADS_CONFIG.rewarded, enabled: false },
  );
  assert.equal(await disabled.request(), "unavailable");
  disabled._test.reset();
});
test("rewarded consent withdrawal resolves a pending request and cancels further loads", async (t) => {
  const f = rewardFixture(t);
  f.ads[0].emit("rewarded_loaded");
  const pending = f.control.request();
  f.deny();
  assert.equal(await pending, "unavailable");
  assert.equal(f.lock.isHeld(), false);
  t.mock.timers.tick(600000);
  assert.equal(f.ads.length, 1);
});
test("rewarded uses the existing cross-format lock and post-close gap", async (t) => {
  const f = rewardFixture(t);
  f.ads[0].emit("rewarded_loaded");
  f.lock.tryAcquire("interstitial");
  assert.equal(await f.control.request(), "unavailable");
  f.lock.release("interstitial");
  assert.equal(await f.control.request(), "unavailable");
  assert.equal(f.ads[0].shows, 0);
  t.mock.timers.tick(ADS_CONFIG.fullscreenMinGapMs);
  const pending = f.control.request();
  assert.equal(f.ads[0].shows, 1);
  f.ads[0].emit("closed");
  assert.equal(await pending, "cancelled");
});

// Execute the actual screen handlers with isolated PDF/native ports. No real
// files, network requests, consent data or ad impressions are generated.
function downloadHandler(file, name, deps) {
  const fs = require("node:fs"),
    path = require("node:path"),
    ts = require("typescript");
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let target;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name)
      target = node;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(target, name);
  const code = ts.transpileModule(target.getText(parsed), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  return new Function(...Object.keys(deps), `${code}\nreturn ${name};`)(
    ...Object.values(deps),
  );
}
function downloadPorts(kind, before = async () => true) {
  const events = [],
    busy = [],
    alerts = [],
    lock = { current: false };
  const deps = {
    Platform: { OS: "android" },
    downloadLock: lock,
    circularMode: false,
    data: {
      firstName: "Fixture",
      lastName: "Person",
      surnameAndNames: "Fixture Person",
    },
    beforeDownload: async () => {
      events.push("ad");
      return before();
    },
    completeDownload: () => events.push("consume"),
    setBusy: (value) => busy.push(value),
    savePdfToDownloads: async () => events.push("save"),
    Alert: { alert: (...args) => alerts.push(args) },
    console: { error() {} },
    Print: {
      printToFileAsync: async () => {
        events.push("generate");
        return { uri: "fixture.pdf" };
      },
    },
    cvHtml: () => "fixture",
    templateId: "fixture",
    fileBase: () => "Fixture",
    missingRequired: () => [],
    TEMPLATE_URL: "https://fixture.invalid/z83.pdf",
    fetch: async () => {
      events.push("template");
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    },
    fillZ83: async () => {
      events.push("generate");
      return new Uint8Array([1]);
    },
    File: class {
      constructor() {
        this.uri = "fixture.pdf";
      }
      write() {
        events.push("write");
      }
    },
    Paths: { cache: "/fixture" },
  };
  const handler = downloadHandler(
    kind === "cv" ? "src/app/cv-maker.tsx" : "src/app/z83.tsx",
    kind === "cv" ? "createPdf" : "download",
    deps,
  );
  return { deps, events, busy, alerts, lock, handler };
}
for (const kind of ["cv", "z83"]) {
  test(`${kind} download saves only after ad permission and consumes reward only after save`, async () => {
    const f = downloadPorts(kind);
    await f.handler();
    assert.equal(f.events[0], "ad");
    assert.ok(f.events.indexOf("generate") < f.events.indexOf("save"));
    assert.equal(f.events.at(-1), "consume");
    assert.equal(f.lock.current, false);
    assert.equal(f.busy.at(-1), false);
  });
  test(`${kind} closed-ad cancellation cannot generate or save a PDF`, async () => {
    const f = downloadPorts(kind, async () => false);
    await f.handler();
    assert.deepEqual(f.events, ["ad"]);
    assert.equal(f.lock.current, false);
    assert.equal(f.busy.at(-1), false);
  });
  test(`${kind} duplicate download taps cannot request twice or generate duplicate PDFs`, async () => {
    let finish;
    const f = downloadPorts(
      kind,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = f.handler();
    await f.handler();
    assert.deepEqual(f.events, ["ad"]);
    finish(true);
    await pending;
    assert.equal(f.events.filter((e) => e === "save").length, 1);
    assert.equal(f.events.filter((e) => e === "consume").length, 1);
  });
  test(`${kind} save failure cannot consume the earned download`, async () => {
    const f = downloadPorts(kind);
    f.deps.savePdfToDownloads = async () => {
      throw Error("storage unavailable");
    };
    const handler = downloadHandler(
      kind === "cv" ? "src/app/cv-maker.tsx" : "src/app/z83.tsx",
      kind === "cv" ? "createPdf" : "download",
      f.deps,
    );
    await handler();
    assert.equal(f.events.includes("consume"), false);
    assert.equal(f.busy.at(-1), false);
    assert.equal(f.lock.current, false);
  });
}
test("CV name validation happens before an ad is requested", async () => {
  const f = downloadPorts("cv");
  f.deps.data.firstName = "";
  f.deps.data.lastName = "";
  await f.handler();
  assert.deepEqual(f.events, []);
  assert.equal(f.alerts.length, 1);
});
test("cancelling the Z83 incomplete-fields prompt requests no ad and releases the tap lock", async () => {
  const f = downloadPorts("z83");
  f.deps.missingRequired = () => ["Surname"];
  f.deps.Alert.alert = (_title, _message, buttons) => buttons[0].onPress();
  const handler = downloadHandler("src/app/z83.tsx", "download", f.deps);
  await handler();
  assert.deepEqual(f.events, []);
  assert.equal(f.lock.current, false);
  assert.equal(f.busy.at(-1), false);
});

test("circular Z83 hands the PDF to the owner session, clears answers and preserves the rewarded gate", async () => {
  const f = downloadPorts("z83");
  const deps = {
    ...f.deps,
    circularMode: true,
    circularApplication: "opaque-application",
    userId: "alice",
    applications: {
      setFile(owner, key, kind, uri) {
        f.events.push("session-file");
        assert.equal(owner, "alice");
        assert.equal(key, "opaque-application");
        assert.equal(kind, "z83");
        assert.equal(uri, "fixture.pdf");
        return true;
      },
    },
    emptyZ83: () => ({ idNumber: "", signature: "" }),
    setData: (value) => {
      assert.equal(value.idNumber, "");
      assert.equal(value.signature, "");
      f.events.push("clear-answers");
    },
    router: { back: () => f.events.push("return-to-apply") },
  };
  const handler = downloadHandler("src/app/z83.tsx", "download", deps);
  await handler();
  assert.deepEqual(f.events, [
    "ad",
    "template",
    "generate",
    "write",
    "session-file",
    "clear-answers",
    "consume",
    "return-to-apply",
  ]);
  assert.ok(!f.events.includes("save"));
  assert.equal(f.lock.current, false);
});
test("circular Z83 cancellation never generates or stores private application files", async () => {
  const f = downloadPorts("z83", async () => false);
  const handler = downloadHandler("src/app/z83.tsx", "download", {
    ...f.deps,
    circularMode: true,
  });
  await handler();
  assert.deepEqual(f.events, ["ad"]);
});

const { createExtraInterstitialController } = load(
  "src/ads/extra-interstitial-controller.ts",
);
const { registerExtraBoundary, extraBoundaryReady } = load(
  "src/ads/extra-boundary.ts",
);
function extraClock() {
  let time = 0;
  const clock = createExtraInterstitialController(() => time);
  clock.setActive(true);
  clock.noteInteraction();
  clock.noteInteraction();
  return {
    clock,
    advance(ms) {
      time += ms;
    },
  };
}
test("extras require five active minutes, never show on a timer, and exclude background", () => {
  const f = extraClock();
  let shows = 0;
  const present = () => {
    shows++;
    return true;
  };
  f.advance(299999);
  assert.equal(
    f.clock.offer(present, () => {}),
    false,
  );
  f.clock.setActive(false);
  f.advance(3600000);
  assert.equal(
    f.clock.offer(present, () => {}),
    false,
  );
  f.clock.setActive(true);
  assert.equal(
    f.clock.offer(present, () => {}),
    false,
  );
  f.advance(1);
  assert.equal(shows, 0);
  assert.equal(
    f.clock.offer(present, () => {}),
    true,
  );
  assert.equal(f.clock.state().shown, 0); // A show call is not a presentation.
});
test("extras count OPENED once, release once, share a two-show session cap and ignore rapid taps", () => {
  const f = extraClock();
  let callbacks,
    navigation = 0,
    shows = 0;
  const present = (done, opened) => {
    shows++;
    callbacks = { done, opened };
    return true;
  };
  for (let i = 0; i < 2; i++) {
    f.advance(300000);
    f.clock.noteInteraction();
    f.clock.noteInteraction();
    assert.equal(
      f.clock.offer(present, () => navigation++),
      true,
    );
    assert.equal(
      f.clock.offer(present, () => navigation++),
      true,
    );
    assert.equal(shows, i + 1);
    callbacks.opened();
    callbacks.opened();
    assert.equal(f.clock.state().shown, i + 1);
    callbacks.done();
    callbacks.done();
    assert.equal(navigation, i + 1);
    assert.equal(
      f.clock.offer(present, () => navigation++),
      false,
    );
    f.clock.setActive(false);
    f.advance(100000);
    f.clock.setActive(true); // remount/resume doesn't reset.
  }
  f.advance(9000000);
  assert.equal(
    f.clock.offer(present, () => navigation++),
    false,
  );
  assert.equal(shows, 2);
});
test("every full-screen release restarts the five-active-minute gap", () => {
  const f = extraClock();
  f.advance(600000);
  f.clock.setActive(false);
  f.advance(30000);
  f.clock.fullscreenEnded();
  f.clock.noteInteraction();
  f.clock.noteInteraction();
  f.clock.setActive(true);
  f.advance(299999);
  assert.equal(
    f.clock.offer(
      () => true,
      () => {},
    ),
    false,
  );
  f.advance(1);
  assert.equal(
    f.clock.offer(
      () => true,
      () => {},
    ),
    true,
  );
});
test("missing inventory consumes no attempt, failure consumes one and attempts cap at two", () => {
  const f = extraClock();
  f.advance(300000);
  for (let i = 0; i < 10; i++)
    assert.equal(
      f.clock.offer(
        () => false,
        () => {},
      ),
      false,
    );
  assert.equal(f.clock.state().attempts, 0);
  for (let i = 0; i < 2; i++) {
    f.clock.noteInteraction();
    f.clock.noteInteraction();
    assert.equal(
      f.clock.offer(
        (done) => {
          done();
          return true;
        },
        () => {},
      ),
      true,
    );
    assert.equal(f.clock.state().shown, 0);
    f.advance(300000);
  }
  assert.equal(
    f.clock.offer(
      () => true,
      () => {},
    ),
    false,
  );
});
test("focused feed boundaries reject controls/errors/scrolls and unregistered sensitive pages", () => {
  let time = 0,
    ready = false;
  const entry = registerExtraBoundary(
    "jobs",
    () => ready,
    () => time,
  );
  assert.equal(
    extraBoundaryReady("jobs", () => time),
    false,
  );
  ready = true;
  time = 1000;
  assert.equal(
    extraBoundaryReady("jobs", () => time),
    true,
  );
  const child = registerExtraBoundary(
    null,
    () => false,
    () => time,
  );
  assert.equal(
    extraBoundaryReady("jobs", () => time),
    false,
  );
  child.dispose();
  entry.scroll();
  assert.equal(
    extraBoundaryReady("jobs", () => time),
    false,
  );
  time += 1000;
  assert.equal(
    extraBoundaryReady("jobs", () => time),
    true,
  );
  assert.equal(
    extraBoundaryReady("community", () => time),
    false,
  );
  entry.dispose();
  assert.equal(
    extraBoundaryReady("jobs", () => time),
    false,
  );
});
test("additional path uses loaded inventory only and leaves legacy cadence counters unchanged", (t) => {
  const f = interstitial(t);
  let next = 0,
    opened = 0;
  assert.equal(
    f.manager.onAdditionalTransition(
      () => next++,
      () => opened++,
    ),
    false,
  );
  assert.equal(f.ads.length, 1);
  f.ads[0].emit("loaded");
  const before = f.manager._test.state();
  assert.equal(
    f.manager.onAdditionalTransition(
      () => next++,
      () => opened++,
    ),
    true,
  );
  f.ads[0].emit("opened");
  f.ads[0].emit("opened");
  assert.equal(opened, 1);
  for (const key of ["opens", "shownThisSession", "lastShownAt"])
    assert.equal(f.manager._test.state()[key], before[key]);
  f.ads[0].emit("closed");
  assert.equal(next, 1);
  // Original first-job eligibility still applies after its unchanged 60s gap.
  f.ads[1].emit("loaded");
  t.mock.timers.tick(60000);
  f.manager.onJobOpen(() => next++);
  assert.equal(f.ads[1].shows, 1);
  f.ads[1].emit("opened");
  f.ads[1].emit("closed");
  assert.equal(f.manager._test.state().shownThisSession, 1);
});
test("extra path requires five-minute lock gap, default legacy callers still require 60 seconds", (t) => {
  const f = interstitial(t);
  f.ads[0].emit("loaded");
  f.lock.tryAcquire("rewarded");
  f.lock.release("rewarded");
  t.mock.timers.tick(299999);
  assert.equal(
    f.manager.onAdditionalTransition(
      () => {},
      () => {},
    ),
    false,
  );
  t.mock.timers.tick(1);
  assert.equal(
    f.manager.onAdditionalTransition(
      () => {},
      () => {},
    ),
    true,
  );
  f.ads[0].emit("closed");
});
for (const failure of [
  "error",
  "reject",
  "throws",
  "start-timeout",
  "terminal-timeout",
  "consent",
]) {
  test(`extra ${failure} releases navigation/lock once and cannot show a late load`, async (t) => {
    const f = interstitial(t);
    let next = 0,
      opened = 0;
    f.ads[0].emit("loaded");
    f.ads[0].reject = failure === "reject";
    f.ads[0].throws = failure === "throws";
    assert.equal(
      f.manager.onAdditionalTransition(
        () => next++,
        () => opened++,
      ),
      true,
    );
    if (failure === "error") f.ads[0].emit("error");
    if (failure === "consent") f.deny();
    if (failure === "terminal-timeout") {
      f.ads[0].emit("opened");
      t.mock.timers.tick(120000);
    }
    if (failure === "start-timeout") t.mock.timers.tick(1500);
    await tick();
    assert.equal(next, 1);
    assert.equal(f.lock.isHeld(), false);
    f.ads[0].emit("opened");
    f.ads[0].emit("closed");
    f.ads[1]?.emit("loaded");
    t.mock.timers.tick(300000);
    assert.equal(next, 1);
    assert.equal(
      f.ads.reduce((n, a) => n + a.shows, 0),
      1,
    );
    assert.equal(opened, failure === "terminal-timeout" ? 1 : 0);
  });
}
test("lock observers cannot alter legacy ownership or throw through existing ads", () => {
  let time = 0;
  const lock = createFullscreenLock(60000, () => time);
  let calls = 0;
  const off = lock.subscribe(() => {
    calls++;
    throw Error("observer");
  });
  assert.equal(lock.tryAcquire("legacy"), true);
  lock.release("wrong");
  assert.equal(lock.isHeld(), true);
  lock.release("legacy");
  assert.equal(calls, 2);
  time = 60000;
  assert.equal(lock.tryAcquire("next"), true);
  off();
});

test("an extra also requires two deliberate interactions since the last fullscreen", () => {
  let time = 0;
  const clock = createExtraInterstitialController(() => time);
  clock.setActive(true);
  time = 300000;
  clock.noteInteraction();
  assert.equal(
    clock.offer(
      () => true,
      () => {},
    ),
    false,
  );
  clock.noteInteraction();
  assert.equal(
    clock.offer(
      (done) => {
        done();
        return true;
      },
      () => {},
    ),
    true,
  );
  clock.fullscreenEnded();
  time += 300000;
  assert.equal(
    clock.offer(
      () => true,
      () => {},
    ),
    false,
  );
});
test("extra interaction observers preserve the existing app-open observer", () => {
  const events = load("src/lib/user-interaction.ts");
  let legacy = 0,
    extra = 0;
  events.setInteractionObserver(() => legacy++);
  const off = events.subscribeUserInteraction(() => extra++);
  const broken = events.subscribeUserInteraction(() => {
    throw Error("optional");
  });
  events.signalUserInteraction();
  assert.equal(legacy, 1);
  assert.equal(extra, 1);
  off();
  broken();
  events.signalUserInteraction();
  assert.equal(legacy, 2);
  assert.equal(extra, 1);
  events.setInteractionObserver(null);
});
for (const kind of ["cv", "z83"])
  test(`${kind} iOS PDF wording and export preserve the rewarded gate`, async () => {
    const f = downloadPorts(kind);
    f.deps.Platform.OS = "ios";
    await f.handler();
    assert.equal(f.events[0], "ad");
    assert.equal(f.events.at(-1), "consume");
    assert.equal(f.alerts.at(-1)[0], "PDF ready");
    assert.match(f.alerts.at(-1)[1], /Save to Files/);
  });

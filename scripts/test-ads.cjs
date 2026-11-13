const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { load } = require("./personalization/load.cjs");
const { createAdConsent } = load("src/ads/consent-controller.ts");
const { createAppOpenController } = load("src/ads/app-open-controller.ts");
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

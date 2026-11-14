const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load, hooks } = require("./resume-fixture.cjs");
const policy = load("src/lib/resume/controller.ts", {});
function fixture(root = { routes: [] }) {
  let now = 0,
    path = "/jobs",
    busy = false,
    consent = false,
    permission = false,
    member = true;
  const h = hooks(),
    timers = new Map(),
    states = new Set(),
    links = new Set(),
    unlocks = new Set(),
    consents = new Set(),
    reminders = new Set(),
    destinations = new Set(),
    resets = [],
    auth = [];
  let serial = 0,
    refreshes = 0,
    profiles = 0;
  const subscribe = (set) => (fn) => {
    set.add(fn);
    return () => set.delete(fn);
  };
  const navigation = {
    getRootState: () => root,
    isReady: () => true,
    resetRoot: (value) => resets.push(value),
  };
  const app = {
    currentState: "active",
    addEventListener: (_event, fn) => {
      states.add(fn);
      return { remove: () => states.delete(fn) };
    },
  };
  const mod = load(
    "src/components/resume-lifecycle.tsx",
    {
      react: h.react,
      "react-native": {
        AppState: app,
        Platform: { OS: "android" },
        Linking: {
          addEventListener: (_event, fn) => {
            links.add(fn);
            return { remove: () => links.delete(fn) };
          },
        },
      },
      "expo-router": {
        useNavigationContainerRef: () => navigation,
        usePathname: () => path,
      },
      "../lib/supabase": { supabase: { auth: {} } },
      "../lib/resume/auth-refresh": {
        nativeAuthState: (_auth, state) => auth.push(state),
      },
      "../lib/resume/controller": {
        ...policy,
        createResumeController: () => policy.createResumeController(() => now),
      },
      "../lib/resume/events": {
        refreshResumedHome: () => refreshes++,
        subscribeResumeDestination: subscribe(destinations),
      },
      "../ads/fullscreen-lock": {
        fullscreenLock: { isHeld: () => busy, subscribe: subscribe(unlocks) },
      },
      "../ads/privacy": {
        adsPrivacy: {
          getSnapshot: () => ({ presenting: consent }),
          subscribe: subscribe(consents),
        },
      },
      "../lib/reminders/runtime": {
        weeklyReminders: {
          getSnapshot: () => ({ busy: permission }),
          subscribe: subscribe(reminders),
        },
      },
      "../lib/recommendations/api": {
        getHomeProfile: async () => {
          profiles++;
          return { onboarding_completed: member };
        },
      },
    },
    {
      setTimeout: (fn, ms) => {
        const id = ++serial;
        timers.set(id, { fn, at: now + ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  const props = { ready: true, userId: "alice" };
  const render = () => h.render(() => mod.ResumeLifecycle(props));
  render();
  return {
    resets,
    auth,
    states,
    links,
    props,
    render,
    path: (value) => {
      path = value;
      render();
    },
    busy: (value) => {
      busy = value;
      for (const fn of unlocks) fn();
    },
    member: (value) => (member = value),
    consent: (value) => (consent = value),
    permission: (value) => (permission = value),
    profiles: () => profiles,
    refreshes: () => refreshes,
    advance: (ms) => {
      now += ms;
      for (const [id, t] of timers) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    state: (next) => {
      app.currentState = next;
      for (const fn of states) fn(next);
    },
    link: () => {
      for (const fn of links) fn({ url: "firstjobly://community/id" });
    },
    notification: () => {
      for (const fn of destinations) fn();
    },
    dispose: () => h.dispose(),
    long() {
      this.state("background");
      this.advance(policy.BACKGROUND_HOME_THRESHOLD_MS);
      this.state("active");
      this.advance(policy.RESUME_LINK_GRACE_MS);
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("native integration: one listener despite route rerenders; one correct root Home reset", async () => {
  const f = fixture();
  f.render();
  f.path("/saved");
  assert.equal(f.states.size, 1);
  f.long();
  await tick();
  assert.deepEqual(f.resets, [
    {
      index: 0,
      routes: [
        { name: "(tabs)", state: { index: 0, routes: [{ name: "index" }] } },
      ],
    },
  ]);
  f.state("active");
  f.render();
  await tick();
  assert.equal(f.resets.length, 1);
  assert.ok(f.auth.includes("active"));
  f.dispose();
  assert.equal(f.states.size, 0);
  assert.equal(f.links.size, 0);
});
test("native integration: brief return/inactive preserve screen, no refresh or reset", async () => {
  const f = fixture();
  f.state("inactive");
  f.advance(policy.BACKGROUND_HOME_THRESHOLD_MS);
  f.state("active");
  f.state("background");
  f.advance(1000);
  f.state("active");
  f.advance(1000);
  await tick();
  assert.equal(f.resets.length, 0);
  assert.equal(f.refreshes(), 0);
  f.dispose();
});
test("native integration: Home refreshes in place; no navigation or new launch", async () => {
  const f = fixture();
  f.path("/");
  f.long();
  await tick();
  assert.equal(f.refreshes(), 1);
  assert.equal(f.resets.length, 0);
  f.dispose();
});
test("native integration: notification and deep-link destinations beat timer", async () => {
  for (const kind of ["link", "notification"]) {
    const f = fixture();
    f.state("background");
    f.advance(policy.BACKGROUND_HOME_THRESHOLD_MS);
    f.state("active");
    f[kind]();
    f.advance(policy.RESUME_LINK_GRACE_MS);
    await tick();
    assert.equal(f.resets.length, 0);
    f.dispose();
  }
});
test("native integration: reply draft defers until safe route; active ad defers further", async () => {
  const f = fixture();
  f.path("/community/id");
  f.long();
  await tick();
  assert.equal(f.resets.length, 0);
  f.busy(true);
  f.path("/jobs");
  assert.equal(f.resets.length, 0);
  f.busy(false);
  await tick();
  assert.equal(f.resets.length, 1);
  f.dispose();
});
test("native integration: auth restoration/onboarding block Home reset without signing out", async () => {
  const f = fixture();
  f.member(false);
  f.props.ready = false;
  f.render();
  f.long();
  await tick();
  assert.equal(f.resets.length, 0);
  assert.equal(f.profiles(), 0);
  f.props.ready = true;
  f.render();
  await tick();
  assert.equal(f.resets.length, 0);
  assert.equal(f.profiles(), 1);
  f.dispose();
});
test("native integration: consent or permission presentation is not a new absence", async () => {
  for (const type of ["consent", "permission", "busy"]) {
    const f = fixture();
    f[type](true);
    f.state("background");
    f.advance(policy.BACKGROUND_HOME_THRESHOLD_MS);
    f[type](false);
    f.state("active");
    f.advance(policy.RESUME_LINK_GRACE_MS);
    await tick();
    assert.equal(f.resets.length, 0);
    f.dispose();
  }
});
test("native integration: late profile lookup cannot reset after component disposal", async () => {
  const f = fixture();
  f.long();
  f.dispose();
  await tick();
  assert.equal(f.resets.length, 0);
});

test("native integration: resets retain existing Home and tab navigator keys/cache", async () => {
  const tabs = {
    name: "(tabs)",
    key: "tabs-key",
    state: {
      key: "tab-state",
      index: 1,
      routes: [
        { name: "index", key: "home-key" },
        { name: "jobs", key: "jobs-key" },
      ],
      history: [
        { type: "route", key: "home-key" },
        { type: "route", key: "jobs-key" },
      ],
    },
  };
  const f = fixture({ routes: [tabs, { name: "jobs/id", key: "detail-key" }] });
  f.long();
  await tick();
  const reset = f.resets[0];
  assert.equal(reset.routes.length, 1);
  assert.equal(reset.routes[0].key, "tabs-key");
  assert.equal(reset.routes[0].state.key, "tab-state");
  assert.equal(reset.routes[0].state.routes[0].key, "home-key");
  assert.deepEqual(reset.routes[0].state.history, [
    { type: "route", key: "home-key" },
  ]);
  assert.equal(reset.routes[0].state.index, 0);
  f.dispose();
});

test("installed TabRouter preserves Home route/cache key and clears back history", () => {
  const {
    TabRouter,
  } = require("expo-router/build/react-navigation/routers/TabRouter");
  const router = TabRouter({
    backBehavior: "history",
    initialRouteName: "index",
  });
  const options = {
    routeNames: ["index", "jobs", "circular-jobs", "saved", "more"],
    routeParamList: {},
    routeGetIdList: {},
  };
  const original = router.getInitialState(options);
  const away = router.getStateForAction(
    original,
    { type: "JUMP_TO", payload: { name: "jobs" } },
    options,
  );
  const home = {
    ...away,
    index: 0,
    history: [{ type: "route", key: away.routes[0].key }],
  };
  const restored = router.getRehydratedState(home, options);
  assert.equal(restored.key, original.key);
  assert.equal(restored.routes[0].key, original.routes[0].key);
  assert.equal(
    router.getStateForAction(restored, { type: "GO_BACK" }, options),
    null,
  );
});

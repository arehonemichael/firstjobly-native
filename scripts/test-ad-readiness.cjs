const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { load } = require("./ads-load.cjs");
const { load: isolated, hooks } = require("./resume-fixture.cjs");
const { createAdVisibility, isNearAdViewport } = load(
  "src/ads/visibility-controller.ts",
);
const { createAdViewportEvents } = load("src/ads/viewport-events.ts");
const { createInterstitialManager } = load("src/ads/interstitial-manager.ts");
const { createAppOpenController } = load("src/ads/app-open-controller.ts");
const { createRewardedManager } = load("src/ads/rewarded-manager.ts");
const { createFullscreenLock } = load("src/ads/fullscreen-lock.ts");
const { ADS_CONFIG } = load("src/ads/config.ts");
function inventory() {
  const ads = [];
  const createAd = () => {
    const handlers = new Map();
    const ad = {
      loads: 0,
      shows: 0,
      handlers,
      load() {
        this.loads++;
      },
      show() {
        this.shows++;
        this.emit("opened");
        return Promise.resolve();
      },
      emit(event, payload) {
        handlers.get(event)?.(payload);
      },
      addAdEventListener(event, fn) {
        handlers.set(event, fn);
        return () => handlers.delete(event);
      },
      removeAllListeners() {
        handlers.clear();
      },
    };
    ads.push(ad);
    return ad;
  };
  return {
    ads,
    createAd,
    port: {
      createAd,
      permitted: () => true,
      events: {
        LOADED: "loaded",
        OPENED: "opened",
        CLOSED: "closed",
        ERROR: "error",
        EARNED: "earned",
      },
    },
  };
}
function clock(t) {
  t.mock.timers.enable({
    apis: ["setTimeout", "Date"],
    now: Date.parse("2026-11-24T12:00:00Z"),
  });
}
function jsxModule(file, mocks) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", source)(
    mod,
    mod.exports,
    (name) => {
      if (name in mocks) return mocks[name];
      throw Error(name);
    },
  );
  return mod.exports;
}
const jsx = (type, props) => ({ type, props });

test("inline ads admit only nearby geometry; scrolling away retains inventory; blur/background resets admission", () => {
  const gate = createAdVisibility(),
    viewport = { width: 390, height: 844 };
  const rect = { x: 16, y: 2400, width: 358, height: 260 };
  gate.setActive(true);
  gate.measure(rect, viewport);
  assert.equal(gate.getSnapshot(), false);
  gate.measure({ ...rect, y: 930 }, viewport);
  assert.equal(gate.getSnapshot(), true);
  gate.measure(rect, viewport);
  assert.equal(gate.getSnapshot(), true);
  gate.setActive(false);
  assert.equal(gate.getSnapshot(), false);
  gate.measure({ ...rect, y: 100 }, viewport);
  assert.equal(gate.getSnapshot(), false);
  gate.setActive(true);
  gate.measure(rect, viewport);
  assert.equal(gate.getSnapshot(), false);
  gate.measure({ ...rect, y: 100 }, viewport);
  assert.equal(gate.getSnapshot(), true);
  for (const invalid of [
    { ...rect, x: 500, y: 20 },
    { ...rect, width: 0, y: 20 },
    { ...rect, y: NaN },
    { ...rect, y: -500 },
  ])
    assert.equal(isNearAdViewport(invalid, viewport), false);
});
test("viewport signals coalesce and cancel scheduled work when the last focused placement leaves", () => {
  const queue = new Set();
  let count = 0;
  const bus = createAdViewportEvents((fn) => {
    queue.add(fn);
    return () => queue.delete(fn);
  });
  bus.signal();
  assert.equal(queue.size, 0);
  const off = bus.subscribe(() => count++);
  bus.signal();
  bus.signal();
  assert.equal(queue.size, 1);
  [...queue][0]();
  queue.clear();
  assert.equal(count, 1);
  bus.signal();
  off();
  assert.equal(queue.size, 0);
});
test("real visibility wrapper rejects offscreen and stale native measurements and cleans focus/state/scroll listeners", () => {
  const h = hooks();
  h.react.useSyncExternalStore = (_, get) => get();
  let scroll, state, size;
  const callbacks = [];
  let removed = 0;
  const app = {
    currentState: "active",
    addEventListener: (_, fn) => {
      state = fn;
      return {
        remove() {
          removed++;
        },
      };
    },
  };
  const { AdVisibility } = jsxModule("src/ads/AdVisibility.tsx", {
    react: h.react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      AppState: app,
      Dimensions: {
        get: () => ({ width: 390, height: 844 }),
        addEventListener: (_, fn) => {
          size = fn;
          return {
            remove() {
              removed++;
            },
          };
        },
      },
    },
    "expo-router": { useFocusEffect: h.focusEffect },
    "./fullscreen-lock": {
      fullscreenLock: {
        isHeld: () => false,
        subscribe: () => () => {
          removed++;
        },
      },
    },
    "./visibility-controller": { createAdVisibility },
    "./viewport-events": {
      subscribeAdViewportChanges: (fn) => {
        scroll = fn;
        return () => {
          removed++;
        };
      },
    },
  });
  const render = () =>
    h.render(() => AdVisibility({ children: "AD", reserveHeight: 260 }));
  let tree = render();
  tree.props.ref.current = { measureInWindow: (fn) => callbacks.push(fn) };
  const cleanup = h.focus();
  callbacks.shift()(0, 2000, 390, 260);
  assert.equal(render().props.children, null);
  scroll();
  callbacks.shift()(0, 100, 390, 260);
  assert.equal(render().props.children, "AD");
  app.currentState = "background";
  state("background");
  assert.equal(render().props.children, null);
  app.currentState = "active";
  state("active");
  const stale = callbacks.shift();
  cleanup();
  stale(0, 100, 390, 260);
  assert.equal(render().props.children, null);
  assert.equal(removed, 4);
  size();
  assert.equal(callbacks.length, 0);
});
test("tracked scroll components retain existing handlers and props while notifying visibility", () => {
  let signals = 0,
    original = 0,
    gestures = 0;
  const event = { nativeEvent: { contentOffset: { y: 42 } } };
  const { AdScrollView, AdFlatList } = jsxModule("src/ads/AdScrollView.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { FlatList: "List", ScrollView: "Scroll" },
    "../lib/user-interaction": { signalStartupGesture: () => gestures++ },
    "./viewport-events": { signalAdViewportChange: () => signals++ },
  });
  for (const component of [AdScrollView, AdFlatList]) {
    const tree = component({
      onScroll: (e) => {
        assert.equal(e, event);
        original++;
      },
      onLayout: () => original++,
      onScrollBeginDrag: (e) => { assert.equal(e, event); original++; },
      scrollEventThrottle: 80,
      data: [1],
    });
    assert.equal(tree.props.scrollEventThrottle, 80);
    assert.deepEqual(tree.props.data, [1]);
    tree.props.onScroll(event);
    tree.props.onLayout(event);
    tree.props.onScrollBeginDrag(event);
  }
  assert.equal(signals, 4);
  assert.equal(gestures, 2);
  assert.equal(original, 6);
});
test("silent interstitial load times out, retries within policy and never holds navigation or accepts a stale callback", (t) => {
  clock(t);
  const f = inventory();
  const c = createInterstitialManager(
    f.port,
    ADS_CONFIG.interstitial,
    createFullscreenLock(0),
  );
  t.after(() => c._test.reset());
  c.prepare();
  const late = f.ads[0].handlers.get("loaded");
  let navigations = 0;
  c.onJobOpen(() => navigations++);
  assert.equal(navigations, 1);
  t.mock.timers.tick(10000);
  t.mock.timers.tick(5000);
  assert.equal(f.ads.length, 2);
  late();
  c.onJobOpen(() => navigations++);
  assert.equal(navigations, 2);
  assert.equal(f.ads[1].shows, 0);
  f.ads[1].emit("loaded");
  c.onJobOpen(() => navigations++);
  assert.equal(f.ads[1].shows, 1);
  f.ads[1].emit("closed");
  assert.equal(navigations, 3);
});
test("loaded interstitial cancels its load timeout and cannot silently become a failed request", (t) => {
  clock(t);
  const f = inventory();
  const c = createInterstitialManager(f.port);
  t.after(() => c._test.reset());
  c.prepare();
  f.ads[0].emit("loaded");
  t.mock.timers.tick(20000);
  assert.equal(f.ads.length, 1);
});
async function appOpen(t) {
  const f = inventory();
  const c = createAppOpenController({
    createAd: f.createAd,
    storage: { getItem: async () => null, setItem: async () => {} },
    lock: createFullscreenLock(0),
  });
  t.after(() => c.dispose());
  c.setContext({ eligible: true, consent: true });
  await c.initialize();
  return { ...f, c };
}
test("silent app-open recovery preloads only; late inventory never shows until another eligible foreground", async (t) => {
  clock(t);
  const f = await appOpen(t);
  const late = f.ads[0].handlers.get("loaded");
  t.mock.timers.tick(10000);
  t.mock.timers.tick(5000);
  assert.equal(f.ads.length, 2);
  late();
  assert.equal(f.c.getDebugState().loadedAt, null);
  f.ads[1].emit("loaded");
  assert.equal(f.ads[1].shows, 0);
  f.c.onState("background");
  t.mock.timers.tick(2000);
  f.c.onState("active");
  t.mock.timers.tick(75);
  assert.equal(f.ads[1].shows, 1);
});
test("app-open no-fill retries are bounded and permission withdrawal cancels retry work", async (t) => {
  clock(t);
  const f = await appOpen(t);
  for (const delay of [5000, 15000, 45000]) {
    f.ads.at(-1).emit("error");
    t.mock.timers.tick(delay);
  }
  f.ads.at(-1).emit("error");
  t.mock.timers.tick(120000);
  assert.equal(f.ads.length, 4);
  f.c.setContext({ eligible: false, consent: false });
  t.mock.timers.tick(120000);
  assert.equal(f.ads.length, 4);
});
test("leaving a download placement cancels unused rewarded inventory; re-entry updates readiness without consuming earned credit", (t) => {
  clock(t);
  const f = inventory();
  const c = createRewardedManager(f.port);
  t.after(() => c._test.reset());
  let changes = 0;
  const unsub = c.subscribeReadiness(() => changes++);
  t.after(unsub);
  const release = c.retainPlacement();
  assert.equal(c.isReady(), false);
  f.ads[0].emit("loaded");
  assert.equal(c.isReady(), true);
  release();
  assert.equal(c.isReady(), false);
  c.prepare();
  assert.equal(f.ads.length, 1);
  t.mock.timers.tick(60000);
  assert.equal(f.ads.length, 1);
  const release2 = c.retainPlacement();
  assert.equal(f.ads.length, 2);
  f.ads[1].emit("loaded");
  assert.equal(c.isReady(), true);
  release2();
  assert.ok(changes >= 4);
});
test("rewarded screen focus loss preserves earned retry credit and does not interrupt an already opened ad", async (t) => {
  clock(t);
  const f = inventory();
  const c = createRewardedManager(
    f.port,
    ADS_CONFIG.rewarded,
    createFullscreenLock(0),
  );
  t.after(() => c._test.reset());
  const release = c.retainPlacement();
  f.ads[0].emit("loaded");
  const result = c.request();
  f.ads[0].emit("earned");
  release();
  assert.equal(c.getCredit(), true);
  f.ads[0].emit("closed");
  assert.equal(await result, "earned");
  c.prepare();
  assert.equal(f.ads.length, 1);
  assert.equal(c.getCredit(), true);
  c.consumeReward();
  assert.equal(c.getCredit(), false);
  assert.equal(f.ads.length, 1);
});
test("app-open consent guard is re-evaluated after one second without replaying startup or refetching profile", async (t) => {
  clock(t);
  const calls = [];
  let profiles = 0;
  const consent = {
    canRequestAds: true,
    presenting: false,
    lastUiAt: Date.now(),
  };
  const runtime = {
    setContext: (x) => calls.push(x),
    initialize: async () => {},
    beginColdStart: () => {},
    dispose: () => {},
    onState: () => {},
    markInteraction: () => {},
  };
  const module = isolated(
    "src/ads/AdMobLifecycle.tsx",
    {
      "@react-native-async-storage/async-storage": {},
      react: { useLayoutEffect: (fn) => fn(), useRef: (x) => ({ current: x }) },
      "expo-constants": {},
      "../lib/runtime-environment": {
        isExpoGo: false,
        supportsNativeAds: true,
      },
      "./diagnostics": { adDiagnostics: { record: () => {} } },
      "react-native": {
        Platform: { OS: "android" },
        AppState: {
          currentState: "active",
          addEventListener: () => ({ remove() {} }),
        },
        Linking: { addEventListener: () => ({ remove() {} }) },
      },
      "./sdk": { mobileAdsSDK: {} },
      "./privacy": {
        adsPrivacy: {
          getSnapshot: () => consent,
          subscribe: () => () => {},
          prepare: async () => {},
        },
        getRequestOptions: () => ({}),
        useAdsConsent: () => consent,
      },
      "./app-open-controller": { createAppOpenController: () => runtime },
      "./config": { ADS_CONFIG, ADS_TEST_MODE: true, AD_UNITS: {} },
      "../lib/user-interaction": { setInteractionObserver: () => {} },
      "../lib/recommendations/api": {
        getHomeProfile: async () => {
          profiles++;
          return { onboarding_completed: true };
        },
      },
    },
    { __DEV__: true },
  );
  t.after(() => module.disposeAdvertisingRuntime());
  module.AdMobLifecycle({ ready: true, pathname: "/", userId: "alice" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.at(-1).eligible, false);
  t.mock.timers.tick(1001);
  assert.equal(calls.at(-1).eligible, true);
  assert.equal(profiles, 1);
  module.disposeAdvertisingRuntime();
  const count = calls.length;
  t.mock.timers.tick(10000);
  assert.equal(calls.length, count);
});

test("app-open does not request inventory for unconfirmed/guest routes; confirmed readiness can preload without authorizing presentation", async (t) => {
  clock(t);
  const f = inventory();
  const c = createAppOpenController({
    createAd: f.createAd,
    storage: { getItem: async () => null, setItem: async () => {} },
  });
  t.after(() => c.dispose());
  c.setContext({ eligible: false, consent: true, canPreload: false });
  await c.initialize();
  assert.equal(f.ads.length, 0);
  c.setContext({ eligible: false, consent: true, canPreload: true });
  assert.equal(f.ads.length, 1);
  f.ads[0].emit("loaded");
  assert.equal(f.ads[0].shows, 0);
  c.setContext({ eligible: false, consent: true, canPreload: false });
  f.ads[0].emit("error");
  t.mock.timers.tick(60000);
  assert.equal(f.ads.length, 1);
});

test("a startup scroll gesture cancels app-open without adding extra-ad interaction credit", () => {
  const interaction = isolated("src/lib/user-interaction.ts", {});
  let startup = 0,
    extra = 0;
  interaction.setInteractionObserver(() => startup++);
  const remove = interaction.subscribeUserInteraction(() => extra++);
  interaction.signalStartupGesture();
  assert.equal(startup, 1);
  assert.equal(extra, 0);
  interaction.signalUserInteraction();
  assert.equal(startup, 2);
  assert.equal(extra, 1);
  remove();
  interaction.setInteractionObserver(null);
});

/* global __dirname */
// Evaluate the actual platform modules with a native SDK that would throw in
// Expo Go. This catches eager imports before route components can export.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "..");
function app(os, environment, dev = true, forceTest = false, iosEnv = {}) {
  const cache = new Map(),
    calls = {
      sdk: 0,
      load: 0,
      show: 0,
      prevent: 0,
      options: 0,
      hide: 0,
      appStateSubscriptions: 0,
      consentRetries: 0,
      appOpenUnits: [],
      appOpenAds: [],
      appOpenShows: 0,
      rewardedUnits: [],
      rewardedAds: [],
      rewardedShows: 0,
      alerts: [],
    };
  const consentState = {
    canRequestAds:
      ["android", "ios"].includes(os) && environment !== "storeClient",
    personalized: false,
    privacyRequired: false,
    failed: false,
  };
  let appStateListener = null;
  let renderState = null;
  const react = {
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useCallback: (f) => f,
    useMemo: (factory, deps) => {
      if (!renderState) return factory();
      const i = renderState.cursor++;
      const prior = renderState.memos[i];
      if (!prior || deps.some((d, n) => !Object.is(d, prior.deps[n])))
        renderState.memos[i] = { deps, value: factory() };
      return renderState.memos[i].value;
    },
    useLayoutEffect: (f) => f(),
    useEffect: (f, deps) => {
      if (!renderState) return f();
      const i = renderState.cursor++;
      const prior = renderState.deps[i];
      if (!deps || !prior || deps.some((d, n) => !Object.is(d, prior[n]))) {
        renderState.cleanups[i]?.();
        renderState.cleanups[i] = f();
        renderState.deps[i] = deps;
      }
    },
    useState: (v) => {
      if (!renderState) return [typeof v === "function" ? v() : v, () => {}];
      const state = renderState,
        i = state.cursor++;
      if (!(i in state.values))
        state.values[i] = typeof v === "function" ? v() : v;
      return [
        state.values[i],
        (next) => {
          state.values[i] =
            typeof next === "function" ? next(state.values[i]) : next;
        },
      ];
    },
    useRef: (v) => {
      if (!renderState) return { current: v };
      const i = renderState.cursor++;
      if (!(i in renderState.values)) renderState.values[i] = { current: v };
      return renderState.values[i];
    },
  };
  const sdk = {
    AdEventType: {
      LOADED: "loaded",
      OPENED: "opened",
      CLOSED: "closed",
      ERROR: "error",
    },
    TestIds: {
      ADAPTIVE_BANNER: "test-banner",
      APP_OPEN: "test-open",
      INTERSTITIAL: "test-interstitial",
      NATIVE: "test-native",
      REWARDED: "test-rewarded",
      REWARDED_INTERSTITIAL: "test-rewarded-interstitial",
    },
    RewardedAdEventType: {
      LOADED: "rewarded_loaded",
      EARNED_REWARD: "rewarded_earned_reward",
    },
    RewardedAd: {
      createForAdRequest(unit, options) {
        calls.rewardedUnits.push({ unit, options });
        const handlers = new Map();
        const ad = {
          load() {},
          show: async () => {
            calls.rewardedShows++;
          },
          removeAllListeners() {
            handlers.clear();
          },
          addAdEventListener(event, handler) {
            handlers.set(event, handler);
            return () => handlers.delete(event);
          },
          emit(event) {
            handlers.get(event)?.();
          },
        };
        calls.rewardedAds.push(ad);
        return ad;
      },
    },
    InterstitialAd: {
      createForAdRequest: () => ({
        load: () => calls.load++,
        show: async () => calls.show++,
        addAdEventListener: () => () => {},
        removeAllListeners() {},
      }),
    },
    useInterstitialAd: () => ({
      isLoaded: false,
      isClosed: false,
      load: () => calls.load++,
      show: async () => calls.show++,
    }),
    BannerAd: () => null,
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: "adaptive" },
    AppOpenAd: {
      createForAdRequest: (unit, options) => {
        calls.appOpenUnits.push({ unit, options });
        const handlers = new Map();
        const ad = {
          load() {},
          show: async () => {
            calls.appOpenShows++;
          },
          removeAllListeners() {
            handlers.clear();
          },
          addAdEventListener(event, handler) {
            handlers.set(event, handler);
            return () => handlers.delete(event);
          },
          emit(event) {
            handlers.get(event)?.();
          },
        };
        calls.appOpenAds.push(ad);
        return ad;
      },
    },
    NativeAd: { createForAdRequest: async () => ({ destroy() {} }) },
  };
  sdk.RewardedInterstitialAd = {
    createForAdRequest(unit, options) {
      const ad = sdk.RewardedAd.createForAdRequest(unit, options);
      calls.rewardedUnits.at(-1).format = "rewarded-interstitial";
      return ad;
    },
  };
  const Stack = () => null;
  Stack.Screen = function MockScreen() {
    return null;
  };
  const externals = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props, key) => ({ type, props, key }),
      jsxs: (type, props, key) => ({ type, props, key }),
      Fragment: "fragment",
    },
    "react-native": {
      Linking: { addEventListener: () => ({ remove() {} }) },
      AppState: {
        currentState: "active",
        addEventListener: (_event, listener) => {
          appStateListener = listener;
          calls.appStateSubscriptions++;
          return { remove() {} };
        },
      },
      Alert: { alert: (...args) => calls.alerts.push(args) },
      Platform: { OS: os, select: (v) => v[os] ?? v.default },
      StyleSheet: { create: (v) => v },
      View: "View",
      Text: "Text",
      ScrollView: "ScrollView",
      Image: "Image",
      ActivityIndicator: "ActivityIndicator",
    },
    "expo-constants": {
      __esModule: true,
      default: { executionEnvironment: environment },
      ExecutionEnvironment: { StoreClient: "storeClient" },
    },
    "expo-splash-screen": {
      preventAutoHideAsync: async () => calls.prevent++,
      setOptions: () => calls.options++,
      hide: () => calls.hide++,
      hideAsync: async () => calls.hide++,
    },
    "expo-router": { Stack, usePathname: () => "/" },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "@expo-google-fonts/plus-jakarta-sans": { useFonts: () => [true, null] },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "lucide-react-native": { Lightbulb: "Lightbulb" },
    "@react-native-async-storage/async-storage": {
      __esModule: true,
      default: { getItem: async () => "2", setItem: async () => {} },
    },
  };
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full).exports;
    if (full.endsWith("/src/ads/privacy.ts"))
      return {
        getRequestOptions: () => ({
          requestNonPersonalizedAdsOnly: !(
            consentState.canRequestAds && consentState.personalized
          ),
        }),
        useAdsConsent: () => consentState,
        adsPrivacy: {
          getSnapshot: () => ({
            ...consentState,
            presenting: false,
            lastUiAt: 0,
          }),
          prepare: async () => {},
          retryOnForeground: async () => {
            calls.consentRetries++;
          },
          subscribe: () => () => {},
        },
      };
    if (full.endsWith("/src/lib/community/store.ts")) return {};
    if (full.endsWith("/src/lib/recommendations/api.ts"))
      return { getHomeProfile: async () => ({ onboarding_completed: true }) };
    if (full.includes("/src/hooks/"))
      return {
        useAuth: () => ({
          userId: null,
          loading: false,
          error: null,
          retry() {},
        }),
        useHomeHeroSession() {},
        useCommunityNotifications() {},
        useMotionPreference: () => ({ reducedMotion: true, motionReady: true }),
      };
    if (full.includes("/components/ui/primitives"))
      return { AppText: "Text", AppPressable: "Pressable" };
    if (full.endsWith(".css")) return {};
    if (/\.(ttf|png)$/.test(full)) return 1;
    const module = { exports: {} };
    cache.set(full, module);
    const js = ts.transpileModule(fs.readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const local = (name) => {
      if (name === "react-native-google-mobile-ads") {
        calls.sdk++;
        if (environment === "storeClient" || os === "web")
          throw Error("RNGoogleMobileAdsModule is unavailable");
        return sdk;
      }
      if (name in externals) return externals[name];
      if (name.startsWith(".")) {
        let target = path.resolve(path.dirname(full), name);
        if (!fs.existsSync(target)) {
          target += fs.existsSync(target + ".ts") ? ".ts" : ".tsx";
        }
        return load(path.relative(root, target));
      }
      throw Error("Unexpected import " + name);
    };
    new Function("module", "exports", "require", "__DEV__", "process", js)(
      module,
      module.exports,
      local,
      dev,
      {
        env: {
          EXPO_PUBLIC_ADS_TEST_MODE: forceTest ? "true" : undefined,
          ...iosEnv,
        },
      },
    );
    return module.exports;
  }
  return {
    load,
    calls,
    sdk,
    setConsent: (next) => Object.assign(consentState, next),
    emitAppState: (next) => {
      externals["react-native"].AppState.currentState = next;
      appStateListener?.(next);
    },
    renderer(fn, props) {
      const state = {
        values: [],
        cleanups: [],
        deps: [],
        memos: [],
        cursor: 0,
      };
      return {
        render() {
          state.cursor = 0;
          renderState = state;
          try {
            return fn(props);
          } finally {
            renderState = null;
          }
        },
        dispose() {
          state.cleanups.forEach((f) => f?.());
        },
      };
    },
  };
}
for (const [os, environment] of [
  ["android", "storeClient"],
  ["ios", "storeClient"],
  ["web", "bare"],
])
  test(`${os}/${environment}: no ad SDK evaluation, all ad entry points remain safe`, async () => {
    const a = app(os, environment);
    const hooks = a.load("src/ads/useJobInterstitial.ts");
    let navigations = 0;
    await hooks
      .useEarlyJobInterstitial()
      .openJobWithEarlyInterstitial(() => navigations++);
    hooks.useJobInterstitial().continueWithOptionalAd(() => navigations++);
    assert.equal(navigations, 2);
    assert.equal(
      await a
        .load("src/ads/useRewardedDownload.ts")
        .useRewardedDownload()
        .beforeDownload(),
      true,
    );
    assert.equal(a.calls.rewardedUnits.length, 0);
    assert.equal(a.load("src/ads/AdBanner.tsx").AdBanner(), null);
    assert.equal(
      a.load("src/ads/NativeAdBlock.tsx").NativeAdBlock({ variant: "feed" }),
      null,
    );
    assert.equal(a.load("src/ads/AdMobLifecycle.tsx").AdMobLifecycle(), null);
    assert.equal(a.calls.sdk, 0);
    if (os === "web") {
      assert.equal(a.load("src/ads/sdk.web.ts").mobileAdsSDK, null);
      assert.equal(a.load("src/ads/sdk.web.ts").nativeAdsPlatform, "web");
      assert.equal(a.calls.sdk, 0);
    }
    const rootElement = a.load("src/app/_layout.tsx").default();
    rootElement.props.children[1].props.onLayout();
    assert.equal(a.calls.prevent, 0);
    assert.equal(a.calls.options, 0);
    assert.equal(a.calls.hide, 0);
  });
test("custom Android development build loads the SDK and keeps test IDs/ad loading", async () => {
  const a = app("android", "bare");
  const units = a.load("src/ads/config.ts").AD_UNITS;
  assert.equal(units.interstitial, "test-interstitial");
  const hook = a
    .load("src/ads/useJobInterstitial.ts")
    .useEarlyJobInterstitial();
  assert.equal(a.calls.load, 1);
  a.load("src/ads/useJobInterstitial.ts").useEarlyJobInterstitial();
  assert.equal(
    a.calls.load,
    1,
    "multiple screen mounts share the same inventory",
  );
  let navigation = 0;
  await hook.openJobWithEarlyInterstitial(() => navigation++);
  assert.equal(navigation, 1);
  assert.equal(a.calls.sdk, 1);
  const element = a.load("src/app/_layout.tsx").default();
  element.props.children[1].props.onLayout();
  assert.equal(a.calls.prevent, 1);
  assert.equal(a.calls.options, 1);
  assert.equal(a.calls.hide, 1);
});
test("standalone production keeps the existing real ad unit IDs", () => {
  const a = app("android", "standalone", false),
    units = a.load("src/ads/config.ts").AD_UNITS;
  assert.equal(units.interstitial, "ca-app-pub-1505001993402465/4410223100");
  assert.equal(units.banner, "ca-app-pub-1505001993402465/3915348751");
  assert.equal(units.rewarded, "ca-app-pub-1505001993402465/9710408715");
  assert.equal(a.calls.sdk, 1);
});

test("root remounts share one app-open controller, subscription and test-unit preload", async () => {
  const a = app("android", "bare");
  const component = a.load("src/ads/AdMobLifecycle.tsx");
  component.AdMobLifecycle({ ready: true, pathname: "/", userId: "fixture" });
  component.AdMobLifecycle({ ready: true, pathname: "/", userId: "fixture" });
  await new Promise((r) => setImmediate(r));
  assert.equal(a.calls.appStateSubscriptions, 1);
  assert.equal(a.calls.appOpenUnits.length, 1);
  assert.equal(a.calls.appOpenUnits[0].unit, "test-open");
  assert.equal(
    a.calls.appOpenUnits[0].options.requestNonPersonalizedAdsOnly,
    true,
  );
  component.disposeAdvertisingRuntime();
});

test("iOS unconfigured release safely disables ads rather than using Android units", () => {
  const a = app("ios", "bare", false);
  assert.equal(a.load("src/ads/sdk.ts").mobileAdsSDK, null);
  assert.equal(a.calls.sdk, 0);
});

test("internal release builds can explicitly request documented test units", () => {
  const a = app("android", "standalone", false, true);
  assert.equal(a.load("src/ads/config.ts").AD_UNITS.banner, "test-banner");
});

test("Home banner reserves space, uses the provider test unit/size, and removes no-fill inventory", () => {
  const a = app("android", "bare"),
    component = a.load("src/ads/AdBanner.tsx"),
    view = a.renderer(component.AdBanner, { placement: "home" });
  const find = (tree, predicate) => {
    if (!tree) return null;
    if (Array.isArray(tree)) {
      for (const child of tree) {
        const hit = find(child, predicate);
        if (hit) return hit;
      }
      return null;
    }
    return predicate(tree) ? tree : find(tree.props?.children, predicate);
  };
  let tree = view.render();
  const inventory = find(tree, (n) => typeof n.props?.onLayout === "function");
  inventory.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  tree = view.render();
  const authorized = find(tree, (n) => typeof n.type === "function");
  const authorizedView = a.renderer(authorized.type, authorized.props);
  tree = authorizedView.render();
  assert.ok(find(tree, (n) => n.props?.testID === "home-ad-placement"));
  const ad = find(tree, (n) => n.type === a.sdk.BannerAd);
  assert.equal(ad.props.unitId, "test-banner");
  assert.equal(ad.props.width, 294);
  assert.equal(ad.props.size, "adaptive");
  assert.equal(ad.props.requestOptions.requestNonPersonalizedAdsOnly, true);
  ad.props.onAdLoaded({ width: 320, height: 50 });
  tree = authorizedView.render();
  assert.equal(
    find(tree, (n) => n.props?.children === "Loading advertisement…"),
    null,
  );
  ad.props.onAdFailedToLoad(Error("no fill"));
  tree = authorizedView.render();
  assert.equal(
    find(tree, (n) => n.props?.testID === "home-ad-placement"),
    null,
  );
  authorizedView.dispose();
  view.dispose();
});

function findNode(tree, predicate) {
  if (!tree) return null;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
    return null;
  }
  return predicate(tree) ? tree : findNode(tree.props?.children, predicate);
}
test("banner load timeout/backoff remount, successful load and consent/width reset use real component state", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const a = app("android", "bare"),
    component = a.load("src/ads/AdBanner.tsx");
  const rootView = a.renderer(component.AdBanner, { placement: "home" });
  let root = rootView.render();
  const layout = findNode(root, (n) => typeof n.props?.onLayout === "function");
  layout.props.onLayout({ nativeEvent: { layout: { width: 346 } } });
  root = rootView.render();
  let child = findNode(root, (n) => typeof n.type === "function");
  const firstKey = child.key,
    view = a.renderer(child.type, child.props);
  let tree = view.render(),
    ad = findNode(tree, (n) => n.type === a.sdk.BannerAd);
  const firstAd = ad;
  assert.equal(ad.props.width, 320);
  t.mock.timers.tick(12000);
  assert.equal(view.render(), null);
  firstAd.props.onAdLoaded();
  assert.equal(view.render(), null, "late load cannot cancel failure recovery");
  t.mock.timers.tick(29999);
  assert.equal(view.render(), null);
  t.mock.timers.tick(1);
  tree = view.render();
  ad = findNode(tree, (n) => n.type === a.sdk.BannerAd);
  assert.notEqual(ad.key, firstAd.key);
  ad.props.onAdLoaded();
  tree = view.render();
  assert.equal(
    findNode(tree, (n) => n.props?.children === "Loading advertisement…"),
    null,
  );
  a.setConsent({ canRequestAds: false });
  root = rootView.render();
  assert.equal(
    findNode(root, (n) => typeof n.type === "function"),
    null,
  );
  view.dispose();
  a.setConsent({ canRequestAds: true });
  root = rootView.render();
  child = findNode(root, (n) => typeof n.type === "function");
  const regrant = a.renderer(child.type, child.props);
  tree = regrant.render();
  assert.ok(
    findNode(tree, (n) => n.props?.children === "Loading advertisement…"),
  );
  regrant.dispose();
  layout.props.onLayout({ nativeEvent: { layout: { width: 400 } } });
  root = rootView.render();
  child = findNode(root, (n) => typeof n.type === "function");
  assert.notEqual(child.key, firstKey);
  rootView.dispose();
});
test("banner/native/interstitial/app-open disabled flags stop their actual native entry paths", async () => {
  const a = app("android", "bare"),
    config = a.load("src/ads/config.ts").ADS_CONFIG;
  config.banner.enabled = false;
  assert.equal(a.load("src/ads/AdBanner.tsx").AdBanner(), null);
  config.native.feedEnabled = false;
  config.native.detailEnabled = false;
  const native = a.load("src/ads/NativeAdBlock.tsx");
  assert.equal(native.NativeAdBlock({ variant: "feed" }), null);
  assert.equal(native.NativeAdBlock({ variant: "detail" }), null);
  config.interstitial.enabled = false;
  const hook = a
    .load("src/ads/useJobInterstitial.ts")
    .useEarlyJobInterstitial();
  let proceed = 0;
  await hook.openJobWithEarlyInterstitial(() => proceed++);
  assert.equal(proceed, 1);
  assert.equal(a.calls.load, 0);
  config.appOpen.enabled = false;
  const lifecycle = a.load("src/ads/AdMobLifecycle.tsx");
  lifecycle.AdMobLifecycle({ ready: true, pathname: "/", userId: "fixture" });
  await new Promise((r) => setImmediate(r));
  assert.equal(a.calls.appOpenUnits.length, 0);
  lifecycle.disposeAdvertisingRuntime();
});

test("native feed reserves loading space, times out, retries once and destroys both late promises", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const a = app("android", "bare"),
    pending = [];
  let destroyed = 0;
  a.sdk.NativeAd.createForAdRequest = (unit, options) => {
    assert.equal(unit, "test-native");
    assert.equal(options.requestNonPersonalizedAdsOnly, true);
    return new Promise((resolve) => pending.push(resolve));
  };
  const component = a.load("src/ads/NativeAdBlock.tsx");
  const root = component.NativeAdBlock({ variant: "feed" });
  const view = a.renderer(root.type, root.props);
  assert.equal(view.render().props.style.minHeight, 260);
  assert.equal(pending.length, 1);
  t.mock.timers.tick(10000);
  assert.equal(view.render(), null);
  t.mock.timers.tick(4999);
  assert.equal(pending.length, 1);
  t.mock.timers.tick(1);
  assert.equal(view.render().props.style.minHeight, 260);
  assert.equal(pending.length, 2);
  t.mock.timers.tick(10000);
  assert.equal(view.render(), null);
  t.mock.timers.tick(600000);
  assert.equal(pending.length, 2);
  for (const resolve of pending)
    resolve({
      destroy() {
        destroyed++;
      },
    });
  await new Promise((r) => setImmediate(r));
  assert.equal(destroyed, 2);
  view.dispose();
});

test("consent foreground retry is wired once to real background returns, not inactive-only or repeated active events", () => {
  const a = app("android", "bare"),
    lifecycle = a.load("src/ads/AdMobLifecycle.tsx");
  lifecycle.AdMobLifecycle({ ready: true, pathname: "/", userId: "fixture" });
  a.emitAppState("inactive");
  a.emitAppState("active");
  assert.equal(a.calls.consentRetries, 0);
  a.emitAppState("background");
  a.emitAppState("inactive");
  a.emitAppState("active");
  a.emitAppState("active");
  assert.equal(a.calls.consentRetries, 1);
  lifecycle.disposeAdvertisingRuntime();
});

test("Android lifecycle wires a cold app-open opportunity once and does not replay it on root remount", async (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-11-13T10:00:00Z"),
  });
  const a = app("android", "bare"),
    lifecycle = a.load("src/ads/AdMobLifecycle.tsx");
  lifecycle.AdMobLifecycle({ ready: true, pathname: "/", userId: "fixture" });
  await new Promise((r) => setImmediate(r));
  a.calls.appOpenAds[0].emit("loaded");
  t.mock.timers.tick(75);
  assert.equal(a.calls.appOpenShows, 1);
  a.calls.appOpenAds[0].emit("closed");
  lifecycle.AdMobLifecycle({ ready: true, pathname: "/", userId: "fixture" });
  await new Promise((r) => setImmediate(r));
  a.calls.appOpenAds[1].emit("loaded");
  t.mock.timers.tick(2000);
  assert.equal(a.calls.appOpenShows, 1);
  lifecycle.disposeAdvertisingRuntime();
});

test("rewarded download hook uses the official test unit, needs completion and consumes only after save", async (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-11-13T12:00:00Z"),
  });
  const a = app("android", "bare"),
    hook = a.load("src/ads/useRewardedDownload.ts"),
    view = a.renderer(hook.useRewardedDownload);
  let control = view.render();
  assert.equal(control.canOfferAd, true);
  assert.equal(a.calls.rewardedUnits[0].unit, "test-rewarded");
  assert.equal(
    a.calls.rewardedUnits[0].options.requestNonPersonalizedAdsOnly,
    true,
  );
  const ad = a.calls.rewardedAds[0];
  ad.emit("rewarded_loaded");
  const pending = control.beforeDownload();
  ad.emit("opened");
  ad.emit("rewarded_earned_reward");
  ad.emit("closed");
  assert.equal(await pending, true);
  control = view.render();
  assert.equal(control.canOfferAd, false, "retry uses earned credit");
  assert.equal(await control.beforeDownload(), true);
  assert.equal(a.calls.rewardedShows, 1);
  control.completeDownload();
  control = view.render();
  assert.equal(control.canOfferAd, true);
  view.dispose();
  a.load("src/ads/rewarded-manager.ts").rewardedManager._test.reset();
});
test("leaving the download screen during an ad cannot start a late download", async (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-11-13T12:00:00Z"),
  });
  const a = app("android", "bare"),
    hook = a.load("src/ads/useRewardedDownload.ts"),
    view = a.renderer(hook.useRewardedDownload);
  const control = view.render(),
    ad = a.calls.rewardedAds[0];
  ad.emit("rewarded_loaded");
  const pending = control.beforeDownload();
  view.dispose();
  ad.emit("rewarded_earned_reward");
  ad.emit("closed");
  assert.equal(await pending, false);
  a.load("src/ads/rewarded-manager.ts").rewardedManager._test.reset();
});

test("closing an opt-in rewarded ad early returns false and shows a plain cancellation message", async (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-11-13T12:00:00Z"),
  });
  const a = app("android", "bare"),
    hook = a.load("src/ads/useRewardedDownload.ts"),
    view = a.renderer(hook.useRewardedDownload);
  const control = view.render(),
    ad = a.calls.rewardedAds[0];
  ad.emit("rewarded_loaded");
  const pending = control.beforeDownload();
  ad.emit("opened");
  ad.emit("closed");
  assert.equal(await pending, false);
  assert.equal(a.calls.alerts[0][0], "Download not started");
  view.dispose();
  a.load("src/ads/rewarded-manager.ts").rewardedManager._test.reset();
});

for (const [dev, forceTest] of [
  [true, false],
  [false, true],
]) {
  test(`iOS ${dev ? "development" : "TestFlight test mode"} loads the native SDK with official test units`, () => {
    const a = app("ios", "bare", dev, forceTest);
    const units = a.load("src/ads/config.ts").AD_UNITS;
    assert.equal(units.banner, "test-banner");
    assert.equal(units.appOpen, "test-open");
    assert.equal(units.interstitial, "test-interstitial");
    assert.equal(units.rewarded, "test-rewarded");
    assert.equal(a.calls.sdk, 1);
    a.load("src/ads/useJobInterstitial.ts").useEarlyJobInterstitial();
    assert.equal(a.calls.load, 1);
  });
}
test("iOS configured production uses only its own platform's units", () => {
  const env = {
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: "ca-app-pub-1111111111111111~1111111111",
  };
  const units = {
    banner: "BANNER",
    appOpen: "APP_OPEN",
    interstitial: "INTERSTITIAL",
    native: "NATIVE",
    rewarded: "REWARDED",
  };
  for (const name of Object.values(units))
    env[`EXPO_PUBLIC_ADMOB_IOS_${name}_ID`] =
      "ca-app-pub-1111111111111111/2222222222";
  const a = app("ios", "standalone", false, false, env);
  const actual = a.load("src/ads/config.ts").AD_UNITS;
  for (const key of Object.keys(units))
    assert.equal(actual[key], "ca-app-pub-1111111111111111/2222222222");
  assert.equal(a.calls.sdk, 1);
});

for (const testMode of [true, false])
  test(`iOS supplied rewarded interstitial uses matching ${testMode ? "test" : "live"} SDK format and earned-event lifecycle`, async () => {
    const env = require("../eas.json").build["ios-production"].env;
    const a = app("ios", "standalone", false, testMode, env);
    const config = a.load("src/ads/config.ts");
    assert.equal(config.USE_REWARDED_INTERSTITIAL, true);
    assert.equal(
      config.AD_UNITS.rewarded,
      testMode
        ? "test-rewarded-interstitial"
        : "ca-app-pub-1505001993402465/3831592815",
    );
    assert.equal(
      config.AD_UNITS.banner,
      testMode ? "test-banner" : "ca-app-pub-1505001993402465/8695092599",
    );
    const manager = a.load("src/ads/rewarded-manager.ts").rewardedManager;
    manager.prepare();
    assert.equal(a.calls.rewardedUnits[0].format, "rewarded-interstitial");
    assert.equal(a.calls.rewardedUnits[0].unit, config.AD_UNITS.rewarded);
    const ad = a.calls.rewardedAds[0];
    ad.emit("rewarded_loaded");
    const outcome = manager.request();
    ad.emit("opened");
    assert.equal(manager.getCredit(), false);
    ad.emit("rewarded_earned_reward");
    ad.emit("closed");
    assert.equal(await outcome, "earned");
    assert.equal(manager.getCredit(), true);
    manager._test.reset();
  });
test("Android ignores the iOS rewarded-interstitial format and retains its rewarded unit/loader", () => {
  const env = require("../eas.json").build["ios-production"].env;
  const a = app("android", "standalone", false, false, env);
  assert.equal(a.load("src/ads/config.ts").USE_REWARDED_INTERSTITIAL, false);
  const manager = a.load("src/ads/rewarded-manager.ts").rewardedManager;
  manager.prepare();
  assert.equal(
    a.calls.rewardedUnits[0].unit,
    "ca-app-pub-1505001993402465/9710408715",
  );
  assert.notEqual(a.calls.rewardedUnits[0].format, "rewarded-interstitial");
  manager._test.reset();
});
for (const accept of [false, true])
  test(`iOS rewarded-interstitial introduction ${accept ? "accepts" : "declines"} before presentation`, async () => {
    const env = require("../eas.json").build["ios-production"].env;
    const a = app("ios", "standalone", false, true, env);
    const hook = a.load("src/ads/useRewardedDownload.ts");
    const view = a.renderer(hook.useRewardedDownload);
    const control = view.render();
    const ad = a.calls.rewardedAds[0];
    ad.emit("rewarded_loaded");
    const pending = control.beforeDownload();
    const intro = a.calls.alerts.at(-1);
    assert.equal(intro[0], "Download your PDF");
    assert.equal(a.calls.rewardedShows, 0);
    intro[2][accept ? 1 : 0].onPress();
    await new Promise((resolve) => setImmediate(resolve));
    if (accept) {
      assert.equal(a.calls.rewardedShows, 1);
      ad.emit("opened");
      ad.emit("rewarded_earned_reward");
      ad.emit("closed");
    }
    assert.equal(await pending, accept);
    view.dispose();
    a.load("src/ads/rewarded-manager.ts").rewardedManager._test.reset();
  });
test("iOS rewarded interstitial closed before earning grants no credit", async () => {
  const env = require("../eas.json").build["ios-production"].env;
  const a = app("ios", "standalone", false, true, env);
  const manager = a.load("src/ads/rewarded-manager.ts").rewardedManager;
  manager.prepare();
  const ad = a.calls.rewardedAds[0];
  ad.emit("rewarded_loaded");
  const pending = manager.request();
  ad.emit("opened");
  ad.emit("closed");
  assert.equal(await pending, "cancelled");
  assert.equal(manager.getCredit(), false);
  manager._test.reset();
});

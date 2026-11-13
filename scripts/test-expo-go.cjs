/* global __dirname */
// Evaluate the actual platform modules with a native SDK that would throw in
// Expo Go. This catches eager imports before route components can export.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "..");
function app(os, environment, dev = true, forceTest = false) {
  const cache = new Map(),
    calls = {
      sdk: 0,
      load: 0,
      show: 0,
      prevent: 0,
      options: 0,
      hide: 0,
      appStateSubscriptions: 0,
      appOpenUnits: [],
    };
  let renderState = null;
  const react = {
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useCallback: (f) => f,
    useLayoutEffect: (f) => f(),
    useEffect: (f) => {
      if (!renderState) return f();
      const i = renderState.cursor++;
      renderState.cleanups[i]?.();
      renderState.cleanups[i] = f();
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
    useRef: (v) => ({ current: v }),
  };
  const sdk = {
    AdEventType: { LOADED: "loaded", CLOSED: "closed", ERROR: "error" },
    TestIds: {
      ADAPTIVE_BANNER: "test-banner",
      APP_OPEN: "test-open",
      INTERSTITIAL: "test-interstitial",
      NATIVE: "test-native",
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
        return {
          load() {},
          show: async () => {},
          removeAllListeners() {},
          addAdEventListener: () => () => {},
        };
      },
    },
    NativeAd: { createForAdRequest: async () => ({ destroy() {} }) },
  };
  const Stack = () => null;
  Stack.Screen = function MockScreen() {
    return null;
  };
  const externals = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: "fragment",
    },
    "react-native": {
      Linking: { addEventListener: () => ({ remove() {} }) },
      AppState: {
        currentState: "active",
        addEventListener: () => {
          calls.appStateSubscriptions++;
          return { remove() {} };
        },
      },
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
        useAdsConsent: () => ({
          canRequestAds: os === "android" && environment !== "storeClient",
          privacyRequired: false,
          failed: false,
        }),
        adsPrivacy: {
          getSnapshot: () => ({
            canRequestAds: os === "android" && environment !== "storeClient",
            presenting: false,
            lastUiAt: 0,
          }),
          prepare: async () => {},
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
      { env: { EXPO_PUBLIC_ADS_TEST_MODE: forceTest ? "true" : undefined } },
    );
    return module.exports;
  }
  return {
    load,
    calls,
    sdk,
    renderer(fn, props) {
      const state = { values: [], cleanups: [], cursor: 0 };
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
    assert.equal(a.load("src/ads/AdBanner.tsx").AdBanner(), null);
    assert.equal(
      a.load("src/ads/NativeAdBlock.tsx").NativeAdBlock({ variant: "feed" }),
      null,
    );
    assert.equal(a.load("src/ads/AdMobLifecycle.tsx").AdMobLifecycle(), null);
    assert.equal(a.calls.sdk, 0);
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

test("iOS native ads remain unsupported until real platform configuration is supplied", () => {
  const a = app("ios", "bare");
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
  assert.ok(find(tree, (n) => n.props?.testID === "home-ad-placement"));
  const inventory = find(tree, (n) => typeof n.props?.onLayout === "function");
  inventory.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  tree = view.render();
  const ad = find(tree, (n) => n.type === a.sdk.BannerAd);
  assert.equal(ad.props.unitId, "test-banner");
  assert.equal(ad.props.width, 320);
  assert.equal(ad.props.size, "adaptive");
  assert.equal(ad.props.requestOptions.requestNonPersonalizedAdsOnly, true);
  ad.props.onAdLoaded({ width: 320, height: 50 });
  tree = view.render();
  assert.equal(
    find(tree, (n) => n.props?.children === "Loading advertisement…"),
    null,
  );
  ad.props.onAdFailedToLoad(Error("no fill"));
  tree = view.render();
  assert.equal(
    find(tree, (n) => n.props?.testID === "home-ad-placement"),
    null,
  );
  view.dispose();
});

/* global __dirname */
// Evaluate the actual platform modules with a native SDK that would throw in
// Expo Go. This catches eager imports before route components can export.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "..");
function app(os, environment, dev = true) {
  const cache = new Map(),
    calls = { sdk: 0, load: 0, show: 0, prevent: 0, options: 0, hide: 0 };
  const react = {
    useCallback: (f) => f,
    useEffect: (f) => f(),
    useState: (v) => [typeof v === "function" ? v() : v, () => {}],
    useRef: (v) => ({ current: v }),
  };
  const sdk = {
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
      AppState: { currentState: "active" },
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
    "expo-router": { Stack },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "@expo-google-fonts/plus-jakarta-sans": { useFonts: () => [true, null] },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "lucide-react-native": { Lightbulb: "Lightbulb" },
    "@react-native-async-storage/async-storage": {},
  };
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full).exports;
    if (full.includes("/src/hooks/"))
      return {
        useAuth: () => ({
          userId: null,
          loading: false,
          error: null,
          retry() {},
        }),
        useHomeHeroSession() {},
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
    new Function("module", "exports", "require", "__DEV__", js)(
      module,
      module.exports,
      local,
      dev,
    );
    return module.exports;
  }
  return { load, calls };
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

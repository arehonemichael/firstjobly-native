/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../app.json").expo;
const eas = require("../eas.json");
const {
  configureIosAds,
  IOS_SAMPLE_APP_ID,
} = require("./ios-build-config.cjs");
const plugin = (result) =>
  result.plugins.find(
    (item) =>
      Array.isArray(item) && item[0] === "react-native-google-mobile-ads",
  )[1];
const production = {
  EAS_BUILD_PLATFORM: "ios",
  EAS_BUILD_PROFILE: "production",
};
const names = ["BANNER", "APP_OPEN", "INTERSTITIAL", "NATIVE", "REWARDED"];
const own = {
  ...production,
  EXPO_PUBLIC_ADMOB_IOS_APP_ID: "ca-app-pub-1111111111111111~1111111111",
};
for (const name of names)
  own[`EXPO_PUBLIC_ADMOB_IOS_${name}_ID`] =
    "ca-app-pub-1111111111111111/2222222222";
test("first iOS configuration has native sample app ID without changing Android", () => {
  const before = JSON.stringify(config);
  const result = configureIosAds(config, {});
  assert.equal(plugin(result).iosAppId, IOS_SAMPLE_APP_ID);
  assert.equal(plugin(result).androidAppId, plugin(config).androidAppId);
  assert.equal(plugin(result).delayAppMeasurementInit, true);
  assert.deepEqual(result.android, config.android);
  assert.equal(JSON.stringify(config), before);
  assert.equal(result.ios.bundleIdentifier, "com.first.firstjobly");
  assert.match(result.ios.buildNumber, /^[1-9]\d*$/);
});
test("iOS native App ID configuration rejects malformed/unit IDs", () => {
  for (const value of ["bad", "ca-app-pub-1111111111111111/2222222222"])
    assert.throws(
      () => configureIosAds(config, { EXPO_PUBLIC_ADMOB_IOS_APP_ID: value }),
      /App ID containing ~/,
    );
});
test("iOS production fails before build if own app/units are missing", () => {
  assert.throws(
    () => configureIosAds(config, production),
    /own iOS AdMob App ID/,
  );
  assert.throws(
    () =>
      configureIosAds(config, {
        ...production,
        EXPO_PUBLIC_ADMOB_IOS_APP_ID: own.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
      }),
    /IOS_BANNER_ID/,
  );
  assert.throws(
    () =>
      configureIosAds(config, { ...own, EXPO_PUBLIC_ADS_TEST_MODE: "true" }),
    /ios-testflight/,
  );
});
test("iOS production rejects Android app/units and Google's samples", () => {
  assert.throws(
    () =>
      configureIosAds(config, {
        ...own,
        EXPO_PUBLIC_ADMOB_IOS_APP_ID: plugin(config).androidAppId,
      }),
    /own iOS AdMob App ID/,
  );
  assert.throws(
    () =>
      configureIosAds(config, {
        ...own,
        EXPO_PUBLIC_ADMOB_IOS_APP_ID: IOS_SAMPLE_APP_ID,
      }),
    /own iOS AdMob App ID/,
  );
  for (const invalid of [
    "ca-app-pub-1505001993402465/3915348751",
    "ca-app-pub-3940256099942544/2934735716",
  ]) {
    assert.throws(
      () =>
        configureIosAds(config, {
          ...own,
          EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: invalid,
        }),
      /real iOS ad unit/,
    );
  }
});
test("complete iOS production config is accepted; unrelated build targets remain available", () => {
  assert.equal(
    plugin(configureIosAds(config, own)).iosAppId,
    own.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
  );
  assert.doesNotThrow(() =>
    configureIosAds(config, {
      EAS_BUILD_PLATFORM: "android",
      EAS_BUILD_PROFILE: "production",
    }),
  );
  assert.doesNotThrow(() =>
    configureIosAds(config, {
      EAS_BUILD_PLATFORM: "ios",
      EAS_BUILD_PROFILE: "ios-testflight",
      EXPO_PUBLIC_ADS_TEST_MODE: "true",
    }),
  );
});
test("first TestFlight is a store build with test inventory; simulator uses a development client", () => {
  assert.equal(eas.build["ios-testflight"].extends, "ios-production");
  assert.equal(eas.build["ios-production"].extends, "production");
  assert.equal(eas.build.production.distribution, "store");
  assert.equal(
    eas.build["ios-testflight"].env.EXPO_PUBLIC_ADS_TEST_MODE,
    "true",
  );
  assert.equal(eas.build["ios-simulator"].ios.simulator, true);
  assert.equal(eas.build["ios-simulator"].extends, "development");
  assert.ok(require("../package.json").dependencies["expo-dev-client"]);
});
test("iOS configuration supplies the verified SKAdNetwork list without replacing existing entries", () => {
  const cloned = structuredClone(config);
  const entry = cloned.plugins.find(
    (item) =>
      Array.isArray(item) && item[0] === "react-native-google-mobile-ads",
  );
  entry[1].skAdNetworkItems = ["custom0000.skadnetwork"];
  const ids = plugin(configureIosAds(cloned, {})).skAdNetworkItems;
  assert.ok(ids.includes("cstr6suwn9.skadnetwork"));
  assert.ok(ids.includes("custom0000.skadnetwork"));
  assert.equal(ids.length, new Set(ids).size);
});
function pdfPorts(os, available = true) {
  const fs = require("node:fs"),
    ts = require("typescript");
  const calls = [];
  const deps = {
    "./account/owned-files": {
      rememberGeneratedFile: async () => {},
      assertGeneratedOwnerActive: () => {},
    },
    "react-native": { Platform: { OS: os } },
    "expo-sharing": {
      isAvailableAsync: async () => available,
      shareAsync: async (uri, options) => {
        calls.push({ kind: "share", uri, options });
      },
    },
    "@react-native-async-storage/async-storage": {
      getItem: async () => "content://downloads",
    },
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
      cacheDirectory: "file:///cache/",
      makeDirectoryAsync: async () => {},
      deleteAsync: async () => {},
      copyAsync: async (options) => calls.push({ kind: "copy", ...options }),
      EncodingType: { Base64: "base64" },
      readAsStringAsync: async () => "fixture",
      writeAsStringAsync: async () => {},
      StorageAccessFramework: {
        createFileAsync: async () => "content://downloads/file.pdf",
      },
    },
  };
  const js = ts.transpileModule(
    fs.readFileSync(
      require("node:path").join(__dirname, "../src/lib/save-pdf.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", js)(
    mod,
    mod.exports,
    (name) => deps[name],
  );
  return { calls, save: mod.exports.savePdfToDownloads };
}
test("iOS CV/Z83 export offers PDF Save to Files after creating the local copy", async () => {
  const f = pdfPorts("ios");
  assert.equal(
    await f.save("file:///cache/generated.pdf", "CV.pdf", { shareOnIos: true }),
    "file:///cache/generated.pdf",
  );
  assert.deepEqual(
    f.calls.map((c) => c.kind),
    ["copy", "share"],
  );
  assert.equal(f.calls[1].options.UTI, "com.adobe.pdf");
});
test("iOS circular PDF export itself presents one Save to Files sheet", async () => {
  const f = pdfPorts("ios");
  await f.save("file:///cache/generated.pdf", "Circular.pdf");
  assert.deepEqual(
    f.calls.map((c) => c.kind),
    ["copy", "share"],
  );
});
test("iOS unavailable sharing reports the saved-copy state without inventing a successful Files export", async () => {
  const f = pdfPorts("ios", false);
  await assert.rejects(
    f.save("file:///cache/generated.pdf", "CV.pdf", { shareOnIos: true }),
    /Save to Files is unavailable/,
  );
  assert.deepEqual(
    f.calls.map((c) => c.kind),
    [],
  );
});
test("Android PDF export retains SAF and never opens an iOS share sheet", async () => {
  const f = pdfPorts("android");
  assert.equal(
    await f.save("file:///cache/generated.pdf", "CV.pdf", { shareOnIos: true }),
    "content://downloads/file.pdf",
  );
  assert.deepEqual(f.calls, []);
});

test("owner-supplied iOS App ID and confirmed units reach the TestFlight native config", () => {
  const env = {
    ...eas.build["ios-production"].env,
    ...eas.build["ios-testflight"].env,
    EAS_BUILD_PLATFORM: "ios",
    EAS_BUILD_PROFILE: "ios-testflight",
  };
  assert.equal(
    plugin(configureIosAds(config, env)).iosAppId,
    "ca-app-pub-1505001993402465~2077713359",
  );
  assert.equal(
    env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID,
    "ca-app-pub-1505001993402465/8695092599",
  );
  assert.equal(
    env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID,
    "ca-app-pub-1505001993402465/8451550014",
  );
  assert.equal(
    env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID,
    "ca-app-pub-1505001993402465/8259978322",
  );
  assert.equal(
    env.EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID,
    "ca-app-pub-1505001993402465/6946896655",
  );
  assert.equal(env.EXPO_PUBLIC_ADS_TEST_MODE, "true");
});
test("new iOS production profile has the same missing-unit release guard", () => {
  const env = {
    ...eas.build["ios-production"].env,
    EAS_BUILD_PLATFORM: "ios",
    EAS_BUILD_PROFILE: "ios-production",
  };
  assert.doesNotThrow(() => configureIosAds(config, env));
  assert.throws(
    () =>
      configureIosAds(config, {
        ...env,
        EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID: "",
      }),
    /IOS_REWARDED_ID/,
  );
  assert.throws(
    () =>
      configureIosAds(config, {
        ...env,
        EXPO_PUBLIC_ADMOB_IOS_REWARDED_FORMAT: "interstitial",
      }),
    /REWARDED_FORMAT/,
  );
});

test("production iOS explicitly disables test ads while TestFlight overrides to test inventory", () => {
  assert.equal(
    eas.build["ios-production"].env.EXPO_PUBLIC_ADS_TEST_MODE,
    "false",
  );
  assert.equal(
    eas.build["ios-testflight"].env.EXPO_PUBLIC_ADS_TEST_MODE,
    "true",
  );
});

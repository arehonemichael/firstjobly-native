# Expo Go startup compatibility

The reported Android crash is caused by evaluating
`react-native-google-mobile-ads` in Expo Go. Its entry point requires
`RNGoogleMobileAdsModule`, which Expo Go does not ship. This throws while importing
Home/Jobs/Job Details, so Expo Router also reports missing default exports and
secondary navigation/ErrorBoundary errors. Those route exports already exist.
Updating Expo alone cannot add this native module to Expo Go.

`src/lib/runtime-environment.ts` detects Expo Go using the SDK's documented
`Constants.executionEnvironment === ExecutionEnvironment.StoreClient` value.
`src/ads/sdk.ts` is the only runtime SDK boundary: its synchronous, guarded require
is never evaluated on Expo Go or web. A static import followed by a component
check would be too late. Type-only ad class imports are erased by transpilation.

The banner, native card, interstitial and app-open entry points now use this
boundary. Expo Go displays no native ads, reserves no empty ad space, and opens
jobs normally. Configured Android development/release builds still load the installed SDK,
use test IDs in development and retain the exact existing production ad IDs and
policies. Ad behavior is not disabled globally. No dependency, SDK version,
backend, schema, branding or routing changes are introduced.

The root also skips native splash-control calls in Expo Go, where setOptions is
unsupported; the animated in-app opening still works. Configured Android builds retain the
native handoff. The existing iOS-app-ID configuration warning is separate from
this Android crash; no iOS ad identity is invented by this fix.

Verification:

- `npm run test:expo-go`: five tests evaluate the real app modules with an SDK
  that throws if imported in Expo Go/web. They cover all four ad entry points,
  immediate job navigation, guarded root splash calls, preserved custom-build
  SDK loading/test IDs, and unchanged production ad IDs.
- Startup unit tests, TypeScript, focused lint, Android and web JS exports pass.
- These are simulated native-environment tests and bundle checks, not a physical
  Expo Go or release APK test. Test on the user's Samsung device after updating.

Run in Expo Go with `npx expo start --go --clear`. To test actual native ads and
the OS splash, build/install the existing development or preview APK profile;
Expo Go cannot load native modules that are absent from its prebuilt binary.

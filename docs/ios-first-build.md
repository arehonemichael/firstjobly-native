# First iOS build — FirstJobly

Initial setup: `feat/ios-first-build`, based on `perf/foreground-interstitial-opportunities`. iOS AdMob configuration update: `config/ios-admob-units`. Native identifiers stay `com.first.firstjobly`, version 1.0.1, iOS build 1. Apple Developer membership is ready; the owner has now supplied the iOS App ID and all five ad units; the owner confirmed the download unit is **Rewarded interstitial**.

This prepares the existing app for iOS. It does not publish to the App Store or claim a compiled/signed IPA has been tested. Apple signing/Expo account access stays on the owner's computer. The existing Android settings, unit IDs and ad policies are preserved.

## What changed

- Added `expo-dev-client`, which was missing despite the existing development build profile. Installed the SDK-57-compatible version through Expo, along with its required transitive packages; existing direct Expo SDK dependencies were not upgraded.
- Added `app.config.js` with a pure, tested build-config helper. The native iOS SDK receives Google's official **iOS sample App ID**, `ca-app-pub-3940256099942544~1458002511`, unless the real iOS App ID is supplied. This removes the previous native missing-App-ID crash risk.
- Added Google's current 50-entry SKAdNetwork list from the [iOS quick start](https://developers.google.com/admob/ios/quick-start), retrieved 13 November 2026, merged with existing plugin entries. Refresh it when adding mediation partners or following future provider updates.
- Enabled native iOS ads in development/test mode, using the SDK's official platform-specific TestIds. Production iOS uses **only separately configured iOS units**; there is no Android-ID fallback. An unconfigured local release disables ads safely. The EAS `production` iOS profile fails early until real iOS configuration is supplied and test mode is off.
- Kept existing consent/NPA and full-screen coordination. No new ATT prompt, IDFA permission request or consent bypass was added. Do not assume that absence of a permission prompt means no SDK data collection; complete App Privacy disclosures from actual SDK/data behavior before release.
- Added `ios-simulator` (development client) and `ios-testflight` (store-signed, official test ads) profiles. Existing development/preview profiles also retain test mode. Existing production Android profile remains unchanged.
- Added iOS build number 1 and export-compliance setting `ITSAppUsesNonExemptEncryption=false`, based on the app's standard platform HTTPS/security usage. Verify this declaration if custom/non-exempt cryptography is added.
- Reused the real FirstJobly logo, splash, fonts, routes and existing iPhone/iPad support. Expo generates the required opaque 1024px app icon. The source icon is only 72px, so replace it with the owner's high-resolution brand master before a polished public release; no replacement brand was invented.
- No auth, Supabase, backend, Apply, Community or notification API changes. CV/Z83 generation and reward gates are preserved. Their iOS export now opens the native share sheet (Save to Files) after copying to the app Documents directory, and labels no longer claim Android Downloads. Circular PDF sharing remains a single sheet. Device notification registration/delivery still needs its existing audited APNs/backend setup; routing support alone does not register iOS devices.

## First TestFlight from Windows (no Mac needed for EAS cloud builds)

Preserve uncommitted work before switching. Open PowerShell in the project:

```powershell
git fetch origin
git switch config/ios-admob-units
npm ci
npm run typecheck
npm run test:ios
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest env:list --environment preview
```

Use the Expo account with access to existing project `a17295aa-763e-4ff5-a151-60d19b3fce12`; do not initialize a replacement project. In that project's **preview environment**, ensure these existing public app settings are present:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_WEB_URL=https://firstjobly.co.za
```

Use the same backend URL and publishable key as Android; no database password, Supabase admin token or service-role key. EAS cloud builders do not receive your git-ignored `.env.local` automatically. To add a missing value, EAS can prompt locally:

```powershell
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_WEB_URL --visibility plaintext
```

Only run `env:create` for settings not already present. The profile itself sets `EXPO_PUBLIC_ADS_TEST_MODE=true` and inherits the supplied iOS App ID from `ios-production`; it still uses official SDK test ad units. Real monetization is not enabled by the TestFlight profile.

```powershell
npx eas-cli@latest build --platform ios --profile ios-testflight
```

Sign into Apple **locally when EAS prompts** and select your paid Developer team. Let EAS manage the distribution certificate/provisioning profile. Confirm that your team can register `com.first.firstjobly`; if it is owned by another team, choose an available identifier before building. Never paste Apple passwords, API private keys or certificates into chat/Git.

In [App Store Connect](https://appstoreconnect.apple.com), create **My Apps → + → New App**: platform iOS, name FirstJobly, your language, bundle ID `com.first.firstjobly`, and a unique owner-chosen SKU. If the bundle ID is not listed, finish EAS's Apple registration first. You do not need to select the Android app or create a new backend.

After the build succeeds and the App Store Connect record exists:

```powershell
npx eas-cli@latest submit --platform ios --profile production --latest
```

Submission uploads to App Store Connect/TestFlight; it does **not** publish the app publicly. Follow the Apple/team/app prompts locally. After Apple processes it, answer export compliance as applicable, create/select an **internal TestFlight group**, add your tester, and install through Apple's TestFlight app. External testers require Apple's beta review. The first store-signed TestFlight build runs without Metro or your PC's LAN address.

For the next uploaded iOS build, increase `expo.ios.buildNumber` in `app.json` from `"1"` to `"2"` (then 3, etc.) before rebuilding. These profiles deliberately keep the existing local versioning; they do not switch Android to remote version numbering.

## Optional live-development build

For a physical iPhone development client, register the phone (Ad Hoc provisioning), then build:

```powershell
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
$env:EXPO_PUBLIC_ADMOB_IOS_REWARDED_FORMAT="rewarded-interstitial"
npx expo start --dev-client --tunnel -c
```

The local Metro setting above selects the same rewarded-interstitial test format as TestFlight (the cloud profiles already provide it). Install the signed build from EAS's build link on the registered iPhone. Development needs the running Metro connection; TestFlight does not. Expo Go cannot load AdMob native modules.

For a **Mac** with Xcode/iOS Simulator:

```powershell
npx eas-cli@latest build --platform ios --profile ios-simulator
npx eas-cli@latest build:run --platform ios --latest
npx expo start --dev-client -c
```

A simulator build cannot be installed on a physical iPhone. The generated SDK-57 Podfile currently targets **iOS 16.4+**; the phone needs a supported iOS version. CocoaPods/Xcode compilation and simulator execution are unavailable on this Linux workspace.

## Configured iOS AdMob and public release

The iOS app and confirmed units are now stored as public build settings in `eas.json` under `ios-production` (inherited by `ios-testflight`):

| Setting | Supplied ID |
|---|---|
| App ID | `ca-app-pub-1505001993402465~2077713359` |
| Banner | `ca-app-pub-1505001993402465/8695092599` |
| Interstitial | `ca-app-pub-1505001993402465/8451550014` |
| Native | `ca-app-pub-1505001993402465/8259978322` |
| App open | `ca-app-pub-1505001993402465/6946896655` |

Rewarded interstitial: `ca-app-pub-1505001993402465/3831592815`. The owner confirmed this format, so the iOS profile sets `EXPO_PUBLIC_ADMOB_IOS_REWARDED_FORMAT=rewarded-interstitial`. The loader uses `RewardedInterstitialAd`, the matching official test unit in test mode, and the existing earned-reward events. Android continues to use `RewardedAd` and its original unit. Before an iOS rewarded interstitial, a native introduction explains the PDF reward and offers **Not now** / **Watch ad**; declining makes no presentation or download. Existing earned-credit/free-unavailable fallback, locking and cancellation rules remain unchanged.

Do not reuse the Android App ID (`~7846151022`) or Android unit IDs. The profile supplies the known **public** identifiers. Environment overrides remain supported; rebuild natively when changing the App ID. The full iOS profile now supplies:

```text
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-1505001993402465~2077713359
EXPO_PUBLIC_ADMOB_IOS_BANNER_ID=ca-app-pub-1505001993402465/8695092599
EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID=ca-app-pub-1505001993402465/6946896655
EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-1505001993402465/8451550014
EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID=ca-app-pub-1505001993402465/8259978322
EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID=ca-app-pub-1505001993402465/3831592815
EXPO_PUBLIC_ADMOB_IOS_REWARDED_FORMAT=rewarded-interstitial
```

Also provide the same three public app settings in **production**. Configure iOS Privacy & Messaging in AdMob and verify consent/ads with the actual iOS app. Keep official test inventory during testing; never click live ads.

Only after iPhone testing and real IDs are ready:

```powershell
npx eas-cli@latest build --platform ios --profile ios-production
```

Do not publicly submit the test-ad build as the final release. Before requesting public App Review, complete privacy policy/support URLs, accurate App Privacy and age/content declarations, screenshots (including iPad while tablet support is enabled), reviewer account/instructions, Community moderation/report/block requirements and account deletion. The current Profile screen has no in-app account deletion flow; obtain the existing site's supported deletion/API contract before implementing one. No backend route or table was invented here. Confirm external application links and CV/Z83 export/mail work on-device.

## Verification

- Verified generated native iOS project/Info.plist: original sample and updated owner GAD App IDs, delayed measurement, bundle ID/scheme, build number and SKAdNetwork entries; native app icon is opaque 1024×1024. Prebuild completed on Linux with `--no-install`; generated native folders stay ignored, as before.
- Typecheck passes; new configuration/runtime modules lint clean (Z83 retains its pre-existing YesNo redeclaration warning); the iOS JavaScript export passes. **290 Node tests** pass, including the platform/build checks and existing ads, startup, navigation, Gov jobs, Community and personalization suites. These checks are separate from native compilation.
- Tests cover Expo Go/web guards, Android production IDs, iOS development/TestFlight test units, configured/unconfigured iOS production, native ID validation, Android/sample-ID rejection, release gate and build-profile intent.
- Expo Doctor remains **20/21** with the same 21 existing SDK patch mismatches. No missing iOS AdMob App ID warning remains.
- Web regression: 120 Home/nav/login browser checks pass with isolated API fixtures.
- No signed IPA, CocoaPods installation, TestFlight upload or physical iPhone test was performed here.
- On iPhone/iPad verify cold start, sign-in/restoration/onboarding/deep links, every destination and safe-area/keyboard, Gov/API search/pagination, saves/Community/photos, Apply, CV/Z83/PDF share/mail, consent/test-ad formats/reward completion, background/resume, offline errors and notifications where configured.

AdMob ID update: the release guard also covers `ios-production`. Tests verify the owner IDs, native configuration, matching test/live SDK formats using fake SDK ports, earned/cancelled behavior, intro acceptance/decline and unchanged Android format. No live ad request or deployment was performed. A new signed native build is required to embed the new App ID; Metro reload or OTA JavaScript alone does not change it.

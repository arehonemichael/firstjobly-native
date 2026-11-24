# Rate FirstJobly

Branch `feat/rate-firstjobly`, stacked on `fix/ad-readiness-visibility` (PR #30). Includes the prior ad fixes. Prepared release: **1.0.2**, Android code **38**, iOS build **9**. iPad support remains enabled. No build, upload, OTA update or store deployment was initiated.

## Manual review entry

A theme-styled, accessible **Rate FirstJobly** button is available in **More** and **Settings**. It opens this app's real Google Play or App Store review page directly. Android tries the installed Play Store then falls back to HTTPS. Web offers explicit links to both stores. Failure produces a retry message and never blocks other features.

The manual button deliberately does not call the quota-limited native request API. It remains available even when automatic requests are in cooldown. Opening the store records only a manual-attempt timestamp for automatic-prompt suppression; it does not claim a rating was submitted. Users choose their own 1–5-star rating. No preselected rating, sentiment survey, selective feedback funnel, incentive or feature gate is added.

## Automatic request policy

Automatic requests use `expo-store-review` (~57.0.3, SDK-57-compatible) and require all of:

- At least seven elapsed days since this feature first tracked use on the installation. Existing installs are not assumed to have a known installation date.
- At least three sessions. Cold launches count once per JS process; real returns after at least 30 minutes can count another session. Brief/inactive-only returns and root remounts do not add sessions.
- At least two completed actions. Successful ordinary/Gov job saves and confirmed standalone Android CV/Z83 file saves count. Unsave/failure/cancellation does not. iOS share-sheet completion is not evidence of a save, so it is not counted as a successful export.
- A fresh completed-action milestone within ten minutes in the current process, followed by five seconds of quiet Home. Opening, resuming or changing route alone never creates an automatic prompt. Touches, ongoing scrolling and keyboard use defer it.
- No active/recent fullscreen ad, consent UI, permission/reminder operation, sensitive route, background state, deep link or account-change race.
- A 90-day cooldown after any automatic attempt or manual store-opening intent, at most one automatic attempt per marketing version and at most three attempts in a rolling 365-day period.

The SDK's availability and live context are checked again after asynchronous work. Intent is persisted before calling the OS, so an invisible/suppressed/failed request does not cause a retry storm. The shared fullscreen lock coordinates the request with ads; a safety deadline releases it if the SDK never completes. The OS owns the native dialog, dismissal and quota. The API cannot report whether someone submitted a review or what rating they gave. TestFlight suppresses the native request; Android sideloads and devices without an eligible Play account may not display it.

Counters and attempt timestamps stay in installation-local AsyncStorage. No account IDs, job IDs, document contents, ratings or new backend analytics are stored by this feature. Action deduplication keys exist in bounded process memory only. Pending automatic prompts clear on backgrounding, incoming links and account changes. Corrupt/unavailable storage and missing native modules fail quietly. Older binaries can still use the manual store links without crashing.

## Verification

- **472 automated tests passed**. New coverage includes eligibility/cooldown/yearly/version limits, idempotent sessions, deduplication, delayed or failed storage, stale asynchronous guards, native unavailability/errors, manual URL fallback, native callback timeout/lock release, idle Home scheduling, inertial scrolling, sensitive routes, account/deep-link/background cancellation and observer isolation. Existing ad, auth, application, rewarded-credit and document tests remain passing.
- TypeScript and targeted ESLint passed for the new review modules/components and modified root, settings, More, hooks and shared-lock code.
- Browser UI checks passed at 360px for More/Settings and both correct store links, with `window.open` intercepted; no real store/review was opened. Existing document/account isolation and **131 Gov Jobs checks** also passed with synthetic backend responses.
- Android and production-configured iOS JavaScript/Hermes exports passed. No-install iOS prebuild passed. Both Apple and Android autolinking resolve Expo StoreReview 57.0.3.
- Expo Doctor remains 20/21, with the pre-existing SDK patch-version check flagging 22 packages. No unrelated dependency upgrade was included.
- `git diff --check` passed. This Linux workspace cannot compile with Xcode or demonstrate a real native store dialog; device/store-track verification remains outstanding.

## Build and test (PowerShell)

```powershell
git fetch origin
git switch feat/rate-firstjobly
git pull --ff-only
npm ci
npm run typecheck
npm run test:reviews
npx eas-cli@latest build --platform android --profile preview
```

A new native build is required for the automatic API; a Metro reload alone cannot install Expo StoreReview. Preview APKs can test the button/fallback UI, but Google Play's real in-app dialog should be checked using a Play-installed internal-testing build and an eligible tester. Do not expect a dialog on every request. Do not post fake test reviews.

For the AAB, after device checks:

```powershell
npx eas-cli@latest build --platform android --profile production
```

The existing iOS profiles can build version 1.0.2 (9). Complete store version metadata before an eventual upload/review. Main is unchanged. The earlier release-source limitation remains: merge any version-36-only local changes not present in GitHub before promoting this branch.

## Official guidance

- https://docs.expo.dev/versions/v57.0.0/sdk/storereview/
- https://developer.apple.com/documentation/storekit/requesting-app-store-reviews
- https://developer.apple.com/app-store/ratings-and-reviews/
- https://developer.android.com/guide/playcore/in-app-review

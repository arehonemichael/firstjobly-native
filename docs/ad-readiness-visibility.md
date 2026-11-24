# Ad loading readiness and inline visibility repair

Branch: `fix/ad-readiness-visibility`. Base: `fix/gov-job-card-ads-release`, commit `b46cc42eec01e7932c236a53866d755a902a0163` (Android version code 35). The owner reports version 36 is live, but its EAS build/source commit has not been supplied. Review any local/version-36 changes before promoting this branch. Main is unchanged.

## Changes

- Native and banner request components now mount only when their placement is within 160dp of the viewport on a focused, foreground screen. They pause behind a fullscreen ad or consent UI. Admission stays latched while scrolling so crossing an edge does not repeatedly destroy and reload inventory. Blur/background cancels placement subscriptions and unused loads; late measurements and native-ad promises cannot revive removed placements.
- Thin ScrollView/FlatList wrappers coalesce visibility measurements into an animation frame and preserve all existing scroll callbacks, including the additional-interstitial boundary handler. A real scroll-begin gesture cancels the cold-start offer without counting every scroll callback as an extra-ad interaction. Home, Jobs, Gov Jobs, details, hot jobs and saved jobs use these wrappers. Existing ad positions and styling remain intact. Unvisited inline slots reserve loading space until admitted; failed admitted inventory retains the existing collapse/recovery behavior.
- Interstitial and app-open inventory loads now time out after 10 seconds if the SDK produces no terminal callback. Retries are bounded with existing-style backoff. Stale callbacks are ignored, loaded ads cancel the load timer, and no load/retry callback can create a delayed navigation ad or replay the expired app-open opportunity.
- App-open eligibility is re-evaluated when the one-second consent-form dismissal guard expires. Previously the guard could remain ineligible until another route/state event. Guest/unconfirmed routes no longer preload app-open inventory that they cannot use. Confirmed profiles may preload while presentation remains blocked by the consent guard. The 1.5-second cold-start window remains unchanged: slow inventory is skipped, not presented over ongoing browsing.
- Rewarded tools advertise a rewarded action only when inventory is actually loaded. A free-labelled tap remains free even if inventory arrives later. Focus-owned registrations stop unused rewarded requests/retries when users leave the tools, while an already opened rewarded ad and earned retry credit remain intact. No artificial loading wait or mandatory additional ad was added to downloads.
- Production builds explicitly set `EXPO_PUBLIC_ADS_TEST_MODE=false`; preview/development and iOS TestFlight test profiles retain their overrides. Existing unit IDs, consent rules, fullscreen spacing, job-click cadence, session caps, additional-interstitial policy, routing, Apply, account/auth and document generation behavior are unchanged.
- Prepared Android version code **37** (owner reports 36 used) and iOS build **8**. No build/upload/OTA/store deployment was started.

## Verification

- TypeScript passed.
- All **449 automated Node tests passed**, including visibility geometry, real gate focus/foreground cleanup and stale callbacks, scroll callback composition, silent SDK timeouts/retries, consent-guard recovery, no-ineligible app-open preload, rewarded readiness/free fallback/focus cleanup, and existing cadence/consent/download/credit tests.
- The SDK/component harness now models focus effects and re-renders after readiness changes, and cleans all controller timers after tests. The ready-inventory cadence test loads its fake ad before advancing the cooldown; a silent 60-second fake load must now time out rather than be treated as ready.
- ESLint for `src/ads` passed. Across the changed screens, 3 errors and 4 warnings remain; baseline lint via `git show HEAD:<file> | eslint --stdin` reproduced exactly those same findings in Jobs, job detail and saved jobs. No new lint findings were introduced.
- Isolated Chromium: **131 Gov Jobs browser checks** and the document/account-isolation scenario passed using intercepted synthetic backend/auth traffic. No real application, email or deletion was submitted.
- Android and production-configured iOS JavaScript/Hermes exports passed.
- Expo Doctor remains **20/21**, with the existing SDK package patch-version mismatches (22 packages in the current check). No dependency upgrade was included.
- `git diff --check` passed.

This Linux environment has no attached native device or Xcode; real native viewport measurement, consent UI, ad rendering and SDK/network timing still require device verification. The tests do not demonstrate real impressions or increased earnings. No new analytics collection or backend schema was introduced; existing redacted ad diagnostics remain development-only.

## Test and build (PowerShell)

```powershell
git fetch origin
git switch fix/ad-readiness-visibility
git pull --ff-only
npm ci
npm run typecheck
npm run test:ads
npx eas-cli@latest build --platform android --profile preview
```

Install the preview APK on a registered test device. Confirm that inline slots request near the viewport, hidden tabs/background/fullscreen/consent states stop unused placements, failed slots collapse, and scrolling does not repeatedly request the same ad. Test cold/slow launch, consent dismissal, returning Home, ordinary/Gov/saved job taps, the shared fullscreen gap, no-fill/timeout, and CV/Z83 downloads with loaded, loading, cancelled and earned ads. Confirm downloads, navigation and earned-credit retries remain usable. Interact only with official test ads.

After device verification, build a new AAB (37) without automatically submitting it:

```powershell
npx eas-cli@latest build --platform android --profile production
```

iOS testing can use the existing `preview` profile; a store build uses `ios-production` and build 8. Verify the version/build numbers are still unused before uploading. Existing iPad support is unchanged.

## Evaluate the result

Compare equal complete date ranges by app version, OS, ad-unit ID and country. Track impressions and earnings per active user, show rate, fill and latency. Reduced wasted requests alone can raise show rate without increasing earnings, so do not treat that metric alone as success. Some unused preloads are expected; the repair does not attempt to show every matched ad or guarantee revenue growth.

# AdMob reliability and inventory update

Branch: `ads-revenue-fix`, based on the current `fix/community-feed-polish` checkout. Main is unchanged.

## Behaviour

- Request options come from one `getRequestOptions()` helper. Personalization is allowed only after permission is established and the UMP status is NOT_REQUIRED, or OBTAINED with `selectPersonalisedAds === true`. Unknown/missing choices default to non-personalized requests. The existing `canRequestAds`, device-storage and basic-ad checks still gate SDK initialization and requests.
- One shared interstitial is preloaded for Home, Jobs and Hot. The third open is eligible when inventory is ready, outside the four-minute cooldown, below four opened ads per session and able to acquire the full-screen lock. An unloaded tap proceeds immediately without consuming the opportunity. OPENED resets the counter and records the session/cooldown accounting.
- CLOSED, ERROR, rejected/thrown show calls, the 1.5-second missing-OPENED timeout and the 120-second safety timeout all converge on one navigation completion. Timers/listeners are cleared, the lock is released, inventory is discarded and the next ad is prepared. Rapid extra taps during presentation are deliberately ignored; the first tap owns the destination.
- Load failures use 5/15/45-second backoff; after exhaustion a later prepare/tap can restart loading. Consent withdrawal discards inventory and cancels retries.
- Interstitial and app-open share an owner-specific lock and a 60-second gap after release. App-open now uses the second-launch threshold, three-hour cooldown and 3.5-hour maximum inventory age, retaining the real-background, one-second-away, Home, onboarding, consent, 75ms cancellation and 200ms lateness guards. Cold startup only preloads; a later load never causes presentation. A defensive 120-second app-open timeout also prevents a lost SDK event from holding the lock indefinitely.
- Consent failures may retry on a real background-to-active return after 30 seconds. Pending flows and presenting forms block retries. App-open permission updates subscribe directly so withdrawal invalidates inventory immediately, independently of React render timing.
- Banners retain the Advertisement label and 12-second timeout, then retry by remounting after 30/60/120 seconds. Successful loads reset backoff. Width changes and consent regrant get fresh state; late callbacks from failed/retired attempts cannot cancel recovery. Adaptive width excludes the existing container padding/border.
- Native feed ads follow zero-based indices 3, 9, 15… (after the fourth, tenth, sixteenth items). Feed/detail flags gate the actual component. A feed load reserves 260dp, collapses after a 10-second timeout/error, and retries once after five seconds. Unmount and late promise resolution destroy inventory.
- A banner was added at the Hot list footer and below the Saved list heading. No new Community/Profile placements, job-card ads, rewarded ads or Apply interruptions were added.

## Files changed

| File | Change |
|---|---|
| `src/ads/config.ts` | Replaces unused flags/limits with enforced ADS_CONFIG and index-based feed placement. |
| `src/ads/privacy.ts` | Exposes the shared request-options helper. |
| `src/ads/consent-controller.ts` | Tracks personalization, failure time and guarded foreground retry. |
| `src/ads/fullscreen-lock.ts` | Adds owner-specific locking, post-release gap and test reset. |
| `src/ads/interstitial-manager.ts` | Owns the singleton, explicit events, retries and exactly-once navigation. |
| `src/ads/useJobInterstitial.ts` | Mount preload/shared tap wrapper; detail compatibility stays immediate. |
| `src/ads/AdMobLifecycle.tsx` | Wires central app-open settings, consent updates/retry and shared request options. |
| `src/ads/app-open-controller.ts` | Enforces the lock, updated thresholds and presentation cleanup. |
| `src/ads/recovery.ts` | Implements cancellable recovery clocks, banner lifecycle and native timeout/late cleanup. |
| `src/ads/AdBanner.tsx` | Adds keyed recovery, accurate width and consent-reset behaviour. |
| `src/ads/AdBanner.web.tsx` | Accepts the additional placement names while still returning null. |
| `src/ads/NativeAdBlock.tsx` | Adds flags, timeout, one retry, loading reservation and cleanup. |
| `src/ads/sdk.web.ts` | Prevents Metro from traversing native ad/codegen modules on web. |
| `src/app/(tabs)/jobs.tsx` | Inserts native inventory using the configured item indices. |
| `src/app/(tabs)/saved.tsx` | Adds the banner below the list heading. |
| `src/app/hot-jobs.tsx` | Adds the banner at the list footer. |
| `scripts/ads-load.cjs` | Loads actual controllers in tests with a null SDK boundary. |
| `scripts/test-ads.cjs` | Keeps the original 11 tests and adds timing, personalization, lock and recovery coverage. |
| `scripts/test-expo-go.cjs` | Keeps the original nine tests and extends the SDK/render fakes for recovery/flag/foreground checks. |
| `docs/ads-revenue-fix.md` | Records implementation, verification and release checks. |

## Adaptations to the real code

- Installed SDK is 16.3.4 as expected. The actual consent field is British-spelled `selectPersonalisedAds`.
- The SDK's `useFullScreenAd` hook explicitly discards the promise returned by `show()`. The new manager calls `InterstitialAd.createForAdRequest` and `show()` directly.
- Home, Jobs and Hot already used `useEarlyJobInterstitial`; their signatures are preserved. Home needed no screen edit. Detail already used the immediate compatibility wrapper; its screen/Apply implementation is unchanged, with the native detail flag enforced inside NativeAdBlock.
- Existing code used AD_FEATURES and unused AD_LIMITS rather than ADS_CONFIG. Those old exports were removed and real consumers now enforce the new policy.
- Adding the pure placement helper import to Jobs exposed Metro's static traversal of the gated native package on web. A null platform companion fixes this at bundle resolution, alongside the unchanged lazy Android/Expo Go gate in sdk.ts.
- App-open retains the existing no-fill behaviour: a failed preload can retry at a later context/foreground opportunity; failed presentations and closes preload replacement inventory. This avoids an unbounded immediate no-fill request loop.

## Verification

- `npm run test:ads`: **35/35 pass**, including the original 11.
- `npm run test:expo-go`: **13/13 pass**, including the original nine. Expo Go/web/iOS runtime paths do not evaluate the native SDK; disabled flags block actual entry paths; multiple screen mounts share one interstitial.
- `npx tsc --noEmit`: pass.
- Focused ESLint for ads, changed test files and Hot: pass. Jobs and Saved retain one existing set-state-in-effect finding each, compared against the parent after normalizing shifted line numbers. Those unrelated effects were not changed.
- Web and Android JS exports pass. The existing missing-iosAppId plugin warning remains; this task does not configure or enable native iOS advertising. JS export is not an APK/device test.
- **134** isolated Home/navigation/auth browser checks pass on the exported web app, without runtime errors. Web ad components remain null.
- Production unit IDs, app.json/Android app ID, EAS test-mode profiles, dependencies, job-detail/Apply, Community/Profile and backend files are unchanged. No audience tags or child-directed/under-age flags were added.
- All SDK tests use fakes and fake timers. Browser backend traffic is intercepted. No real impressions/clicks were generated. These checks do not establish fill, revenue or policy compliance.

## Manual release checks

Build an Android development client with test mode explicitly enabled:

```powershell
$env:EXPO_PUBLIC_ADS_TEST_MODE = "true"
npx expo run:android
```

On device, verify Google test creatives, interstitial OPENED/CLOSED/navigation and rapid taps, consent form/withdrawal/regrant, background returns/deep links, banner/native layout/rotation, and no-fill/slow-load recovery. Check physical safe areas and accessibility text sizing.

In AdMob, the owner must confirm the app is not child-directed, audience settings, app-ads.txt, UMP regional forms and ad-unit status. No dashboard setting was changed by this work.

Rollback controls in ADS_CONFIG: raise `interstitial.everyNthJobOpen` to 4 if retention drops; disable `interstitial.enabled`, `appOpen.enabled`, `banner.enabled`, `native.feedEnabled` or `native.detailEnabled` independently. These are build-time source settings, not remote switches.

## Follow-up: consent-update failure recovery

Device logs exposed `Publisher misconfiguration … no form(s) configured` for the existing Android app ID. The broad error gate originated in commit `a90861c` (Home/splash polish); it was retained by the first revenue update.

The follow-up changes `consent-controller.ts` to check `AdsConsent.getConsentInfo()` after an info-update failure. As [Google's UMP guidance](https://developers.google.com/admob/android/privacy#request_ads_with_user_consent) describes, the SDK can retain permission from a previous session when the update fails. Recovery requires the SDK's current `canRequestAds === true`, a valid NOT_REQUIRED/OBTAINED status and the existing storage/basic-ad checks. Recovered requests use NPA conservatively, retain the error/30-second retry state and do not initialize the SDK twice. Required/unknown/refused/unreadable consent remains blocked. Privacy-form failures do not fall back to old consent after a possible withdrawal.

`privacy.ts` wires the real SDK getter and reports the error message in dev/test builds. `scripts/test-ads.cjs` adds five regression tests for cached recovery, unavailable/refused permission, later retry and failed withdrawal forms. Verification: 40 ad tests, 13 Expo/runtime tests, TypeScript and focused lint pass. No real ad requests/impressions were made during verification.

This does not publish an AdMob consent message. A fresh device with no SDK permission will remain blocked until the owner configures/publishes the appropriate Privacy & messaging form for the existing app ID. Live restoration of ads on the reporting device has not been verified.

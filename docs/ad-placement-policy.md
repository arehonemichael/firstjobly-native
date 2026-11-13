# Current ad entry and job-tap policy

This is a rollout policy, not a demonstrated revenue optimum. Production fill, earnings and retention still need measurement.

## Inventory

- Home: existing banner plus a feed-native slot after the fourth recommended job when at least four recommendations exist.
- Jobs: native slots after indices 3, 9, 15… (fourth, tenth, sixteenth jobs).
- Job detail: existing banner/native placements. Apply does not trigger an ad.
- Hot: footer banner. Saved: banner below its heading. No new Community/Profile placements.

## Job interstitials: 1, 3, 6… opportunities

The first ready tap is eligible (`firstJobOpen: 1`). After that ad actually opens, two more taps are needed (`afterFirstAdJobOpens: 2`), making the next opportunity the third tap when the first ad appeared on tap one. Later ads require three further taps (`everyNthJobOpen: 3`): nominal opportunities 1, 3, 6, 9….

The former four-minute cooldown caused the user's reported `reason: cooldown` skips. It is now **60 seconds**, alongside the existing **60-second shared gap after any full-screen ad closes**. Therefore quick taps inside that minute still skip an ad, including tap three. No tap count overrides consent, inventory, the shared lock/gap or the four-interstitial-per-session cap. If an opportunity is skipped, it remains eligible for a later tap. Counters update on OPENED; no inventory at tap never holds navigation waiting for a load.

Skip diagnostics now include jobOpens, requiredOpens, shownThisSession and cooldownRemainingMs. A separate `fullscreen-lock-or-gap` reason can apply after the format cooldown expires, since the shared interval starts at close.

## App-open on a fresh launch

The previous background-only policy did not satisfy the requested app-entry placement. The **dedicated AppOpenAd format**, not an interstitial, now has one cold-start opportunity when the initial ready destination is Home. It is enabled from launch one, subject to restored authentication, confirmed completed profile, foreground state and valid consent.

`coldStartEnabled: true` and `coldStartWindowMs: 1500` allow ready inventory, or inventory loading within the next 1.5 seconds, to enter the existing 75ms cancellation guard. Home does not wait for that load. No fixed loading delay is added. If the ad/profile/permission is too late, the opportunity expires instead of showing unexpectedly later.

Interaction, backgrounding, startup deep links/non-Home destinations and the deadline cancel this opportunity. It never replays on route changes/root remounts. Privacy/onboarding flows remain protected. Errors/rejections release the shared lock and cannot trigger a second startup presentation. Consent-form UI still blocks eligibility.

App-open keeps its **persisted three-hour cooldown**, 3.5-hour inventory age limit and shared 60-second full-screen gap. Thus it is not guaranteed on every restart. A startup app-open ad also prevents an immediate job interstitial within the following minute. Background returns retain the real-background, one-second-away, Home/profile/consent, 75ms cancellation and 200ms lateness guards.

Look for `startup.window` and `show` with `format: app-open, placement: cold-start`. Expiration/interaction/launch/cooldown/lock skip events explain an absent entry ad. Hot reload is not a fresh launch.

## Changes and verification

- `src/ads/config.ts`: startup switches/window, minimum launch one, two taps after the first job ad and 60-second interstitial cooldown.
- `src/ads/app-open-controller.ts`: bounded startup entry uses the same guarded presentation/cleanup path as resumes, without blocking navigation.
- `src/ads/AdMobLifecycle.tsx`: offers cold entry once for the initial ready destination.
- `src/ads/interstitial-manager.ts`: enforces first/second/repeat thresholds and reports skip counters.
- `src/ads/diagnostics.ts`: permits those numeric counters and retains known public SDK error codes while redacting private strings.
- `scripts/test-ads.cjs`: 66 tests, including 1/3/6 opportunities outside the time gap, early/late entry inventory, touch/background/deep-link/profile/consent cancellation, root-entry uniqueness, rejection/error cleanup, launch and persisted cooldown checks.
- `scripts/test-expo-go.cjs`: 14 tests, including lifecycle-to-SDK cold-entry wiring and no replay on root remount.

TypeScript, focused lint and Android/web JS exports pass. Existing iOS app-ID warnings remain; native iOS ads stay unsupported. No dependencies, native configuration, production IDs, personalization logic, Apply, screens/routes or backend were changed in this update. JS export/mocks do not prove physical-device rendering; no real impressions/clicks were generated during checks. The supplied device trace does confirm previous banner/native SDK impressions and one normal banner no-fill; it showed cadence/cooldown skips for interstitials, not a general SDK outage.

## Device check and rollback

No new Android binary is required. Pull `ads-revenue-fix`, restart Metro with `npx expo start --dev-client -c`, fully close the app and launch it into Home. Do not interact during the bounded startup opportunity. Preserve stored consent and ad timestamps while checking the trace.

Use official test units. Wait at least 60 seconds after closing a full-screen ad before testing another. App-open's three-hour persisted cap still applies; a restart does not reset it. Observe actual entry presentation, cold expiry, 1/3/6 job opportunities, no-fill and withdrawal/regrant. Never click production ads.

Rollback: set `appOpen.coldStartEnabled` false to restore background-only entry; raise `minLaunches` or the startup/format cooldowns, raise `afterFirstAdJobOpens` to 3 to restore the former second opportunity, raise `everyNthJobOpen`, or disable the corresponding formats. These are source settings requiring a JS update, not remote switches.

Development/preview test creatives earn no revenue. Existing production builds use the unchanged production units with test mode off; no release/store publication was performed. Monitor revenue per active user alongside early exits, job opens and retention before increasing frequency further.

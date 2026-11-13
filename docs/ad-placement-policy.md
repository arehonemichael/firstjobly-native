# Current revenue-focused ad policy

This is an initial rollout policy, not a demonstrated revenue optimum. Real fill, earnings and retention must be measured on production traffic.

## Inventory

- Home: existing banner plus one feed-native slot after the fourth recommended job when at least four recommendations exist.
- Jobs: native slots after zero-based indices 3, 9, 15… (fourth, tenth, sixteenth jobs).
- Job detail: existing banner/native placements; Apply does not trigger an ad.
- Hot list: existing footer banner. Saved: existing banner below its heading.
- Community/Profile: no new placements.

## Job navigation interstitials

`ADS_CONFIG.interstitial.firstJobOpen = 1`: the first job tap is eligible if inventory and permission are ready. Preloading runs in parallel and never holds navigation waiting for a load. If the first tap finds no inventory, it proceeds and keeps the first-ad opportunity for a later ready tap.

After the first actual OPENED event, `everyNthJobOpen = 3`: another opportunity becomes eligible after three further job taps. With no other skips, this corresponds to taps 1, 4, 7…; it does **not** guarantee an ad at those exact taps. The four-minute cooldown, four-opened-ads-per-session cap, shared 60-second post-release gap, consent and inventory availability still apply. Skipped opportunities remain eligible for a later tap. Counters update only on OPENED.

Rapid taps during a presentation are ignored; the first tap owns navigation. CLOSED, ERROR, rejected show calls and start/safety timeouts release that navigation exactly once. No forced ads were added to Apply, CV/Z83 or form submission.

## App-open

Keep the existing dedicated AppOpenAd on an eligible **real background return to Home**, from the second app launch onward, with the three-hour cooldown, onboarding/consent checks and bounded foreground cancellation guard. Cold startup only preloads; it does not display an interstitial or delay entry while waiting for an ad. App-open and interstitial formats share the same lock/gap.

## Controls and rollout

- To reduce early interruption, raise `firstJobOpen` to 2 or 3 independently of the repeat interval.
- To reduce repeat frequency, raise `everyNthJobOpen` to 4.
- Existing enabled/feed/detail switches remain available.
- Keep official test units during development/preview verification. Test creatives do not earn revenue. Existing production builds select the unchanged production units when test mode is off; no release or store publication was performed here.
- Before broad rollout, verify test creatives, first/repeated job navigation, no-fill, withdrawal/regrant and background-return behaviour on Android. Monitor production revenue per active user alongside early exits, job opens, session length and retention; reduce interruptions if retention worsens. Do not treat increased request opportunities as proven higher revenue.

## Changes and checks

- Home insertion: `src/app/(tabs)/index.tsx` reuses NativeAdBlock, shouldInsertNative and the existing native.feedEnabled switch. No native SDK/config/dependency change. Its typecheck, focused lint, 13 runtime tests and web export pass.
- Cadence: `src/ads/config.ts` adds the enforced firstJobOpen threshold; `src/ads/interstitial-manager.ts` chooses first versus repeat thresholds from opened-ad state; `scripts/test-ads.cjs` covers first/repeat, unavailable inventory, rollback threshold and the existing recovery/limits.
- Verification: 49 ad tests, 13 runtime tests, TypeScript and focused lint pass. No real impressions/clicks or production revenue were generated/verified. This is JavaScript-only; no new Android binary is required for the existing development client.

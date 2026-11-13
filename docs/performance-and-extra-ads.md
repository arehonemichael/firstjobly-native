# Performance and two additional ad opportunities

Branch: `perf/foreground-interstitial-opportunities`. Based on `fix/navigation-label-layout` (5ae6f71); no main merge or deployment. No backend/schema changes or new dependencies.

## Measurements

Three samples per revision in Chromium, 390×900, reduced motion, Expo **web development** server. Fresh isolated signed-in browser contexts, 80 fixture jobs, API latency 120ms; optional Home draft query deliberately delayed 600ms. No live writes/ad clicks. These are not installed Android or production measurements. Timing includes browser navigation/rendering and development bundle overhead. See [raw baseline](performance/before.json), [raw after](performance/after.json) and `scripts/measure-app-performance.cjs`.

| Metric | Before median | After median |
|---|---:|---:|
| Home shell usable | 1,517ms | 1,610ms |
| Home profile greeting ready, from navigation | 2,360ms | 1,677ms |
| Profile greeting delay after shell, paired samples | 843ms | 61ms |
| Job details after explicit row tap | 284ms | 278ms |
| Cold Gov feed + latest circular ready | 1,434ms | 1,549ms |
| Simultaneous latest-circular GETs on cold Gov | 3 | 1 |
| Saved-ID GETs across Home → details → Saved | 3 | 1 |
| Profile reads through Home → Profile | 2 | 2 |

The raw `savedReads` metric includes one separate Home summary HEAD/count request: totals 4 → 2. No claim of better startup/Gov total time; both were slower in this small development sample. The demonstrated improvements are independent Home profile delivery and fewer duplicate reads. Detail timings are effectively unchanged. Profile's full edit fields need a separate query from Home's subset; it was deliberately preserved. No production revenue/retention inference.

## Audit and changes

- **Home:** five independent requests already started together, but `Promise.all` delayed all overview publication until the slowest optional query. Profile, completion, saved count and drafts now publish independently; successful previous sections survive refresh/failure. Completion still requires the actual profile/work/doc inputs. Unknown/failed counts stay unknown. Existing skeleton/error/retry remains; changing user/focus invalidates late updates.
- **Gov jobs:** badge, page and circular card simultaneously requested the same metadata before the existing cache filled. Transport now shares GET promises by owner + exact path. Resolved transport promises are discarded; existing five-minute owner cache/pagination/search rules remain. Mutations/auth changes invalidate reads; old responses cannot refill cleared caches. Writes are never coalesced/retried by this addition. PDF taps still request fresh URLs.
- **Saved:** each mounted hook fetched its own IDs. One in-memory owner store now coalesces reads, caches for 60 seconds, refreshes explicitly, broadcasts successful changes, locks duplicate writes and defers reads during writes. Auth changes clear IDs and invalidate old work, including switch-away/back races. Saved rows are also owner-scoped and ignore stale responses. Existing rows remain during refresh; failures expose retry instead of an empty-success message.
- **Jobs:** already bounded to 300 candidate rows, local full-set filters, incremental 25-row rendering, memoized cards, FlatList windows and fixed-size cached logos. Kept the existing search contract; replacing that with partial server pages would change filter results. No unsupported claim about CPU improvement.
- **Job details:** public job and personal application reads remain separate. The warmed detail timing above did not justify a new details cache, which could conceal a withdrawn job. Existing Apply logic unchanged.
- **Community:** already owner-scoped cache, debounced search, cursor pagination, mutation version guards/rollback, stable list keys, preserved feed scroll and signed-media refresh. Preserved it; exercised its actual screens with isolated endpoint responses.
- **Profile:** existing profile gating and independently fetched work/doc sections inspected. Full profile read retained; no measured on-device timing available. Existing mutations untouched.
- **Applied/Tools/More/auth:** inspected existing routing/loading, preserved destination ordering and behavior. No new data framework, routing changes or speculative memoization. Existing ads and document/download gates untouched.
- **Assets/rendering/ad contention:** retained fixed logo/image dimensions, existing image caches and virtualized lists. No new ad request stream: extras consume the existing interstitial inventory. Native ad loading/contention cannot be measured in a web run.

## Exact extra opportunities

Only an **explicit Home tab press** from either:

1. The normal **Jobs** feed, loaded without error, search text, active filters or an open filter modal.
2. The **Gov jobs** feed, loaded without error, search/filters, pagination, saving, filter picker, PDF download or circular-card error.

These are two eligible source transitions sharing one allowance, not two per screen or one guaranteed per source. A focus-scoped readiness registry includes child circular controls. Require at least one second without scroll/focus changes and no keyboard/focused input. No other tab, detail/back action, Apply, auth, composer, deep link, load completion, timer, app launch/resume/exit calls the offer function. If no suitable transition occurs, there are no extras.

Reviewed AdMob's [recommended transitions](https://support.google.com/admob/answer/6201350) and [disallowed placements](https://support.google.com/admob/answer/6201362). Extras appear only between deliberate sections after sustained use. Existing unrelated placements were not retuned.

## Session, timing and coordination

- Singleton lasts for one running JS app process, consistent with existing interstitial counters. Routes, component remounts, account switches and brief backgrounding do not reset it. Restarting the JS runtime begins a new session; fast refresh is not a real release-session test.
- Clock uses monotonic `performance.now()`, counting initialized/onboarded, consent-permitted foreground time. Background, unresolved startup/profile, consent UI and any held full-screen lock pause it.
- Require two deliberate interactions after the last full-screen release (including the current tab press); the additive interaction subscription preserves the existing app-open observer.
- First attempt needs **300,000 active milliseconds**. Another attempt needs **300,000 more active milliseconds**. Every full-screen lock release resets that active gap, including failures; lock acquisition independently enforces at least five wall-clock minutes after a full-screen release.
- At most **two SDK OPENED events** count as extra presentations. Duplicate events do not count again. A separate stricter **two attempted presentations** limit and five-minute failed-attempt spacing prevent repeated failure interruptions; consequently an unsuccessful attempt may leave fewer than two impressions.
- Already-loaded existing interstitial only; no waiting for inventory, queued load-to-show callback or timer-triggered presentation. Unavailable inventory consumes no attempt and navigation proceeds immediately.
- Existing manager's show/error/close/watchdog lifecycle is reused. SDK OPENED updates the extra counter without changing existing job-open cadence counters. The current SDK instance returns the presentation promise; no hook-level `await show()` assumption.
- Owner-specific shared full-screen lock prevents overlaps with app-open, existing interstitial and rewarded downloads. Existing callers retain their **60-second** lock gap. Only extras request a **five-minute** gap. Observers cannot throw through existing ad behavior.
- Dismissal/error/revocation/start watchdog/safety watchdog release pending navigation once. Rapid tab taps are ignored while the extra owns navigation. Original 1.5s/120s watchdogs retained. No second native interstitial instance or new unit is created.
- No changes to production IDs, official TestIds, unsupported-platform guards, app-open rules, existing job-open cadence/cooldown/cap, banner/native placements, consent/NPA or rewarded CV/Z83/download semantics.

## Changed files

- Performance: `src/hooks/use-home-summary.ts`, `src/app/(tabs)/index.tsx`, `src/hooks/use-saved-jobs.ts`, `src/lib/saved/store.ts`, `src/components/saved/normal-jobs.tsx`, `src/lib/circular/{client,transport}.ts`.
- Extra policy: `src/ads/extra-interstitial-controller.ts`, `extra-boundary.ts`, `useExtraBoundary.ts`, `ExtraInterstitialLifecycle.tsx` and `.web.tsx`.
- Coordination/wiring: `src/ads/{fullscreen-lock,interstitial-manager}.ts`, `src/lib/user-interaction.ts`, `src/app/_layout.tsx`, `src/app/(tabs)/{_layout,jobs}.tsx`, `src/components/circular/{feed,latest-card}.tsx`.
- Verification: `scripts/test-ads.cjs`, `scripts/test-performance.cjs`, `scripts/measure-app-performance.cjs`, `scripts/verify-community.cjs` (use the existing More → Community navigation), and this report/raw measurements.

## Checks and remaining device verification

Verified:

- TypeScript: passes.
- 266 Node tests across ads, performance, Gov jobs, Community, startup, Expo Go, navigation, Home/session hero, Hot jobs and personalization pass; 91 original ad cases retained. Includes injected SDK OPENED/CLOSED/error/rejection/throw/missing-event/consent cases, fake foreground clocks, owner-switch races and read/mutation invalidation.
- Browser fixture suites: 126 Gov jobs checks (slow/error/empty/auth/rate-limit/search/pages/save/apply), 76 Community checks (mutations, drafts, sign-out, account isolation, threading and exact scroll restoration), 16 personalization checks, 120 Home/nav/login checks and 1,231 navigation layout checks pass. Gov diagnostics suite uses a separate development server with `EXPO_PUBLIC_CIRCULAR_DEBUG=true`; normal app diagnostics stay off.
- Android JavaScript export passes. This is not a native APK installation or ad presentation test.
- New modules/focused changed infrastructure lint clean. Repository lint still fails on **8 pre-existing errors and 16 warnings**, down from baseline 9 errors/16 warnings; existing effect errors remain in Jobs/Saved and other legacy screens. No new warnings.
- Expo Doctor: **20/21**, same pre-existing 21 SDK patch mismatches. No package versions changed. Existing missing iOS AdMob App ID warning remains; Android is the current target.

 No Android device, signed-in production account or real ad presentation is available in this workspace. Controller tests use fake SDK events/clocks; web tests intercept auth/API traffic. JavaScript export does not replace an installed native test.

On an Android development build (official test units are already selected by `__DEV__`), retain the real five-minute rules:

1. Check current app-open, first/third-job cadence, Home/feed native, banners and rewarded CV/Z83/download flow.
2. Use the app foreground for five minutes **after the last full-screen closes**, finish scrolling/searching, then explicitly tap Home from Jobs or Gov jobs with loaded inventory. Check close/error returns Home once.
3. Repeat after five more foreground minutes. A third eligible transition must never show an extra. Backgrounding for five minutes must not unlock one.
4. Test unavailable inventory, offline, revoked consent, keyboard/search/filter/PDF/modal, interrupted show, rapid taps and app resume; none may queue a late ad. Check all existing screen flows, scroll return, pagination, saved mutations and a second account.
5. Native SDK scheduling/show failures and Android frame/memory/startup behavior still require this check. The app does not schedule late presentation from a load callback; it cannot cancel an already-issued native SDK `show()` call. Use provider test inventory only and never click live ads.

PowerShell:

```powershell
git fetch origin
git switch perf/foreground-interstitial-opportunities
npm ci
npm run typecheck
node --test scripts/test-performance.cjs scripts/test-ads.cjs
npx expo start --dev-client -c
```

Keep local uncommitted work before switching branches. No merge/deploy command is included.

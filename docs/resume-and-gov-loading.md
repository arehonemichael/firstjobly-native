# Background return and Gov Jobs investigation

## Behavior and confirmed client defects

`BACKGROUND_HOME_THRESHOLD_MS` in `src/lib/resume/controller.ts` is the shared 30-minute threshold. The memory-only controller records real `background`, ignores `inactive` alone, and consumes each qualifying return once. Cold startup remains independent. A 350ms nonblocking routing grace lets native link/notification events win; late notifications still navigate normally. Nothing covers the page or waits behind a splash.

The root lifecycle component uses the existing navigation container. It preserves the tab navigator and Home route keys/cached React state while removing root-stack and tab-back history, then focuses Home. If already Home, it refreshes in place. Home's existing data stays visible while its independent sections revalidate. The recommendation hook now retains existing rows even when both refresh and fallback fail, and shows its existing subtle refreshing state during revalidation. Brief interruptions no longer trigger the recommendation hook's separate unconditional AppState refresh.

Signed-in resets require resolved authentication and confirmed completed onboarding. Failure to read the profile leaves the current screen intact. Supabase native auto-refresh previously had no AppState hint; it now uses the installed SDK's documented `startAutoRefresh`/`stopAutoRefresh` mechanism. There is no new sign-out, explicit session restoration, credential storage or refresh-token transport. A network error does not trigger logout.

Resets are restricted to a browsing allowlist. Profile/settings forms, CV/Z83, Community post/reply screens, job/application details, account deletion, login/callbacks and notification permissions retain their work until the user reaches a safe browsing route. Existing drafts are not rewritten or discarded. Incoming URLs and recognized notifications cancel the pending reset. Consent, full-screen ads and reminder permission operations are observed through their existing state/locks; their own background cycles are excluded and a newly busy flow prevents reset consumption. Listener/timer cleanup and account changes cancel pending routing.

No file under `src/ads` changed. The coordinator does not acquire/release ad locks, call ad presentation APIs, replay cold start, emit tab presses, create a new app session or reset ad counters.

## Gov Jobs findings

Already correct before this change:

- `GET https://firstjobly.co.za/api/app/circular-jobs?page=1&page_size=20` is bounded server pagination. Additional pages use the same filters and increasing page numbers.
- Exact apex host, `Authorization: Bearer <session JWT>` and `x-fj-token` headers; no token query parameters.
- List and `/circular-batches/latest` metadata start independently. Identical concurrent GETs are already deduplicated across consumers. One list GET and one metadata GET were observed in each controlled first-load sample; no retries.
- A stable-ID `FlatList` virtualizes rows. The list does not await ads, images, a second count request, full job detail, or per-row requests. Detail is fetched only on its own screen. Existing server `total` arrives in the page envelope, but does not gate a separate request.
- Client work combines pages, removes duplicate IDs and applies the existing withdrawn-saved-job rule. Optional internship filtering checks the loaded page, not a downloaded full dataset; it exposes further pages rather than claiming none exist.

Confirmed defects fixed:

- The five-minute fresh cache deleted expired values, leaving no stale fallback for remounts. List entries can now be shown immediately for up to one hour while refreshing. Cache keys remain scoped to owner + exact filter/page path, bounded to 100 entries, and cleared by existing account/mutation invalidation. Empty responses are still not cached. Expiring detail/download URLs do not use stale fallback.
- Replacing page 1 invalidated loaded extra pages by base-object identity, potentially losing rows and scroll on detail return. An unchanged cached paginated window now survives focus, until explicit refresh, mutation invalidation or cache retention expiry. Refresh preserves the old window until success, then atomically replaces it with the new first page. This avoids combining newly ordered page 1 with old page 2. It deliberately does not silently revalidate only the first page of a paginated window.
- A late page response could replace pagination state after filters/account/base data changed. It is now discarded. Old search/base responses already had generation guards; those remain.

## Measurements

These are development browser checks, **not an installed device or live backend measurement**. Chromium 390×900; three fresh signed-in isolated fixture contexts each; a single small summary record (404 UTF-8 bytes), configured API delay 120ms. Same benchmark sequence before/after. Fixtures intentionally isolate client behavior; they do not represent production row volume. No production requests/writes or test accounts were used.

| Measurement (median, ms) | Before | After |
| --- | ---: | ---: |
| Tab click through visible list shell | 201 | 127 |
| Tab click through first usable job button | 312 | 315 |
| Warm return observation, including 300ms collection interval | 405 | 385 |
| First list / latest metadata requests | 1 / 1 | 1 / 1 |

Cached rows were visible on all three warm returns, both before and after. Do not interpret the return observation as pure render time. The initial usable-list measurement did **not** improve meaningfully. Development scheduling/compilation varies; these three samples are not a statistically controlled speed claim.

After-change fixture list request/body/parse totals: 138–140ms, JSON parsing 0–1ms. Bounded row transformation 0–0.1ms. First recorded commit-frame proxy 12–24ms after hook receipt; browser response-to-usable-button measurement is separately in the JSON. Frame logging is a JS frame proxy, not proof of a native presented frame. Raw fixture traces/samples are in `docs/performance/resume-gov/{before,after}.json`; `scripts/measure-gov-resume.cjs` reproduces them with the debug development server.

A five-minute expiry, slow/failed revalidation, pagination preservation and request races were verified with controllable clocks/deferred promises in hook tests. Those are deterministic behavior tests, not performance measurements. Native lifecycle integration tests mock AppState and timers; they also exercise the installed TabRouter's retained keys and cleared back history.

**Production cause remains undiagnosed.** No authenticated live Gov Jobs token or live Lovable backend source is available here. The existing native auto-refresh omission is a reliability issue; it has not been demonstrated to explain production Gov Jobs latency. Instrumentation now separates response headers, body read, JSON parse, UTF-8 payload size, record count, attempt number, transformation and first list commit proxy. It remains opt-in (`__DEV__` and `EXPO_PUBLIC_CIRCULAR_DEBUG=true`); the existing credential redaction remains. Payload bytes mean decoded UTF-8 JSON, not compressed wire bytes. A backend investigation prompt is in `docs/lovable-gov-performance-audit.md`.

## Verification

- 369 Node tests pass, including 35 new resume/cache/hook/transport checks. Fake clocks test brief/long/repeated lifecycle events, inactive-only dialogs, protected routes, account changes, notifications/deep links, onboarding, native auth refresh hints, listener cleanup, retained navigation keys/history, stale/error states and pagination/search races.
- 126 isolated Gov Jobs browser checks pass: pagination, debounced filtering, loading/errors/retry, save/withdrawal, apply/Z83 behavior, navigation and notifications. The legacy alert switch assertion now targets its named switch because local reminders added another switch above it.
- 120 isolated Home/nav/login browser checks pass, including narrow/enlarged text cases.
- Typecheck and focused lint pass. Both iOS and Android JS exports pass.
- Full lint: existing 8 errors / 16 warnings. Expo Doctor: 20/21, existing 21 SDK patch mismatches. No dependency upgrades in this change.
- Not verified: physical iOS/Android AppState/OS dialog timing, native frame presentation, real auth expiry/offline refresh, live deep-link delivery races, actual server query timings, or live ad inventory/presentation. Check these on signed builds before release. Late external destinations still route normally even if the native event arrives beyond the short grace period.

## PowerShell

```powershell
git fetch origin
git switch fix/resume-home-gov-loading
git pull --ff-only
npm ci
npm run typecheck
npm run test:resume
npx expo start --dev-client -c
```

To capture authenticated device timings without sharing tokens:

```powershell
$env:EXPO_PUBLIC_CIRCULAR_DEBUG="true"
npx expo start --dev-client -c
# Sign in normally; open Gov jobs, page, open a detail and return, refresh.
# Copy only the [FirstJobly circular] and [FirstJobly circular render] diagnostics.
# Diagnostics redact JWTs. Review logs before sharing; search/title previews may be personal.
# Stop Metro, then remove the flag:
Remove-Item Env:EXPO_PUBLIC_CIRCULAR_DEBUG
```

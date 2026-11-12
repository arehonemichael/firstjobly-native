# Home typography, loading, logos and advertising

## Presentation

The established Plus Jakarta Sans family is retained instead of adding Inter.
Only regular, medium and semibold are loaded. Lora is removed from initialization;
legacy editorial token names map to the sans-serif semibold face so supporting
routes/dialogs stay consistent. Web faces include a system sans-serif fallback.
The existing pink/navy palette and real `assets/images/icon.png` remain unchanged.
No hero photos, headlines, fact-bank entries, session selection or placement are
replaced. The root splash still follows authentication/font readiness.

Home's old literal was lowercase `firstjobly`; its logo bitmap did not contain a
missing letter. It now says `FirstJobly`, with explicit line height and a wrapping
header/brand group so adjacent controls move safely at larger text sizes. The
Home greeting is a restrained 28 px sans-serif heading.

Company logos use fixed square frames, white neutral backgrounds, borders and
internal padding. `contain` preserves their ratio; intrinsic pixel dimensions
and device scale cap raster upscaling. Portraits keep their separate circular
cover behavior. Initials remain while loading, then disappear when an image
loads, including transparent images. A broken source unmounts once, keeping its
company initials; a different company/URI starts fresh state. Recycled image keys
include both URI and company name. No logo URLs are guessed, reassigned or replaced.

A read-only public sample found SVG/PNG logos across many unrelated external
hosts. Four representative original URLs returned image MIME types successfully.
There is no verified common resize contract, so arbitrary transform parameters
are not appended. Decode/display size is bounded on the client; remote origin
payload size and availability still depend on those hosts.

## Measured loading work

The old recommendation request awaited candidates, then private inputs, then
behavior inputs. It also transferred description/responsibilities/document arrays
unused by Home. Diversity ordering repeatedly parsed the same source URLs and
recounted each window in nested loops. Home separately read the same profile.

The existing recommendation service/cache is extended; no competing query
library or new dependency is introduced. Independent candidate/private reads now
start together. Candidate-specific application exclusions and missing reference
jobs run concurrently once IDs are known. Home/completion/recommendations share
one explicit, owner-scoped profile projection and in-flight read. Profile data
used by the matcher is projected separately, excluding contact/name/birth fields.
Reference jobs select only affinity keys; cards omit large detail bodies, which
are fetched by the existing detail screen. Profile completion's experience probe
is bounded to one row; the latest renderable draft uses the existing jobs inner
join and one-row limit. Existing counts/completion semantics are preserved.

Diversity keys are computed once per candidate and page counters update
incrementally without changing the ranking rules/quotas. Repeated daily opens no
longer invalidate a still-valid snapshot. Cached routes seed their first render
from the existing snapshot. Safe previous cards remain during genuine background
refresh; invalid accounts/filters do not share their data. Generation/revision
checks reject older responses; mutations invalidate results. Profile memory TTL
is 60 seconds, ranked snapshots three minutes; owner changes clear private maps.
Remote changes outside this app are bounded by those TTLs.

The candidate window remains bounded to 300 for deterministic ranking; result
pages contain 20 and Home displays six. This is a bounded candidate feed, not a
whole-catalog search. Home's shell, greeting, search and bundled hero do not wait
for recommendations, logos or ads. First-load placeholders now match the measured
286–290 px card footprint; refreshes retain cards. Failures show retry/search or
an explicitly labelled latest fallback, not a fabricated empty personalized feed.

`docs/home-loading-benchmark.json` records six controlled cold trials per version:
same 300 fixture jobs, same detail text, same 40 ms latency per simulated HTTP
request, same host/runtime. A warm read follows each trial. Baseline commit is
`e1b9c6b6298835e7c5df6eac92a5c8330b01ca24`.

| Data-layer measurement         |    Before |    After |
| ------------------------------ | --------: | -------: |
| Median cold feed               |    516 ms | 110.5 ms |
| Response bytes across requests | 1,707,181 |  171,481 |
| Requests per cold feed         |         8 |        8 |
| Requests per warm feed         |         0 |        0 |

These are isolated data-layer fixture measurements, excluding authentication,
fonts, device rendering, logo transfers and live database/network variability.
They are not a production-device speed claim. Reproduce with
`npm run benchmark:recommendations`; pass a separate baseline checkout directory
to `node scripts/benchmark-recommendations.cjs <baseline-directory>` for comparison.
The request count stays the same in this standalone benchmark; profile sharing
with Home is separately tested to reduce two simultaneous profile reads to one.
Existing audited public-feed/owner indexes cover these queries. No index,
migration, table, policy or backend deployment is added.

## Real SDK advertising

The installed Google Mobile Ads SDK, existing banner/app-open units and original
production IDs are reused. The Home banner is outside job rows, after the
recommendation section and before quick links. It is labelled Advertisement and
uses the provider's anchored adaptive banner, measured container width and a
90 px minimum inventory area. Loading is asynchronous. No fill, SDK error or a
12-second no-response collapses the optional slot instead of leaving a broken
blank. The provider renders the creative; there is no fabricated advertiser or
hardcoded image masquerading as an ad.

There was no existing consent gate in the inspected integration. The SDK's UMP
request/update/form/privacy-options APIs now gate initialization and requests.
Automatic forms are initiated only while Home is ready and foregrounded. Unavailable or
refused consent suppresses ads. Where consent is obtained, storage/basic-ad
choices must permit requests; requests remain non-personalized. The provider's
privacy-options action is available when needed. Banner/native/interstitial
consumers honor the shared permission. Withdrawal clears pending inventory;
consent UI gets a quiet period before any app-open opportunity. Native app
measurement initialization is delayed via the existing Expo plugin until the
explicit consent-gated initialization call.

App-open advertising is enabled as an app-scope controller with one foreground
subscription and one cached preload at a time; launches are counted once per JS
session, including root remounts. Cold launches continue immediately and only preload. A later genuine
background-to-active event can use inventory already ready at that event. A
bounded 75 ms guard allows URL/navigation/touch/accessibility events to cancel;
a delayed callback after 200 ms skips. Missing/late inventory never triggers a
presentation after load. Route changes, loss of consent, backgrounding and user
interaction cancel pending presentation. Native SDK close controls own dismissal.

Presentation requires ready Home, foreground state, confirmed existing profile
`onboarding_completed=true`, consent, at least three recorded launches, a four-hour
cooldown and inventory younger than 3.5 hours. Authentication, onboarding,
applications, job details and other routes cannot present. Unknown/failed profile
reads fail closed. The cooldown is reserved before a show attempt to prevent
error/re-entry loops. The onboarding flag is not modified by this feature.

Development uses SDK TestIds. Internal development **and preview** EAS profiles
explicitly set public `EXPO_PUBLIC_ADS_TEST_MODE=true`, so a release-style QA APK
also requests documented test inventory. Production retains the existing units
unless explicitly overridden. No live impressions/clicks were generated during
validation.

## Verification and limitations

- `npm run test:ads`: consent, refusal, unavailable configuration, forms, privacy
  withdrawal, preload/no-fill/expiry, cooldown/first launches, failed presentation,
  duplicate events, sensitive contexts and foreground URL/touch/navigation races.
- `npm run test:expo-go`: actual module evaluation with a throwing unsupported
  SDK, preserved production IDs/test overrides, one runtime across root remounts,
  and a mocked native banner's width/unit/loading/no-fill handlers.
- Recommendation tests cover unchanged ranking, owner isolation, old applications,
  parallel inputs, one profile request and duplicate-open cache reuse.
- `scripts/verify-home-polish.cjs` checks loaded fonts, full wordmark, larger text,
  mobile/desktop, six logo variants, real delayed refresh, explicit failure and
  unchanged hero text against the real web UI with isolated responses.
- Existing startup, UI, hero, navigation and personalization checks remain relevant.
  TypeScript, focused lint, web/Android JS exports and native config introspection
  are run. The generated Android manifest includes delayed measurement.

Native provider behavior is tested with SDK fakes/models, **not actual filled
Google inventory**. No Android device/emulator is attached here, so real Google
test-ad rendering, UMP dashboard configuration and on-device foreground behavior
remain to verify. A successful initialize call is not evidence of fill.

Configured native ads are Android-only. Expo Go and web show no fabricated
inventory; iOS needs its own real app/unit configuration before native ads can be
enabled. Missing configuration/consent and provider no-fill remain possible.
A new Android binary is needed for the delayed-measurement native setting. Use
`npx eas-cli@latest build --platform android --profile development`, install that
APK, and run `npx expo start --dev-client --clear`. The existing preview profile
is also test-ad-only. Check the Home slot, consent refusal, provider dismissal and
eligible background returns using test ads; do not click production ads for QA.

Final checks: 373 browser checks passed (54 Home polish, 211 UI, 52 hero,
16 personalization, 40 startup). Unit/model suites passed: 11 ads, 9 Expo Go,
32 recommendations, 10 startup, 9 hero and 5 navigation. TypeScript passed;
web and Android JavaScript exports succeeded. Full lint retains the baseline
13 errors and 19 warnings; changed files introduce no new findings.

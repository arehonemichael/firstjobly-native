# Brand, navigation and honest Hot jobs

## Brand and navigation

The Home source already contained `FirstJobly`. The changes address width and
glyph-ink constraints rather than appending another letter. The brand now uses one inline text run with two
colour spans: First `#E1225F`, Jobly `#061A30`. Both inherit the established
Plus Jakarta Sans semibold/bold face, size and baseline. There is no intervening
space. The parent reserves right-hand glyph ink space and generous line metrics.
A viewport/font-scale budget keeps the entire word visible at large system text
sizes; actions move onto another row instead of shrinking/cropping the brand.
The actual bitmap logo and existing fonts are reused.

The collapsed navigation previously split a 240px dock between icons, padding
and shrinking labels. Expanded controls could also wrap at increased font sizes.
The dock is wider, labels do not flex-shrink, icon frames reserve their own space,
and pressed borders reserve equal width in both states. Normal-size mobile labels
stay on one line. When the complete longest label cannot fit, every control in
the mobile dock/arc/footer switches to an accessible icon, preserving the circular
concept. No mixture of clipped words and icons is used. Selection check marks and
pink surfaces identify the selected destination without increasing its size.
Desktop uses a horizontally scrollable labelled tab row rather than wrapping or
truncating labels. Safe-area spacing, focus trapping, Escape, roving tab focus,
route history, permissions and all destinations remain intact.

The existing semantic brand/navigation tokens supply primary pink, soft pink,
pressed pink and navy. Global focus outlines remain pink. Meaningful success,
warning/error colours and existing content colours are retained.

## Backend contract and approval boundary

The owner supplied two live audits dated 13 November 2026. They establish:

- The existing `hot_job_cache` is publicly SELECT-readable, with job_id, rank,
  click_count and refreshed_at. It contains at most 20 ranked Apply-click jobs,
  refreshed by the existing cron every five minutes.
- `get_hot_job_ids()` does **not** allow anon execution, correcting the first
  audit. This implementation reads the public cache table for both guests and
  signed-in users, never the RPC.
- Raw clicks currently inflate rankings, and unavailable/expired jobs remain in
  the cache. The app cannot fix global identity deduplication by reading private
  clicks or applications; it does neither.
- Apply clicks are not applications. Only Easy Apply produces application rows;
  outbound clicks cannot establish employer-site completion.

**The Hot feature is OFF by default.** `EXPO_PUBLIC_HOT_JOBS_VERIFIED=true` may be
set only after the owner approves the SQL, Lovable applies it, the scheduled cache
has refreshed and the new deduplicated semantics are verified. Audited SQL is not
proof that it was applied. No application environment applies this migration.

The single review-only file is:
`supabase/migrations/20261113010000_deduplicate_hot_job_activity.sql`.
It preserves refresh_hot_job_cache() RETURNS void, SECURITY DEFINER, public
search_path, service-role-only execution, existing cache columns and cron.
It ranks by count(DISTINCT coalesce(user_id::text, anonymous_id)) in the rolling
seven-day window; excludes inactive, unapproved and past-SAST-closing jobs;
requires at least 10 actors; breaks ties by job_id; returns at most 20 ranks.

A signed-in actor across devices counts once. An anonymous device counts once.
That same person's earlier anonymous activity and signed-in activity may count
twice, as explicitly allowed in the supplied audit. No identity matching is
attempted. click_count keeps its existing name but stores this deduplicated
activity count. It never means completed applications.

The threshold is documented/configurable in the function's
minimum_unique_activity constant and matching HOT_RULES.minimumActivity. The
existing created_at/job_id index supports the bounded seven-day scan; no new
index, cron modification, refresh call or backfill is included. This is DDL
containing the function's future DELETE/INSERT body, not execution of that body.
The SQL has not been executed or applied here. PostgreSQL execution plans and
runtime cost remain for Lovable to verify.

## App integration

Once enabled, one shared public query loads the cache, then bounded job-card
fields for its IDs. The client preserves server rank order and independently
rejects inactive, unapproved, closed, below-threshold and stale entries. Freshness
is five minutes, with a maximum tolerated cache-row age of 15 minutes. Reads
coalesce across badges/screens and have bounded timeouts; errors preserve only
still-valid data. Background refresh does not repeatedly flash loading states.

Qualifying jobs show the compact pink flame badge **Trending · Apply activity**.
No application totals, applicant identities or invented popularity are displayed.
The shared JobMetadata supplies the badge to Home, Jobs, Saved and Discover;
job detail has the same badge. Existing Jobs cards were extracted unchanged into
JobCard and reused for the Hot section/list rather than creating a second design.

At least three qualifying jobs are required for Home's **Hot right now** section.
It is appended after existing Home content so its arrival does not move prior
sections, hero content, ads, saved controls or personalized recommendations.
**See all** opens `/hot-jobs`, using existing cards, job-detail routes and navigation
behaviour. Empty/error results omit the optional Home section and never block
Home. The list has honest separate empty/error states and a working retry/browse.
Relevance and existing filters are not replaced by popularity.

Real Apply taps record only job_id, stable per-device anonymous_id, and user_id
when signed in. Inserts use returning=minimal with no .select(). Device IDs are
persisted; short repeated taps are coalesced/throttled. Backend deduplication is
still authoritative across sessions/devices. Storage/network failures and
uncertain insert outcomes never block Apply or trigger automatic retries.
Tracking describes the tap/Easy Apply start even if later eligibility checks or
employer-site steps do not produce a completed application.

## Enable after approval, not before

1. Owner approves the review file; Lovable audits/applies it through the managed
   backend. Do not use supabase link/db push from this repository.
2. Let the existing cron refresh the cache and verify deduplicated counts,
   threshold and active/SAST date exclusions with authorised backend access.
3. Set the public app setting EXPO_PUBLIC_HOT_JOBS_VERIFIED=true in the intended
   environment and rebuild/restart Metro with --clear. Expo can retain an old
   inlined environment value without a cache clear.
4. Verify the installed Android app and website against the refreshed cache.

## Verification

- Home browser checks: two exact colours, complete final y/ink allowance, same
  font/baseline/no gap, real loaded font files, narrow/desktop/larger wordmark,
  existing logos, cached refresh and error states.
- Navigation unit/source-render checks cover 280–768px geometry, up to 3x text,
  whole labels versus consistent icons, accessibility labels and selection marks.
- Hot models cover rank order, minimum activity, closed/approval filters, SAST
  boundary, stale cache, coalescing, empty/failure responses, stable click IDs,
  minimal inserts and no automatic uncertain retries. SQL checks verify the
  review file and a distinct-actor specification model, not database execution.
- A separately test-enabled web export uses entirely intercepted responses to
  exercise delayed/empty/failed popularity, working See all/detail routes, accurate
  badges and Apply-click recording. The normal export remains Hot-off.
- A live **read-only** public audit confirmed 20 cache/job rows, of which 13 were
  currently open and seven were unavailable/closed. No raw click/application
  rows or identities were read, and no live activity was inserted.

Final check counts and device limitations are recorded below.

### Results and limits

**306 browser checks passed**: 63 Home/wordmark/logo checks, 223 existing UI checks
and 20 test-enabled Hot checks. All browser backend data and mutations were
intercepted fixtures. **60 unit/model checks passed**: 14 brand/Hot, 5 navigation,
9 Expo Go compatibility and 32 recommendations. TypeScript and focused lint
passed. Full-project lint retains nine existing errors and 16 warnings in
retained code; no new findings were introduced. Web and Android JavaScript
exports succeeded, including a cleared-cache default-off build. No APK was built
or tested on a physical Android device.

The owner returned the migration marked audited by Lovable. Owner approval,
application and a refreshed deduplicated cache have not been confirmed. The
feature therefore remains off. No SQL was executed here. Live server aggregation
correctness/performance, cron behaviour, installed-device accessibility font
scaling, native touch/keyboard behaviour and actual cross-client ranking after
application remain unverified. The models specify deduplication/threshold rules;
they are not PostgreSQL execution tests. No live Apply-click or application
records were created or changed by verification.

### Changed file groups

- Brand: `src/components/brand-wordmark.tsx`, `src/lib/brand-layout.ts`,
  `src/app/(tabs)/index.tsx`.
- Navigation: `src/components/navigation/circular-navigation.tsx`,
  `src/lib/radial-layout.ts`, `src/lib/auth-destination.ts`.
- Popularity/recording: `src/lib/hot-jobs/{config,service,api,click-service,clicks}.ts`,
  `src/hooks/use-hot-jobs.ts`.
- Reused cards and Hot surfaces: `src/components/ui/{job-card,job-metadata,hot-job-badge}.tsx`,
  `src/components/home/hot-jobs.tsx`, `src/app/hot-jobs.tsx`,
  `src/app/(tabs)/jobs.tsx`, `src/app/jobs/[id].tsx`.
- Verification: `scripts/test-hot-jobs.cjs`, `scripts/verify-hot-jobs.cjs`,
  `scripts/test-navigation.cjs`, `scripts/verify-home-polish.cjs`,
  `scripts/verify-ui.cjs`, and the package.json test script. The profile progress
  test now targets its own progressbar rather than the independent hero loader.
- The single review migration above and this document. No assets, dependencies,
  ad settings, recommendation ranking or unrelated backend schema were changed.

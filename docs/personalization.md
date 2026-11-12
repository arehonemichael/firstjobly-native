# Explainable recommendations

## Deployment and source of truth

This is an on-device feature using the existing Lovable Cloud Data API through
`src/lib/supabase.ts`. It needs only the app's existing public URL and publishable
key; signed-in reads and writes use the Supabase client's user session and RLS.
No service credential, new endpoint, SQL migration, new index, Edge Function,
Supabase CLI linking, or database deployment is required. The earlier unshipped
backend/migration draft was removed.

Contracts were checked against the owner's read-only live schema/API audit dated
12 November 2026. There is no live jobs-for-you HTTP endpoint. Do not call website
internal functions or scheduler routes. Existing community/GraduateRoom routes
are untouched. Any future privileged site API must use the apex
`https://firstjobly.co.za`, since www redirects drop Authorization.

## Existing data reused

- `profiles`: preferred_categories, preferred_job_types, preferred_province,
  preferred_city, province, skills, field_of_study, highest_qualification. Reads
  are explicitly scoped by id. Only the four existing preference columns are
  updated. No invented interests/settings column is sent to the backend.
- `saved_jobs`: own job_id + created_at, newest 100.
- `applications`: own job_id/status/is_draft/applied_at. Confirmed statuses are
  submitted/viewed/shortlisted/interview/offer/rejected/withdrawn. Drafts and
  external-link clicks are not submissions. A separate candidate-id query
  checks all candidate applications, so old confirmed applications cannot slip
  through the bounded recent behavior history.
- `work_experience`: own dates/currently_working, at most 300. Overlapping date
  intervals are merged. Missing/incomplete dates mean unknown, not zero years.
  A full bounded result is treated as incomplete for negative eligibility.
- `saved_searches`: own keyword/filters/notify, at most 300 notified searches,
  with existing RLS. No new search/history tables.
- `job_views`: own job_id/viewed_at, newest 100. This feature does not invent a
  write contract for this table. New app opens are tracked locally.
- `jobs`: only audited public fields; never selects rejection_reason or
  submitted_via_token. Candidate reads explicitly require approved + active +
  not past closing day in Africa/Johannesburg. Other screens retain their
  existing behavior for closed jobs. Reference jobs use approved-job RLS.

Names, email, phone, photo, birth date, address, and protected attributes are not
ranking inputs. Province is used only as the email digest's documented location
fallback. Field of study is fetched for compatibility but not scored in this
version; there is no trustworthy job taxonomy for it.

## Rules and explanations

`src/lib/recommendations/config.ts` defines weights and bounds;
`engine.ts` is the pure deterministic implementation. Version:
`firstjobly-device-rules-2`. Contributions and evidence are available in ranking
objects for debugging; the UI never presents a probability/percentage of success.

The primary matches follow the job-alert digest:

1. Notified saved search: every keyword word appears in title/company, with any
   province/category/minimum salary filters satisfied. Weight 200.
2. Stated category or employment type, within the stated province when present.
   Location falls back from preferred_province to profile province, as in alerts.
3. Province alone when no type/category is stated.
4. With no meaningful signal, show honestly labeled latest opportunities.

Category enums are matched first. Job/profile free text normalizes case, spaces,
hyphens and known plural aliases; it does not guess what unfamiliar prose means.
Other relevance weights: category 36, province 28, city 12, employment type 24,
selected experience 16, explicitly remote 24, exact listed skill 6 (cap 24), listed
education match 12. Freshness contributes at most 6 over 30 days and completeness
at most 3. Neither establishes eligibility. Exact skill phrases match title and
requirements; arbitrary biography text is not used to infer interests.

Behavior totals at most 10 points: current saves cap 3, confirmed applications
cap 3, local more-like feedback cap 6, opens/starts together cap 2, all within the
aggregate cap. Signals are deduplicated, decay with a 30-day half-life, and are
ignored after 90 days. Unsaving is not a negative category signal. Only opened
and application_started local events influence the view term; saved/submitted
events do not replace the actual saved/application records.

Up to roughly one in five positions can be a clearly explained discovery job
outside the strongest type preference, while still matching another real signal
and respecting province, manual filters and all explicit exclusions. This is an
intentional app extension to the digest's primary matches, not a claim that the
email sends these discovery items. Employer/category/source quotas are best
effort on each 20-row page and relax when inventory cannot satisfy them. Rules
never relax exclusions or mandatory requirement checks to fill a feed.

Deduplication uses id, slug, and normalized company/title/location/type. Sorting
uses score, posted_at and id, then deterministic diversity ordering before page
slicing. Explicit mandatory qualification/experience labels can reject a known
mismatch; ordinary listing education is advisory. Unrecognized requirements or
missing profile data remain unknown. Easy Apply's existing document/completion
checks and live submission triggers are unchanged. Every explanation asks the
user to review the listing; relevance never guarantees eligibility or selection.

## Sync boundaries and user controls

Home and `/discover` use the same service. `/jobs` keeps manual search and links
to discovery. `/preferences` is optional and reachable from Home/discovery/Profile.
Why-this-job explanations come directly from real ranking contributions.

Categories, employment types, one preferred province and one preferred city save
to existing profile columns and sync with the website. Extra experience/remote/
exclusion/learning controls, more-like feedback and dismissals are explicitly
**device-only**, stored in AsyncStorage under account + ranking version. They
survive app restarts on that device; they do not claim cross-device sync.
Dismissals can be undone during the current feed visit. Reset clears local
inferred activity and more-like feedback, retains dismissals and explicit
preferences, and sets a cutoff so preserved older saves/applications/views do
not immediately recreate the old learning. It never deletes saved jobs,
applications, work history or profile preferences. Disabling learning stops local
activity recording and skips remote behavioral-history reads.

Device event recording is capped at 300 events, at most one job/kind/day; expired
events are pruned on local reads/writes. Existing remote job_views retention is
not modified. Device dismissals remain until undone or app data is cleared.
Profile-write failures show the live maintenance message when returned; no
server trigger/policy is bypassed.

## Cache, failures and known limits

Candidate selection uses the newest 300 open approved jobs, with category and
province filters applied remotely. Keyword/city filtering runs within this bound.
Reference reads and each private query are also bounded to at most 300; current
history limits are listed above. Consequently this is not a whole-catalog search;
profiles whose relevant jobs fall outside the newest candidate window may have
sparse results. The existing job-search screen remains available.

Memory snapshots last three minutes and are isolated by user, ranking version,
filters, local revision and Johannesburg date. There are at most 12 cached
snapshots. Concurrent identical reads share a pending request. Profile edits,
local feedback/reset, and confirmed save/application activity invalidate caches.
Cursors point into immutable snapshots and are rejected after expiry, invalidation,
filter change or account change. Late responses cannot populate another user's
feed. Signed-out feeds never read private tables.

If ranking/learning reads fail, the hook tries an honestly labeled latest feed
that still loads the signed-in user's dismissals, confirmed applications and
requirement inputs. If these cannot be checked, it shows retry/search controls
instead of silently ignoring exclusions. No stale data is shown across accounts.
Home's bundled photo/message session hero, styling and navigation are preserved.

Cross-device dismissal/learning sync and shared server-side ranking require a
future owner-approved Lovable contract. They are not implemented by assuming a
schema or adding an unaudited migration. Production private RLS is documented by
the supplied audit; automated tests use isolated fixtures and do not prove the
live policies independently.

## Verification

- `npm run test:recommendations`: ranking and real Supabase query-client tests
  against an isolated PostgREST fixture, including account boundaries, old
  applications, sparse/unknown inputs, decay/reset, cursor isolation and failures.
- `npm run test:home-hero` and `npm run test:navigation`: existing regression tests.
- `npm run typecheck`; ESLint on the new recommendation modules/routes.
- Expo web and Android JavaScript exports (not an installed Android APK test).
- Against an exported web build: `APP_URL=http://localhost:8782 node
scripts/personalization/verify-browser.cjs`, plus existing `verify-ui.cjs` and
  `verify-home-hero.cjs`. All account/data requests are intercepted; no production
  writes. They exercise real client ranking, preference writes to fixture profiles,
  feedback persistence, explanations, pagination, maintenance and preserved hero.

Verified in this workspace: 29 recommendation unit/query-client checks, 16 new
personalization browser checks, 52 existing Home hero browser checks, 211 existing
UI browser checks, 9 hero unit checks and 5 navigation checks passed. TypeScript
and focused ESLint passed. Full-repository ESLint retains the baseline 13 errors
and 20 warnings. Web and Android JavaScript exports passed. A read-only anonymous
live Data API feed also passed using only the existing public app settings;
private-account behavior and writes were exercised only against isolated fixtures.

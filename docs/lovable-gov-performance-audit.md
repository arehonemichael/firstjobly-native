# Copy/paste into Lovable: authenticated Gov Jobs latency audit

Audit the live backend read-only first. Do not deploy changes, run data refresh/imports, modify production data, weaken RLS, add guessed columns/indexes or change API contracts. Send findings and a concrete proposed patch for owner approval. If schema changes are necessary, first provide the current schema/index/function definitions; prepare one SQL migration for review only. Do not apply it.

The Expo app uses the live website's existing API:

- `GET https://firstjobly.co.za/api/app/circular-jobs?page=1&page_size=20`
- Pagination: same filters + `page=2`, `page_size=20`, then further pages.
- Optional supported filters: `search`, `province`, `closing_soon=1`, `qualification`, `batch_id`, `sort=closing|newest`. Omitted controls are omitted entirely. Unfiltered first load sends no default sort/filter. Qualification values: grade_12, certificate, diploma, degree.
- Independent metadata: `GET /api/app/circular-batches/latest`.
- Full job detail: `GET /api/app/circular-jobs/<id>` only when opening a detail.
- Existing auth: the user's session JWT in `Authorization: Bearer ...` AND `x-fj-token`; exact apex host, no redirect, no token in URL. Do not request or publish a token in the audit.

List envelope must remain `{items, page, page_size, total, has_more}`. Preserve existing access rules, error behavior, filters, eligible-job semantics and website/mobile compatibility. Do not hide valid jobs for speed or fetch all rows to paginate in JavaScript.

Existing list summary fields in the app contract:
`id, batch_id, post_number, post_title, department, reference_number, centre, province, salary_text, salary_min, salary_max, salary_level, job_type, posts_count, closing_date, min_qualification, published_at, closes_in_days, is_closing_soon, is_expired, circular:{id,number,year,issue_date}, saved, application_stage`.
Nullable metadata is legitimate. Keep full `requirements`, `duties`, `enquiries`, apply instructions, matching/prefill and other long detail data on the detail endpoint unless another existing consumer demonstrably requires it. Audit consumers before removing any response field.

Evidence available from app-side inspection/checks:

- First page already requests 20; virtualized list; no per-job detail/network fan-out, no ad or image gate, metadata independent. One list GET and one shared latest-metadata GET per controlled initial visit; existing in-flight GET dedup; one refresh retry only for 401, not blanket retries.
- Controlled Chromium Expo-development fixture, NOT production: 3 before/after samples, 120ms configured API delay, one summary row, 404 UTF-8 payload bytes. Median tab→shell 201→127ms; tab→usable row 312→315ms (no meaningful gain). After: 138–140ms request/body/parse total, parsing 0–1ms, transform 0–0.1ms, first frame proxy 12–24ms after hook receipt.
- No authenticated production request timing or production row count/payload has been measured here. Do not treat these fixture values as live endpoint timings or evidence that the server is slow. The owner can supply opt-in device diagnostic lines; collect equivalent authenticated timings yourself safely.
- Fixed client cache-expiry blanking and paginated return/race behavior. This does not establish a fix for a slow server.

Please return:

1. Identify the actual route handler, middleware and database query/RPC. Record read-only authenticated first-page and representative filtered/page-2 timings, preferably several samples with p50/p95, payload bytes and rows. Distinguish auth/token validation, upstream/network, database/count, serialization and total. Do not expose identity/session/private row data.
2. Inspect whether pagination/filtering/order happen in SQL before transfer. Confirm page-size bounds and deterministic ordering with an existing stable unique tie-breaker. Explain offset/cursor behavior without changing today's page-based contract.
3. Show the relevant current schema, RLS policies, indexes and sanitized query plan. Check available read-only EXPLAIN first; use EXPLAIN ANALYZE only if safe for this SELECT and within production resource constraints. Investigate sort/filter indexes from the actual predicates/order, joins for saved/application state, sequential or per-row calls, and expensive exact-count work. Do not propose an index from guessed table/column names.
4. Compare summary projection with actual consumers. Check oversized descriptions, enrichment, N+1 lookups, repeated counts, response compression and safe cache scope/invalidation. Never share per-user saved/application fields through a public cache.
5. Verify no live scraping/importing, full PDF parsing, bulk refresh or materialization is performed synchronously during the member list request. Identify any such dependency precisely.
6. Separate measured bottlenecks from hypotheses, then propose the smallest compatible fix and verification plan for both website and mobile. Keep ads and authentication behavior unchanged. Return any deployment/DDL separately for owner approval; do not apply it.

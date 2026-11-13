# Gov jobs empty-feed audit and fix

13 November 2026 · Branch `fix/gov-jobs-empty` · Parent `65daea6` (`feat/government-circular-jobs`).

The owner reports authenticated live responses of HTTP 200, Circular 41 of 2026 and 128 open jobs. This change does not alter that API, the backend, website, existing Jobs tab, Easy Apply, AdMob or GraduateRoom. It introduces no new native dependencies.

## Step 1: diagnostics and limits

Opt-in development diagnostics were added before changing feed behaviour. The managed workspace has no attached Android device, adb or signed-in owner session. **No real-device/authenticated live 200 or live count is claimed.** The owner must collect the final device trace using the commands below; session credentials should never be pasted into chat.

Each actual HTTP attempt logs the full endpoint URL, method/attempt, Authorization/x-fj-token presence booleans, token length, HTTP status and the first 300 response characters. It also logs pagination/count metadata when present, because `total` normally appears after the first 300 characters. Missing sessions and network failures get explicit diagnostics. Current tokens, JWTs, token JSON fields and credential query parameters are redacted before truncation. Diagnostics require **both** `__DEV__` and `EXPO_PUBLIC_CIRCULAR_DEBUG=true`; release builds cannot enable them through that flag. Logging failures cannot interrupt requests.

## Step 2: audit findings in the requested order

| Check | Finding and action |
|---|---|
| Base URL | Already exactly `https://firstjobly.co.za/api/app`. Both token headers and redirect rejection were already present; preserved. |
| Current token | Already calls the live session on each request, refreshes once on 401 and checks the owner before accepting a response; preserved. No startup token snapshot is reused. |
| Error versus empty | HTTP/network errors already had explicit error UI. However, an incompatible **200** JSON response could become `items ?? []` and masquerade as an empty feed. List/latest/detail envelopes now validate before reaching the cache/UI. Plain-text 403/1010 also gets a recoverable blocked-request error. No User-Agent override or spoofing is added. |
| Parsing/nulls | The correct `items`, pagination and `batch` fields were already used. `centre` and `salary_text` were incorrectly typed as non-null despite existing runtime fallbacks. Types are corrected and missing locations now say “Location not stated”; missing salary says “Salary not stated”. Nullable metadata never removes a job. |
| Defaults | Removed the implicit `sort=closing`, even though the API supports it. The initial list URL is now exactly `/circular-jobs?page=1&page_size=20`. Empty filters remain omitted. Home clears a previous notification batch and remounts the feed controls with default values. A Clear filters action restores the default list. |
| Extra client filtering | **Confirmed defect introduced in the prior implementation:** a broad regex rejected every returned title containing `director`, `manager`, `specialist`, etc. For example, it wrongly rejects the fixture’s entry-level **Clerk: Office of the Director**. It also gated Detail and Apply. Removed all three eligibility gates; the backend is the authority. Only explicit user-selected internship filtering, identity deduplication and the previously requested removal of saved items confirmed withdrawn by a 404 remain. No province/date/salary/entry-level filter is added on the client. |
| Dates | No local closing-date eligibility filter existed. Display remains in SAST and expiry/urgency uses the supplied server flags. A regression fixture deliberately disagrees with the device date to prove the row is not locally rejected. |
| Cache | An empty result could hide newly approved jobs for five minutes. Empty item arrays and `batch:null` are no longer stored or reused; replacing a non-empty entry with empty data invalidates it. Successful non-empty data retains the five-minute owner-scoped cache. HTTP requests use `cache: no-store` so the application cache remains authoritative. A fresh Metro reload clears earlier in-memory caches. |
| Wiring | Gov jobs and the Home card already used real circular endpoints, not fixture data. Kept those routes and added the year to the Home wording: “Circular 41 of 2026 · …”. A Home entry also clears stale Gov controls/batch parameters; these reset parameters are never sent to the API. |

These are confirmed code defects and local reproductions. Without the actual phone trace, the exact combination responsible for that phone’s empty screen is **not yet established**. The removed filter was not an authorised substitute for the backend’s entry-level checks.

## Step 3: verification

The automated browser fixture uses exactly 128 fictional API rows, with real twenty-row pagination. It is isolated from all live auth/API writes. It checks seven pages, a server-approved title that the old regex rejects, nullable salary/location, Detail and Apply, Home count/year, stale notification/search resets, fresh PDF URL retrieval, empty-cache recovery, and offline/malformed/403/429/500 states with Retry instead of “no jobs”. The browser helper uses the actual DOM scroll offset; React Native Web overrides `scrollTo` with a different argument order, so calling it as DOM `(x, y)` did not test vertical scrolling correctly.

The final verification results and an actual **isolated-fixture** diagnostic follow. This is not a phone or authenticated live-backend log.

- Typecheck and focused lint pass.
- **195 unit/regression tests pass**, including the existing ads, startup, navigation, Home and Community coverage; 38 are circular tests.
- **147 circular browser checks pass**, including all seven pages of the 128-row fixture and network/error cases. **120 Home/header/login browser checks pass** at 360/390/560/768px.
- Android production JS/assets export passes (not a native APK/device test).
- Full lint retains the pre-existing **9 errors / 16 warnings**. Expo Doctor passes **20/21** checks; the remaining issue is the pre-existing **21 package-version mismatches**. No packages were changed.

Actual isolated-fixture log (no live credentials or real jobs):

```json
{"url":"https://firstjobly.co.za/api/app/circular-jobs?page=1&page_size=20","method":"GET","attempt":1,"authorization":true,"xFjToken":true,"tokenLength":113,"status":200,"bodyPreview":"{\"items\":[{\"id\":\"fixture-1\",\"batch_id\":\"batch-41\",\"post_number\":\"41/01\",\"post_title\":\"CLERK: OFFICE OF THE DIRECTOR\",\"department\":\"Department of Health\",\"reference_number\":\"HEALTH/2026/41\",\"centre\":null,\"province\":null,\"salary_text\":null,\"salary_min\":216417,\"salary_max\":216417,\"salary_level\":\"5\",\"jo","total":128,"itemCount":20,"page":1,"hasMore":true}
```

Device checks still needed: signed-in live list/count and multiple pages, detail, Home metadata, PDF save/viewer and offline retry. The existing native PDF adapter has mocked save/viewer tests; that is not an on-device PDF confirmation.

## Get the real device trace (PowerShell)

Keep any local edits before switching branches; commit/stash them if Git blocks the switch.

```powershell
git fetch origin
git switch fix/gov-jobs-empty
git pull --ff-only
npm ci
$env:EXPO_PUBLIC_CIRCULAR_DEBUG = "true"
npx expo start --dev-client -c
```

Open the development build on Android, sign in normally and open Gov jobs. Copy the `[FirstJobly circular]` lines from Metro. They must show the actual URL/status and count from that phone. The logger deliberately never prints the token. If using logcat in a second PowerShell terminal:

```powershell
adb logcat -v time | Select-String "FirstJobly circular"
```

If the device still has an older binary without the three native modules introduced by the parent feature, rebuild that development client with `npx expo run:android`. This fix itself adds no native modules. Do not use a Supabase access token or database password for deployment, and do not change the server.

After collecting logs, stop Metro, remove the flag and restart:

```powershell
Remove-Item Env:EXPO_PUBLIC_CIRCULAR_DEBUG
npx expo start --dev-client -c
```

## Files changed

- `docs/government-circular-jobs/README.md`
- `docs/government-circular-jobs/empty-feed-audit.md`
- `scripts/test-circular.cjs`
- `scripts/verify-circular.cjs`
- `src/app/(tabs)/circular-jobs.tsx`
- `src/app/(tabs)/index.tsx`
- `src/app/circular-jobs/[id].tsx`
- `src/app/circular-jobs/apply.tsx`
- `src/components/circular/card.tsx`
- `src/components/circular/feed.tsx`
- `src/components/circular/latest-card.tsx`
- `src/hooks/use-circular.ts`
- `src/lib/circular/client.ts`
- `src/lib/circular/contract.ts`
- `src/lib/circular/diagnostics.ts`
- `src/lib/circular/response.ts`
- `src/lib/circular/state.ts`
- `src/lib/circular/transport.ts`

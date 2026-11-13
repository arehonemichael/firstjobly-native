# Government circular jobs — mobile integration

Branch: `feat/government-circular-jobs`, based on `ads-revenue-fix` (`743aef7`). Main, Lovable, the database, the website and existing endpoint implementations are unchanged.

## Navigation inventory and resulting layout

The inventory reported before implementation had seven tabs: Home, Jobs, Saved, Applied, Tools, Community and Profile. Additional routes were job detail/Easy Apply, Discover, Hot jobs, Preferences, CV Maker, Z83, Community post/composer, authentication (including sign-up/password reset), and legacy GraduateRoom redirects. Home also linked to search, Community, profile/setup, saved/applied jobs, discovery/preferences, Hot jobs and four job categories. Profile includes documents and work-experience editors. There were no separate native Career Hub, notification-settings, Settings or Help screens.

The visible tabs are now **Home · Jobs · Gov jobs · Saved · More**. All five labels remain visible at 360dp. More provides a three-column sheet containing CV Maker, Z83, Community, Career Hub (the existing website), Applications, Profile, Notifications, Settings, Help, Career tools, Discover, Job preferences and Hot jobs. The original routes and GraduateRoom aliases remain intact. More has its own `/more` route, so the existing Home-only app-open ad guard does not mistake an open menu for Home.

Home retains its shortcuts and recommendation/ad placements, adds a live-metadata government-jobs card, and routes its Government category to Gov jobs. Saved has Jobs/Gov jobs segments; the original normal-job query, mutation and banner implementation is retained in `components/saved/normal-jobs.tsx`.

## Contract and behaviour

- Only the supplied `/api/app/circular-jobs`, `/circular-jobs/saved`, job detail/save/apply-intent, `/circular-batches/latest` and `/circular-alerts` contracts are used. No `circular_*` tables are accessed directly.
- Requests use the exact apex host and the signed-in user's token in **both** `Authorization` and `x-fj-token`. A 401 refreshes once. A 429 blocks requests by that owner for 60 seconds, with disabled/countdown retry UI. Unknown network failures do not automatically replay mutations. Requests have a 20-second fetch/body timeout.
- Owner-scoped in-memory query cache expires after five minutes and clears on account changes/sign-out. Blurred screens do not subscribe to mutation refreshes. Pagination remains tied to its original first-page snapshot; refreshes cannot append old pages to new results.
- Search debounces 300ms; cleared controls are omitted from query strings. Supported province, closing-soon and qualification filters go to the server. Internships are filtered by the returned `job_type`, with further pages available even when a page has no matches. No unsupported job-type query is sent.
- Only API-returned jobs are displayed. A defensive title/experience guard also rejects clearly senior roles or details requiring more than three years. No senior-role filters are added.
- Dates use SAST. Salary wording uses “per year”. Closing-soon covers the API's seven days, but pink urgency is restricted to today/tomorrow/within two days. “Applied” requires `sent`, never `started`.
- Every official-PDF tap fetches a fresh latest-batch response. Android saves via the existing Downloads/SAF utility, preserves a response filename when provided (otherwise a circular-number/year filename), and launches a PDF viewer with URI read permission. Missing viewer/save permission/download failures have recoverable messages. Web provides a browser PDF link/download fallback.
- The per-user new-batch marker is persisted as a batch ID only. Opening Gov jobs marks it seen. A batch notification refreshes metadata and keeps the notified batch filter. Store changes use React external-store subscriptions so updates work with the enabled React Compiler.
- Detail includes grouped requirements, labelled qualification-match states using existing semantic colours, profile section shortcuts, collapsible duties, a document checklist, enquiries, source links, reference copy and sticky Save/Apply. There is no invented driver's-licence profile field: the user checks it in the application flow. A withdrawn saved job is excluded locally for that app session, and a best-effort DELETE removes the server save.

## Applying and privacy

Choose an advertised application method, then record `started`. The application URL contains only an opaque in-memory workflow key. The existing Z83 filler receives allowlisted post/profile fields, uses no persistent draft in circular mode, and displays its existing remaining/Section B fields. It clears its form state after PDF generation and retains only a temporary PDF for handoff. The normal CV/Z83 rewarded-download gates remain in place.

Choose a CV PDF (or open existing CV Maker, return, then choose its downloaded PDF). Email attaches **both** Z83 and CV through the native composer. Online opens the supplied employer URL; post/hand delivery show a copyable address. Z83 can also be explicitly saved to Downloads for uploading/printing. Temporary application copies are cleaned on finish, cancellation/unmount or account changes; intentionally saved Downloads remain the user's documents. Cleanup is best-effort; abrupt OS termination can leave cache files until OS cache cleanup. Raw Section B answers are never sent to the API, logged, put in route parameters or written to AsyncStorage.

Opening or returning from email/the employer site does **not** mark an application sent. “Did you send your application?” requires an explicit Yes before the separate `sent` request. Failure preserves documents for retry. Downloading/generating documents is not submission to the department.

## Notifications and limits

New-circular and circular-closing notification payloads route to the Gov tab/job; existing Community notification routing and Expo Go SDK boundaries remain. The notifications screen reads/writes the audited circular-alert preference and provides an explicit device-permission action.

**Delivery is not provisioned by this change.** The supplied audit says delivery uses existing FCM device registration/preferences, is initially off, and Firebase credentials were not configured in the audited environment. No device-token write contract was supplied; the app does not invent a `user_push_tokens` schema or register against an assumed endpoint. Live delivery therefore still needs verification with the owner's existing registration/Firebase setup.

## Screenshots

These are the real app at **360 × 900** using isolated, explicitly fictional API/auth responses, not production jobs or personal data:

| Home | Gov jobs | Detail | Apply | More |
|---|---|---|---|---|
| [View](screenshots/home.png) | [View](screenshots/gov-jobs.png) | [View](screenshots/job-detail.png) | [View](screenshots/apply-flow.png) | [View](screenshots/more.png) |

## Verification

- Typecheck passes. The combined unit/regression run passes **187 tests**; the circular browser suite passes **85 checks**.
- Circular unit tests cover both token headers, refresh-once, rate limits, account switches, cache expiry, draft/PDF isolation and cleanup, supplied formats/filter serialization, strict notification links, native PDF save/viewer adapters, and the actual application send/handoff handlers with mocked device ports.
- Existing ad, startup, Expo Go, navigation, Home presentation/hero and Community regression suites are included in the final test run. Circular Z83 handler tests check the preserved reward gate and clearing answers after PDF generation.
- Browser fixture checks cover five complete labels/44dp targets, latest metadata/PDF refresh, pagination, search/clear, saves, detail/checklist/profile destinations, actual Z83 prefill/no Section B persistence, More entries, alerts, withdrawal handling, signed-out access, 429 countdown and slow-request skeletons. No live writes.
- The adapted Home/nav/login browser suite passes 120 checks at 360/390/560/768px, including branding and enlarged text.
- Android production JS/assets export passes; this is not a native APK or on-device test.
- Full lint retains the existing **9 errors / 16 warnings**, including the unchanged normal-saved-jobs finding moved with that component. Expo Doctor passes **20/21** checks; its remaining finding is the existing **21 SDK patch-version mismatches**. They were not bulk-upgraded. The existing missing-iOS-AdMob-ID warning is unchanged; this work targets Android.
- The only live circular probe was an unauthenticated GET returning the documented 401. Authenticated live circular reads, Android PDF viewer/SAF, CV selection, mail attachments, app return and real push delivery still need an owner/device smoke test.

## Pull and test (PowerShell)

```powershell
git fetch origin
git switch feat/government-circular-jobs
git pull --ff-only
npm ci
npm run typecheck
npm run test:circular
npm run test:ads
npx expo run:android
```

Keep local edits before switching branches (commit or stash them if Git reports conflicts). **Rebuild the development client**: clipboard, intent-launcher and mail-composer add native modules. Restarting Metro or clearing its cache alone cannot add these modules to an existing binary. `npx expo run:android` requires the local Android SDK; the existing EAS development profile is an alternative build path.

For browser fixtures, use the existing Playwright/Chromium setup and a running Expo web server, then `APP_URL=http://localhost:8820 node scripts/verify-circular.cjs` (set environment variables using PowerShell syntax on Windows). Device adapters are mocked in unit tests; screenshots do not verify their native behaviour.

## Files changed

- `docs/government-circular-jobs/README.md`
- `docs/government-circular-jobs/screenshots/apply-flow.png`
- `docs/government-circular-jobs/screenshots/gov-jobs.png`
- `docs/government-circular-jobs/screenshots/home.png`
- `docs/government-circular-jobs/screenshots/job-detail.png`
- `docs/government-circular-jobs/screenshots/more.png`
- `package-lock.json`
- `package.json`
- `scripts/test-ads.cjs`
- `scripts/test-circular.cjs`
- `scripts/test-community.cjs`
- `scripts/test-home-presentation.cjs`
- `scripts/test-navigation.cjs`
- `scripts/verify-circular.cjs`
- `scripts/verify-home-nav-login.cjs`
- `src/app/(tabs)/_layout.tsx`
- `src/app/(tabs)/circular-jobs.tsx`
- `src/app/(tabs)/index.tsx`
- `src/app/(tabs)/more.tsx`
- `src/app/(tabs)/profile.tsx`
- `src/app/(tabs)/saved.tsx`
- `src/app/circular-jobs/[id].tsx`
- `src/app/circular-jobs/apply.tsx`
- `src/app/help.tsx`
- `src/app/notifications.tsx`
- `src/app/settings.tsx`
- `src/app/z83.tsx`
- `src/components/circular/card.tsx`
- `src/components/circular/feed.tsx`
- `src/components/circular/latest-card.tsx`
- `src/components/circular/shared.tsx`
- `src/components/home/session-hero.tsx`
- `src/components/saved/normal-jobs.tsx`
- `src/components/ui/icon.tsx`
- `src/constants/theme.ts`
- `src/hooks/use-circular.ts`
- `src/hooks/use-community-notifications.ts`
- `src/lib/auth-destination.ts`
- `src/lib/circular/client.ts`
- `src/lib/circular/contract.ts`
- `src/lib/circular/io.ts`
- `src/lib/circular/io.web.ts`
- `src/lib/circular/links.ts`
- `src/lib/circular/state.ts`
- `src/lib/circular/transport.ts`
- `src/lib/home-presentation.ts`

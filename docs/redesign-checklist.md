# FirstJobly UI redesign

## Audit

Expo SDK 57 / React Native 0.86 / Expo Router. Native StyleSheet styling, Plus
Jakarta Sans, Supabase authentication/data, AsyncStorage drafts, AdMob on native.
Read the repository-required Expo v57 documentation before implementation.

The app serves visitors, signed-in job seekers and verified students/graduates.
Moderation actions appear conditionally in discussions. There are no separate
employer/admin, company profile, inbox, notification, legal or marketing routes.
The home notification icon had no handler. Light colors are hardcoded throughout;
the color-scheme hooks do not constitute an implemented dark theme.

Issues: duplicated palette and controls, inconsistent heading sizes/weights, tiny
metadata, oversized home cards, heavy emphasis across secondary actions, unbounded
desktop forms, mixed icon families, unlabeled icon buttons, pulsing placeholders
without reduced-motion handling, silent home job-load failures.

## Implementation inventory

Each row requires presentation migration and individual layout review. Verification
is recorded separately; a migrated screen is not evidence of authenticated testing.

| Route / surface                                                                          | Presentation | Verification                                      |
| ---------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------- |
| `/` Home, categories, recent jobs, loading/error/empty                                   | Complete     | Route rendered at phone/desktop; see limits below |
| `/jobs` Search, sort, active filters, filter sheet, salary options, pagination           | Complete     | Route rendered at phone/desktop; see limits below |
| `/jobs/[id]` Detail, saved/applied, external apply, Easy Apply note/draft sheet          | Complete     | Route rendered at phone/desktop; see limits below |
| `/saved` Signed-out, loading, empty and saved listings                                   | Complete     | Route rendered at phone/desktop; see limits below |
| `/applications` Signed-out, empty, application status and expandable timeline            | Complete     | Route rendered at phone/desktop; see limits below |
| `/profile` Signed-out, completion, personal/education/preferences, sign-out              | Complete     | Route rendered at phone/desktop; see limits below |
| `/tools` CV/Z83 entry points, privacy note                                               | Complete     | Route rendered at phone/desktop; see limits below |
| `/auth` Sign-in, sign-up, forgotten password, busy/validation                            | Complete     | Route rendered at phone/desktop; see limits below |
| `/cv-maker` Template selection, all repeatable editors, AI assistance, PDF               | Complete     | Route rendered at phone/desktop; see limits below |
| `/z83` All official form sections, choices, signature and PDF                            | Complete     | Route rendered at phone/desktop; see limits below |
| `/graduateroom` Sign-in/verification gates, feed, search, scope/type/institution filters | Complete     | Route rendered at phone/desktop; see limits below |
| `/graduateroom/new` Type, institution picker, anonymous mode, validation                 | Complete     | Route rendered at phone/desktop; see limits below |
| `/graduateroom/verify` Email/code, proof upload, pending/rejected/verified               | Complete     | Route rendered at phone/desktop; see limits below |
| `/graduateroom/[postId]` Discussion, threads/replies, anonymous, delete/report sheet     | Complete     | Route rendered at phone/desktop; see limits below |
| Root stack, responsive tab navigation, launch splash                                     | Complete     | Route rendered at phone/desktop; see limits below |
| Profile experience add/edit/delete, document upload/open/delete                          | Complete     | Editor rendered; native upload/delete unverified  |
| Single/multi/date selectors and institution picker sheets                                | Complete     | Route rendered at phone/desktop; see limits below |
| Shared headers, cards, rows, errors, empty states and skeletons                          | Complete     | Route rendered at phone/desktop; see limits below |
| Native sponsored ad block / placeholder                                                  | Complete     | Native device required                            |

## Design system

Warm off-white canvas, white surfaces, dark green-black text, one rose accent.
Semantic error/success colors retained. Plus Jakarta Sans 400–700, 14px body,
26px page title, 18px section heading; small metadata at least 11px. 4px spacing
unit, 8px controls, 12px sections, 16px sheets. No decorative elevation. Bounded
reading/form widths and top navigation on desktop; bottom tabs on phones.

## Constraints / validation

No Supabase configuration was present at audit time. The owner later supplied
public settings, used only in ignored `.env.local`. A live REST read returned
HTTP 200 and 300 approved active jobs. Chromium rejected the environment proxy
certificate, so the unmodified live response was replayed locally for visual
inspection. Direct authenticated integration was not tested. No test fixtures,
credentials or generated build output are committed.

## Verification results

- `npx tsc --noEmit`: pass. The original checkout failed on nullable Easy Apply
  data and a missing CSS module declaration; both are resolved.
- `npx expo export --platform web --max-workers 2`: pass.
- `npx expo export --platform android --max-workers 2`: pass (Hermes production
  bundle; not an installed application or store build).
- Playwright/Chromium: all 14 routes at 390×1000 and 1440×1000 in visitor and
  simulated member sessions: **56 route checks**, no page errors, blank screens
  or document overflow. Session/data responses were intercepted, not production
  account writes. Verified membership and application statuses came from fixtures.
- Five representative tablet layouts at 768px: job search, profile, CV Maker,
  Z83, discussion composer. Small-height dialog checks at 390×568.
- **14 interaction checks**: search; apply/remove filters; sorting; save/unsave;
  Easy Apply eligibility, cover note and draft submission; registration/password
  visibility; reset-password mode; profile selection sheet; experience editor;
  CV and Z83 local draft persistence; institution search/selection; report sheet
  selection/dismissal. All writes were intercepted.
- Core color contrast: body/canvas 13.98:1; muted/canvas 5.50:1; secondary
  text/canvas 4.76:1; accent/white 6.02:1; selected text/tint 7.22:1; input boundary
  against white 3.15:1. These token checks do not replace a full accessibility audit.
- `npm run lint`: **13 errors, 22 warnings**, all also present on the original
  checkout under the same newly configured Expo ESLint rules. Original baseline:
  31 errors, 36 warnings. No new lint findings by file/rule/severity. Remaining
  errors are 12 `react-hooks/set-state-in-effect` findings and one
  `react-hooks/purity` finding in existing request/state logic. They are not
  suppressed or rewritten as part of a visual redesign.
- `git diff --check`: pass. No existing unit-test runner or test suite is configured.

## Compatibility fixes needed for preview

Native AdMob imports prevented any web build. Platform-specific web entry points
omit native inventory while retaining the same navigation callbacks. Native SDK
paths and ad configuration are preserved. Z83's PDF dependency threw a tslib
interop exception on web; a web-only adapter uses pdf-lib's self-contained browser
distribution, while native keeps the normal package export. Easy Apply now treats
a null saved row as a failed request rather than reading its ID.

## Remaining verification / release blockers

- No physical Android/iOS device or emulator was available: native ads, keyboard
  behavior, document pickers, digital signature WebView, system alerts, sharing and
  actual PDF downloads require device validation.
- Real account sign-in, recovery email delivery, uploads, application delivery and
  employer notifications were not exercised against production.
- Verification pending/rejected/revoked states, moderation-owner delete actions,
  failed uploads and every backend error branch were migrated via shared tokens
  and controls but not individually exercised with a real account.
- Existing iOS AdMob configuration has no `iosAppId`; Expo warns that the native
  SDK will crash on iOS without it. No identifier was invented.
- The 13 pre-existing lint errors remain. This is a reviewable UI implementation,
  not a claim that native release acceptance or production account testing is done.

Unused starter animated-icon components and `.bak` files are outside the live route
and component graph; they were not rewritten. Existing native signature/PDF
features remain in place and require the device checks above.

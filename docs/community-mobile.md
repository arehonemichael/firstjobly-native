# Mobile Community

Implemented against the owner's **FirstJobly Community Forum Technical Audit**,
prepared 11 November 2026 from the live website. The mobile app is Expo/React
Native; these screens use the same service as the website.

## Navigation and identity

The existing six-point navigation arc is retained. The previous 82px item width,
small 11/16 label metrics and 1.3 text-scale cap constrained long labels. Controls
now reserve complete multiline rectangles with 12/20 label metrics and grow
vertically at the actual system text scale. The arc scrolls when required. Footer
controls participate in layout; desktop tabs wrap before compressing their labels.

Semantic `NavigationColors` reference the existing audited palette: primary
`#E1225F`, soft `#FDEEF3`, pressed `#B0164A`, navy `#061A30`. Selected radial labels
now have dark pink text on soft pink, fixing the old dark-pink-on-navy contrast.
Semibold type, a bordered circle and a check retain non-colour selection cues.

The tab, title and Home shortcut use **Community**, with people/conversation
icons. Plus Jakarta Sans, the FirstJobly logo, Home hero assets and other app
features are retained. Historical **Shared from GraduateRoom** remains on copied
posts. Backend identifiers and the unused legacy client are not blindly renamed.

## Shared API and session safety

`src/lib/community/transport.ts` sends only POST requests to exactly
`https://firstjobly.co.za/api/community`. User tokens appear only in the
Authorization header; redirects are rejected. No Community tables or service
credentials are used. No database changes or data copying were performed.

Near-expiry sessions refresh before sending. Explicit AUTH_REQUIRED/401 responses
refresh once and retry; a second rejection shows a sign-in action preserving the
current destination. Concurrent refreshes share one promise. Network failures,
timeouts, malformed responses and 5xx results never automatically replay a
mutation. The UI preserves text and tells the member to check the discussion or
My posts before manually trying again. Friendly server errors are retained.
Retry-After blocks further attempts to the same action until the stated deadline,
without blocking unrelated reads.

Requests verify owner identity before and after network work. Query generations
reject stale route/filter completions; a mutation version prevents an older read
from overwriting optimistic state and safely refreshes it afterwards. Toggle
locks prevent conflicting repeated taps and roll back only affected fields.

## Connected screens

- Feed: New, Top this week, Saved, My posts, For you (followed members), exact
  audited topics, 300ms search debounce, pinned cards, cursor pagination, honest
  empty/error/loading states and pull-to-refresh.
- Cards: returned names/nicknames, gradient initials from avatarHue, Anonymous/You
  chips, SAST time, topic, title/preview, photos, Helpful/reply counts, Save,
  named-author Follow, Report, and permitted owner edit/soft-delete actions.
- Detail: full post and status banners, threaded replies (three levels: root plus
  two nested reply levels), reply-to context, comment pagination, keyboard-aware
  anonymous composer, personal-info warnings, edit/report/confirmed soft delete.
- Discussion composer: full screen, topic/title/details, counters, link/new-account
  validation, anonymous explanation, JPEG/PNG selection with the existing document
  picker, up to four photos, 5MB/4000px limits, per-user local drafts, explicit
  save-and-close and discard confirmation. Failed submissions retain fields/photos.
  Successful creation opens the server discussion and its actual moderation status.
- Reports: all eight audited reasons, optional 1000-character details, exactly one
  post or comment target, private-review copy and duplicate-safe acknowledgement.

Viewer-state gates reads and writes. Guests sign in; incomplete members receive
the documented setup invitation. Banned members can read/report, with write
controls absent. Every operation still goes through server authorization; UI
controls are not a permission boundary. Staff moderation screens were not present
and are outside this request; server moderation APIs are unchanged.

Anonymous identities are never inferred or looked up. Avatars use only the
returned author label and hue; Community never loads profile photos. The
explanation says moderators can identify the author.

## Private caches, drafts and media

Community query data is memory-only, scoped by authenticated owner and complete
query identity, bounded to 40 entries. Normal refresh freshness is five minutes.
Signed media is discarded/refetched before its one-hour expiry (45-minute cap);
foreground/focus checks and a quiet timer renew content. Appending pages retains
the earliest media age. Failed images trigger at most one automatic renewal per
mounted image; persistent failure becomes a useful placeholder. No guessed image
transformation endpoint is used: the contract provides full signed images only,
so Expo Image downsamples into measured thumbnail frames. Tapping opens a native
full-screen viewer with swipe and explicit previous/next/close controls.

Native drafts, including local photo data, live in the app's private documents
folder to avoid AsyncStorage's small per-entry limit. Web drafts use AsyncStorage;
quota/storage errors are shown and do not discard the in-memory text. These
payloads contain local selected photos, never persisted signed server URLs.
Serialized writes/cleanup prevent an autosave from resurrecting a signed-out
user's draft. The root registers auth cleanup independently of screen lifetime.
Account changes clear memory caches and local drafts; reads and writes reject
old owners. Drafts clear on successful publication and deliberate discard.

## Routing and notifications

`/community`, `/community/new` and `/community/<postId>` are native routes.
GraduateRoom feed/new/verify routes redirect to their Community counterparts.
Old post IDs pass through get-post; a different returned post.id replaces the
route with its canonical ID. Authentication return paths include both old/new
routes. Job links and other routes retain existing behaviour.

An optional native notification listener handles the audit's internal Community
`link` when supplied in notification content data. It deduplicates consumed
responses, clears handled last responses, preserves an explicit initial URL and
cleans listeners on teardown. It adds no registration/permission prompt and skips
Expo Go/web native notification initialization. Actual remote notification
payload/delivery must be checked in the installed development build; the audit
specifies stored notification links but not a push-delivery implementation.

## Validation

Run `npm run test:community`, `npm run test:navigation`, `npm run test:expo-go` and
`npm run typecheck`. `scripts/verify-community.cjs` and `scripts/verify-ui.cjs` run
against a served web export, using isolated API/auth responses. Supply APP_URL;
the export server must provide SPA fallback **including URLs with query strings**.

The Community browser fixture rejects undocumented action fields and any legacy
GraduateRoom endpoint request. No production posts, replies, votes, saves,
reports or accounts are created or changed by these tests.

Final check counts and remaining device/live limitations are recorded below.

### Results

- **59 Community browser checks passed**, covering shared-service request shapes,
  all feed scopes, debounce/topics/pagination, optimistic rollback, anonymous
  identities, legacy canonical IDs, replies/depth/edit/delete/report, draft
  restoration/save-and-close/publication cleanup, photo selection/viewer/failure
  bounds, account isolation/sign-out, member/banned/new-account states, explicit
  offline recovery and one session refresh.
- **223 existing UI checks** and **40 startup browser checks** passed.
- **22 Community unit/model checks**, **5 navigation checks** (280–768px,
  1–3x system text geometry) and **9 Expo Go compatibility checks** passed.
  Notification models cover link allowlisting, duplicate consumption, initial job
  URL precedence, cleanup and no SDK evaluation in Expo Go.
- TypeScript and focused lint passed. Full-project lint reports **9 existing
  errors and 17 existing warnings**, all in unrelated/retained files; this change
  removes the obsolete screen findings rather than adding new ones.
- Web and Android **JavaScript exports** succeeded. These are not an APK build or
  physical-device verification.
- The actual live endpoint's unauthenticated viewer-state request returned
  **401 AUTH_REQUIRED**, with the audited friendly sign-in message.

No authorised live test account or attached Android device was available. Actual
website-created/app-created content interoperability, real media processing and
signed-URL renewal, server-side moderation/rate enforcement, native keyboard,
large system text, draft filesystem/device storage failures, remote notification
payload/delivery and Android touch/swipe behaviour remain to verify on a device
with an authorised test account and cleanup. Browser data/mutations were entirely
intercepted fixtures; no live content was modified. Existing backend behaviour,
photo EXIF removal and moderation rules are implemented as the supplied contract
states and are not claimed as independently tested server functionality.

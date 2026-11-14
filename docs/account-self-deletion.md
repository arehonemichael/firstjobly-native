# Member account deletion and iOS release

Branch `feat/account-self-deletion`, based on `release/ios-app-store`. Owner confirmed the Lovable endpoint is published. Original verified API/retention audit: [account-self-deletion-contract.md](account-self-deletion-contract.md).

## App flow

Profile and Settings expose **Delete my account**. The screen lists removed account/profile/documents/applications/saves/Community data and the exact retained report text, anonymous Apply/device activity, deletion/audit email/ID, and contact/employer messages. It discloses no configured server retention period and that externally saved/older untracked PDF copies require manual removal.

The user types their current account email, explicitly acknowledges permanent deletion, and supplies a password or verifies Google again. Passwords stay in component/request memory only and clear after every request/unmount. No password, JWT, code, verifier or API body is logged or persisted by this flow. There is no OTP invention. Server `methods` are hints; server authorization and AMR freshness remain authoritative.

Only `POST https://firstjobly.co.za/api/app/account/delete` is used, with the current user's bearer access token in Authorization. JSON contains only normalized `confirmEmail` and optional password. No arbitrary target/user ID, publishable key bearer, refresh-token bearer, URL tokens, `x-fj-token`, admin-function transport, table mutation or automatic destructive replay.

Exactly `200 {deleted:true}` confirms deletion. Timeout/network loss/malformed success is unknown; 401/403/409/422/429/500 shows the friendly error and does not initiate local cleanup. `Retry-After` blocks early repeat attempts locally. Explicit repeat taps are locked. A deletion POST is never refreshed/replayed automatically, even with `retry_safe:true`.

The confirmed result survives the local sign-out as a parent completion view. Local cleanup errors have a separate **Retry local cleanup** path that never sends another deletion POST.

## Google-only members

Use an isolated auth client and native SHA-256/CSPRNG PKCE (`expo-crypto`). The auth service's standard public PKCE code exchange uses the same wire contract as the installed auth-js implementation. The verifier is closure-only; a fresh token is accepted only if its verified user matches both the original account and the app's current session. It is used only for the explicit deletion request and never replaces the app's current account. Temporary auth sessions are disposed on mismatch/unmount/completion. No implicit access-token URL callback is accepted.

**Owner/Lovable action:** allow `firstjobly://account-delete-callback` as a redirect in the existing shared auth project. Do not replace the backend or add a second OAuth app unnecessarily. The callback route only returns to the active browser verification; arbitrary incoming callback codes are never exchanged automatically. Test Google verification on a native build; web Google verification is not offered by this screen.

## Account and local-data isolation

- Device cleanup starts only after confirmed server deletion. It removes the owner's Community draft, recommendation/device marker keys and tracked app-owned generated PDFs; existing auth listeners clear owner caches on local sign-out.
- Shared legacy CV/Z83 device-draft keys and the local session are cleared only while the original account still owns the session. A newer account's drafts/session/reminder setting are untouched. The user's optional **Also turn off weekly device reminders** is separate; anonymous reminders otherwise continue by design.
- Explicit app sign-in/up/out and confirmed cleanup share an auth-mutation queue, preventing those app actions racing the cleanup check/sign-out. CV and Profile form state remounts on account changes; normal auth requests and destinations are unchanged.
- Cleanup attempts independent stages even after a local file failure, then reports any failure. It does not turn incomplete local cleanup into a second server deletion. If the matching local session disappeared first, shared drafts are left alone with an explicit note.
- New generated PDF cache files and iOS app-document copies are tracked by owner. Confirmed deletion marks that owner in memory so late PDF work is discarded rather than resurrecting their tracked files. iOS copies use an owner-specific subfolder; normal Z83 cache names include account/time to avoid shared-name collisions. External Android Downloads/Files exports are not deleted; app roots, traversal paths and another user's file ledger cannot be purged. Legacy PDFs without ownership metadata cannot safely be attributed and removed without risking another user's files; the screen discloses manual removal (or uninstalling for old app-private data).
- CV/Z83 generation, Apply/email handoff, existing rewarded gates, production ad IDs and anonymous weekly reminder schedules remain unchanged.

## Verification and remaining release checks

- Read-only live endpoint checks: GET 405, OPTIONS 204. No live deletion POST, account creation, member data removal, admin operation or database/schema change was performed.
- Isolated transport tests cover the exact URL/headers/body/4KB cap, wrong ownership/confirmation, password/recent-sign-in payloads, same-user Google proof, status/error handling, no retries, rate limit, timeout, malformed success and rapid taps.
- Cleanup tests cover account switches before/during cleanup, incomplete file cleanup, optional reminders, no-current-session behavior, auth-action serialization and PDF path/ledger isolation. Google tests use native/auth/crypto ports to verify S256, same-account matching, temporary-session disposal and no global session replacement.
- Browser auth/API fixtures cover disclosure/typed confirmation, 500 preserving session/data, explicit retry, confirmed success/local sign-out, offline unknown result, 401 and staff-protected paths. No real credentials or real destructive operations are used.
- Automated results: **334 Node tests**, typecheck and focused lint pass; iOS production and Android JavaScript exports pass. The 120 Home/nav/login browser checks also pass.
- Repository lint retains the existing **8 errors/16 warnings**; no new focused lint findings. Expo Doctor remains **20/21** with the existing 21 SDK patch mismatches.
- Physical iOS/Android OAuth and deletion remain unverified here. The server audit did not test successful real-member deletion or forced partial failures. Before public review, owner-authorized disposable-account tests must confirm removal/retention, partial failure recovery and Google-only reauthentication. Never use the owner's staff account or a real member as a destructive test.

## Build

Native `expo-crypto` was added for secure PKCE, so rebuild rather than relying on Metro/OTA alone. iOS build number is **4**, Android version code **34**. Production mode still uses real iOS ads; use official test inventory while testing interactions.

```powershell
git fetch origin
git switch feat/account-self-deletion
npm ci
npm run typecheck
npm run test:account-deletion
npx eas-cli@latest build --platform ios --profile ios-testflight
```

Confirm callback registration and complete approved on-device/server tests before App Review. If build 4 is uploaded to App Store Connect, increase the number before a subsequent upload. For the public candidate use `--profile ios-production`, then submit that exact completed build ID; upload and Apple review do not constitute an already-completed public deployment.

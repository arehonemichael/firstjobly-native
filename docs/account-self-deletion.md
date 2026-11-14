# Member account deletion by emailed code

Branch `feat/account-deletion-email-code`, based on `fix/resume-home-gov-loading`. The owner supplied the [final published API contract](account-deletion-email-code-contract.md), dated 14 November 2026. The database and backend are managed by Lovable; this mobile branch applies no SQL, provisions no keys and sends no live emails or deletion requests.

## App flow

Profile/Settings → Delete my account → type account email → **Send confirmation code** → enter six digits → acknowledge permanence → **Permanently delete my account**. Both email/password and Google-only members use this in-app code flow. There is no Google verification button, new browser login, Supabase OTP workaround or temporary auth-session replacement. Ordinary sign-in logic is unchanged.

The existing account/retention disclosure and optional device-reminder switch remain. Codes stay in component/request memory, never AsyncStorage or logs, and clear after a deletion attempt/unmount. The form is keyed by account, current email and session_id so another sign-in/account never inherits the code/typed confirmation. Normal token refresh preserves the form. JWT decoding here only isolates local UI; the server authenticates the token and enforces all bindings. The parser uses no Buffer/atob dependency for Hermes compatibility and does not expose decoded claims.

## Exact requests and responses

- Send: `POST https://firstjobly.co.za/api/app/account/delete-code` with body `{}` and current member bearer token only. No recipient field or token in a URL/body. One request per explicit tap, no refresh/replay.
- Delete: `POST https://firstjobly.co.za/api/app/account/delete` with `{confirmEmail,emailCode}`. Confirmation is trimmed/lowercased; the code remains a string so leading zeroes survive. Mixed password/proof/code input is rejected locally; server validation remains authoritative.
- The transport still supports the existing password/recent-auth method for backward compatibility; the current deletion screen uses email codes only. Legacy Google verification modules/callback remain for compatibility but the deletion screen no longer imports or invokes them. No dependency/config cleanup or ad changes were bundled here.
- Send `200 sent:true` displays masked recipient, expiry information and resend countdown. `202 send_uncertain` explicitly says delivery is unconfirmed: check inbox, enter the code if it arrives, and no automatic resend. A network timeout or malformed send success is also treated as uncertain, with a conservative 60-second wait.
- Retry-After/body waits are honoured for 429, 502 send_failed and 503 send_busy. Send and delete waits are separate; a normal resend cooldown does not block entering/deleting with a received code. code_locked blocks both. Timers use absolute deadlines, update on foreground, stop after their deadline and clean up on unmount.
- Friendly server errors are shown, including attempts_left for code_wrong. Expired/used/missing/wrong-session/changed-email challenges or a partial deletion failure prompt a new code. No automatic retry or fallback to recent login is attempted. A missing/unsupported auth session offers normal sign-in with the deletion return destination; the main code flow never asks for Google verification.
- Only exact `200 {deleted:true}` confirms deletion. A timeout, malformed response, 401 or other failure never shows success or starts deletion-specific local cleanup. A 500 may mean partial removal; the code is consumed and a new code is required for another explicit attempt.

## Local cleanup unchanged

Confirmed deletion also removes explicitly remembered Z83 details from the OS secure store; a failure offers local-cleanup retry. Confirmed deletion marks only that owner's generated PDFs as deleted, then uses the existing serialized auth-mutation cleanup. It removes their Community draft, owner caches/markers and tracked app-owned files. Shared CV/Z83 drafts and the local session/reminder setting are cleared only while the original owner still owns the session. Another account's session/private device drafts remain protected if the account changed mid-request. Confirmed completion survives local sign-out. **Retry local cleanup** never sends another deletion POST.

External Downloads/Files copies and older untracked PDFs still need manual removal. Anonymous weekly reminders continue unless the member chooses to disable them. Retained reports/audit/email/anonymous activity are disclosed accurately; no promise of erasing every trace or a fabricated retention period is made.

## Verification

- 400 Node tests pass, including 31 new email-code transport/scope cases: exact requests, leading-zero codes, mixed proofs, 202, mail failure/busy/locks, retries/deadlines, network/body timeout, missing/switching sessions, token refresh, malformed responses, Unicode and native decoding without atob, and code errors without destructive replay/fallback.
- 13 isolated Chromium scenarios pass: email and Google-only UI; send/confirm flow; wrong-code attempts; 202 usable code and manual-only resend countdown; send failure/busy/locked states; refresh versus same-account re-login; partial-failure/new-code retry; confirmed deletion/local cleanup; cleanup-only retry; account switch during deletion; offline, 401 and staff protection. These use intercepted auth/API requests and simulated success, not real emails/deletions.
- Typecheck, focused lint and iOS/Android JS exports pass. Full lint retains the existing 8 errors/16 warnings; dependencies and Expo/native configuration are unchanged. No claim of a clean repository-wide lint run.
- Not verified here: delivery to a real inbox, a correct live code leading to real deletion, physical iOS/Android keyboard/autofill and lifecycle behavior, or a real Google-only member. The supplied backend audit also says correct-code deletion and Google-only sign-in were not live-tested. Owner-authorized disposable-account tests are still required before release; never use the owner's staff account or real members for destructive checks.

## PowerShell

```powershell
git fetch origin
git switch feat/account-deletion-email-code
git pull --ff-only
npm ci
npm run typecheck
npm run test:account-deletion
npx expo start --dev-client -c
```

No new native dependency/configuration is introduced by this change. The previously configured binary versions remain iOS build 4 / Android version code 34; increment as required for the next store upload. EAS signing/submission and real device/live deletion tests were not performed here. Use the appropriate existing EAS profile when making the next signed build; keep real production inventory separate from official-test inventory during testing.

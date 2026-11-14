# FirstJobly app API: delete account with an emailed code

Final contract as built. Status as of 14 Nov 2026:
- The database part is live.
- The two routes are **published and answering on the live site** (14 Nov, about 09:53 UTC).
- Base URL: **https://firstjobly.co.za**. Always use the apex domain, because redirects from www/app drop the `Authorization` header.

## Common rules (both routes)

| Rule | Value |
|---|---|
| Method | `POST` only. `GET` → 405. `OPTIONS` → 204 (CORS `*`; headers `Authorization, Content-Type`) |
| Auth | `Authorization: Bearer <member access token>`, the current session JWT. No token in the URL or body. Never the publishable or service key |
| Query string | Refused: `400 invalid_request` |
| Body | `Content-Type: application/json`, max 4 KB, unknown fields refused |
| Target | Always the account in the token. No field can choose another account or email |
| Errors | `{ "error": "<friendly text for the member>", "code": "<machine code>", ...extras }` |
| Waits | Every code with a wait returns `retry_after_seconds` **and** a `Retry-After` header |
| Caching | `Cache-Control: no-store` |

## 1. Send the code: `POST /api/app/account/delete-code`

**Request:** body `{}`; an empty body is also accepted. Any field, for example `email`, → `400 invalid_request` with `fields`.

**Success 200:**
```json
{ "sent": true, "maskedEmail": "ma****@gmail.com", "expiresInSeconds": 600,
  "expiresAt": "2026-11-14T10:00:18.426385+00:00", "retryAfterSeconds": 60 }
```

**202, email not confirmed.** The send timed out or the mail service didn't answer cleanly. The code **stays valid** in case the email still arrives:
```json
{ "sent": false, "code": "send_uncertain", "error": "...", "maskedEmail": "...",
  "expiresInSeconds": 600, "expiresAt": "...", "retryAfterSeconds": 60 }
```
The app should say "Check your inbox". It must not resend automatically. The member may tap "Send again" after 60 s, which replaces the code.

**Refusals:**
| HTTP | code | When | Extras |
|---|---|---|---|
| 401 | `auth_required` | missing, invalid or expired session | |
| 400 | `invalid_request` | query string, bad JSON, fields in body, over 4 KB | `fields?` |
| 403 | `staff_protected` | admin/moderator account | |
| 403 | `session_unsupported` | token has no valid `session_id`. App: ask the member to sign out and back in | |
| 409 | `manual_deletion_required` | account has no email | |
| 429 | `cooldown` | a code was sent under 60 s ago (double tap) | `retry_after_seconds` |
| 429 | `send_limit` | 5 codes already sent this hour | `retry_after_seconds` |
| 429 | `code_locked` | locked after wrong codes; no new code until it ends | `retry_after_seconds`, `locked_until` |
| 429 | `rate_limited` | request limit (per IP 30/h, per account 10/15 min) | `retry_after_seconds` |
| 502 | `send_failed` | mail service refused. That code is cancelled | `retry_after_seconds: 60` |
| 503 | `send_busy` | code couldn't be stored. **No email was sent** | `retry_after_seconds: 5` |
| 503 | `send_unavailable` | email codes switched off on the server. Use password or recent sign-in | |

**The email:**
- Subject "Confirm your account deletion", sent from FirstJobly <notifications@firstjobly.co.za>, reply-to info@firstjobly.co.za.
- The code is not in the subject.
- It has a plain-text version.
- It tells the member to return to the app, enter the code and tap **Permanently delete my account**. It says the code alone deletes nothing, and to ignore the email if they didn't ask for it.

## 2. Delete: `POST /api/app/account/delete` (updated, backward compatible)

**Request.** `confirmEmail` is required and must equal the account's email (ignoring case and spaces). Add **at most one** proof:
```json
{ "confirmEmail": "me@example.com", "emailCode": "012345" }   // new
{ "confirmEmail": "me@example.com", "password": "..." }        // unchanged
{ "confirmEmail": "me@example.com" }                           // unchanged: needs a sign-in < 10 min old
```
- `emailCode` must be a string of exactly 6 digits. Spaces around it are trimmed; it is otherwise `400 invalid_request`.
- Sending `password` **and** `emailCode` together → `400 invalid_request`.
- When `emailCode` is sent, the code must pass. There is **no fallback** to recent sign-in.
- **Order of checks:**
  1. session
  2. request limit
  3. body
  4. email match
  5. staff check
  6. proof
  7. the code is used up
  8. deletion starts
- **Success:** exactly `200 { "deleted": true }`, only after deletion finished.

**Refusals (existing ones unchanged):**
| HTTP | code | Meaning | Extras |
|---|---|---|---|
| 401 | `auth_required` | session missing or invalid. **Does not mean the account was deleted** | |
| 400 | `invalid_request` | bad body, mixed proofs, bad code format | |
| 422 | `confirmation_mismatch` | typed email isn't the account's | |
| 403 | `staff_protected` | staff account | |
| 409 | `manual_deletion_required` | account has no email | |
| 403 | `reauth_required` / `reauth_failed` | no proof / wrong password | `methods` now includes `"email_code"`, plus `max_age_seconds` |
| 403 | `session_unsupported` | token has no valid `session_id` | |
| 403 | `code_wrong` | wrong code | `attempts_left` (0–4) |
| 403 | `code_expired` | over 10 minutes old | |
| 403 | `code_used` | already used | |
| 403 | `code_missing` | no code requested, or it was cancelled | |
| 403 | `code_session_mismatch` | code was requested on a different sign-in (other device or after signing in again) | |
| 403 | `code_email_changed` | account email changed after sending. That code is cancelled | |
| 429 | `code_locked` | 5 wrong guesses (15 min) or 10 guesses this hour | `retry_after_seconds`, `locked_until?` |
| 429 | `rate_limited` | per IP 20/h, per account 5/15 min | `retry_after_seconds` |
| 409 | `deletion_in_progress` | another delete is running | |
| 500 | `deletion_failed` | stopped partway. Some data may already be gone | `retry_safe: true` |
| 503 | `send_unavailable` | email codes switched off on the server | |

## Code rules (enforced by the database, not the app)
- 6 digits, random, valid for **10 minutes**, usable **once**.
- **One code per account at a time:** a new one cancels the old one immediately.
- **Sending:** 60 s between sends, at most 5 sends per hour, no new code while locked.
- **Guessing:** 5 wrong guesses on one code → 15-minute lock. At most 10 guesses per hour across all codes, so a resend never resets the budget.
- **Bound to:** the account, its current email, the sign-in session that requested it, and the purpose (deletion only).
  - A normal token refresh keeps the same session, so the code still works. Verified live.
  - Signing in again creates a new session, so the code is refused.
- Correct guesses arriving at the same moment: exactly one is accepted.
- Only a keyed scramble of the code is stored.

## How the app should behave
1. **Delete my account screen:** show the account email and the permanent-deletion notice. The member types the email.
2. **"Send confirmation code"** → call delete-code. Show `maskedEmail` and a 60 s countdown before "Send again" is offered.
3. The member enters the code and taps **Permanently delete my account** → call delete with `{confirmEmail, emailCode}`.
4. **Only `200 {"deleted":true}` means deleted.** Only then clear local data and sign out.
5. **Anything else, including a timeout, no response or `401`:** the result is unknown or failed. Don't show success, don't clear private data, and don't retry automatically.
6. **After `500 deletion_failed`:** the code is used up. Offer "Send a new code" to try again; the deletion steps are repeat-safe.
7. **Google-only members:** this replaces the need for a fresh Google sign-in. Password and recent-sign-in flows keep working.
8. **Switching accounts:** a code is bound to the session that requested it. After switching or signing in again, request a new code.

## Tested (14 Nov, against the preview with a disposable test account `delivered+fj-deletion-test-1@resend.dev`)
- **Send route:**
  - 405 for GET, 401 without or with a bad session, 400 for a query string or a body field
  - real email/password sign-in has a `session_id`
  - send → 200 `sent:true`; immediate resend (and an empty body) → 429 `cooldown` with `Retry-After: 60`
  - staff account → 403 `staff_protected`
  - stored code is a 64-character scramble, not the code
- **Delete route:**
  - password and code together → 400; 5-digit code → 400; wrong typed email → 422
  - wrong code → 403 `code_wrong` with 4 attempts left
  - after a token refresh: same session, wrong code → `code_wrong` with 3 left
  - per-account request limit → 429 `rate_limited` with `Retry-After: 900`
- **On the live site after publishing** (same disposable account):
  - 401 without a session
  - send → 200 `sent:true`; double tap → 429 `cooldown`
  - wrong code → `code_wrong` (4 left)
  - code used from a second sign-in → `code_session_mismatch`
  - after the account email was changed → `code_email_changed`, then `code_missing` because the code was cancelled; the test email was restored afterwards
- **Database rules** (lock, guess budget, expiry, reuse, replacement, simultaneous requests, timing edge cases): tested on a private copy of the database, see the review v2 report.
- **Not tested yet:**
  - a correct code, which deletes the account; this needs your separate approval
  - a Google-only sign-in, which can't be created from here
  - the 202/502 email failure paths, which can't be forced against the real mail service

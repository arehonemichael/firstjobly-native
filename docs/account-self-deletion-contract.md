> Publication update: the owner confirmed this endpoint is live on 14 November 2026. Read-only GET/OPTIONS returned 405/204 from the apex endpoint. The supplied audit below is preserved verbatim; its initial preview-only status predates that confirmation. No successful live deletion was tested by this app workspace.

# FirstJobly — member self-deletion API (for the mobile app)

Status: implemented in the Lovable project and checked on the preview server. **Not live until the owner publishes.** After publishing, it is live at the URL below.

## Endpoint

`POST https://firstjobly.co.za/api/app/account/delete`

Use exactly `https://firstjobly.co.za`. The `www.` and `app.` hosts redirect, and the redirect drops the `Authorization` header.

`GET` returns `405`. `OPTIONS` returns `204`.

## Authentication

- Header: `Authorization: Bearer <access_token>`, the member's current session access token. Nothing else is accepted.
- The server checks the token with the auth service and gets the account id and email from it. The account deleted is always the one in the session.
- These all return `401 auth_required`: no header, an expired or invalid token, the publishable key, a refresh token, or a token sent in `x-fj-token` or similar headers.
- Any query string at all, such as `?access_token=`, returns `400 invalid_request`.

## Request body

`Content-Type: application/json`, at most 4 KB.

```json
{ "confirmEmail": "member@example.com", "password": "optional" }
```

- `confirmEmail` is required. It is trimmed and lowercased, and must equal the signed-in account's email. It only confirms the request; it never chooses the account.
- `password` is optional and is the re-authentication proof (see below).
- Any other field (`userId`, `email`, `targetEmail`, `role`, `apikey`, …) returns `400 invalid_request` with `fields: [...]`.
- A member does not need a complete profile or Community access to delete.

## Re-authentication (required)

One of these must hold:

1. **Password.** Send `password`. The server checks it with a normal password sign-in against the session's own email, confirms the returned user id matches, and ends that check's temporary session at once. A wrong password returns `403 reauth_failed`.
2. **Recent sign-in.** Without `password`, the session must have been signed in within the last **600 seconds**. This comes from the session's `amr` timestamp, which the auth service sets when the person actually signs in (password or Google). It is **not** the token's `iat`, so a refreshed token does not count as a fresh sign-in. Google-only accounts (about 1,800 of them, with no password) use this route: run Google sign-in again, then call with the new access token.

When neither holds, the response is `403 reauth_required`, with `methods` and `max_age_seconds: 600`. `methods` includes `"password"` only when the account has an email/password identity. Treat it as a hint.

There is no OTP step. One-time codes for this purpose do not exist in the backend yet.

## Responses

Success, sent only after every required step finished, including removing the sign-in:

```json
HTTP 200
{ "deleted": true }
```

Errors always look like `{ "error": "<safe message to show>", "code": "<code>", ...extra }`, with `Cache-Control: no-store`.

| Status | code | When | Extra |
|---|---|---|---|
| 400 | invalid_request | query string, not JSON, too large, unknown field, missing/invalid confirmEmail, non-text password | `fields` for unknown fields |
| 401 | auth_required | missing/invalid/expired session token | |
| 403 | staff_protected | the account has admin or moderator access (support message given) | |
| 403 | reauth_required | no password and the sign-in is older than 10 min | `methods`, `max_age_seconds` |
| 403 | reauth_failed | wrong password | `methods`, `max_age_seconds` |
| 409 | manual_deletion_required | the account has no email address | |
| 409 | deletion_in_progress | another deletion for this account is running on the same server instance | |
| 422 | confirmation_mismatch | confirmEmail isn't the account's email | |
| 429 | rate_limited | too many attempts (`Retry-After` header) | `retry_after_seconds` |
| 500 | deletion_failed | a deletion step failed, or an unexpected error | `retry_safe: true` |

Checks run in this order: query string → IP limit → token → per-account limit → body → confirmation → staff → re-authentication → deletion.

## Rate limits

- 20 requests per IP per hour, and 5 attempts per account per 15 minutes.
- The auth service's own sign-in limits also apply to password checks. Hitting them returns `429`.
- These counters live in memory on each server instance, like the app's other endpoints. They slow repeated attempts down but are not a hard global cap. Any further hard limit is the password check itself.

## Partial failures, retries and idempotency

- Deletion takes several steps and is not one transaction. Order: write the deletion record (status `processing`) → files → user rows → profile → sign-in → mark the record `completed` and write the audit log.
- Every step tolerates data that is already gone, so running it again is safe.
- The sign-in is removed only after every file and data step succeeded. So after a `500 deletion_failed`, the session normally still works, and the member can try again. They must re-authenticate again: password, or a sign-in under 10 minutes old.
- If writing the final record or audit log fails after the sign-in was removed, the response is still `200`. The account and data are gone; only the bookkeeping write failed, and it is logged on the server.
- There is no idempotency key. **The app must not repeat the POST on its own.** On a timeout or dropped connection, the result is unknown. Ask the member to try again, or to sign in again: if the account no longer exists, deletion completed. A later `401` does not prove deletion happened.
- There is no pending or asynchronous state. The endpoint returns only after deletion finished or failed.

## Staff policy

Accounts with any `admin_members` row or a non-`user` role are refused with `403 staff_protected`. If staff status cannot be read, the account is treated as protected. The admin Compliance tool keeps its own rules: admin/super admin only, refuses the admin's own account, refuses staff accounts.

## What is deleted

Everything is scoped to the account id taken from the session:

- **Files:** CVs and certificates; verification proofs; GraduateRoom photos on the member's posts; the member's Community photos; and now **every file in the member's own documents folder**. About 1 in 65,000 stored files had no document record, and this step catches files like that.
- **Rows removed directly:** applications (status history cascades), saved jobs, companies and searches, job views, notifications and preferences, push tokens, AI usage, tool events, job-alert send records, GraduateRoom posts, replies, follows, votes, saves, verifications and email codes, Career Hub comments, circular-job saves, applications, alert subscriptions and push logs, blocks, roles.
- **Removed with the profile** (checked in the live database): Community posts, replies, votes, saves, follows, photos, the reports they filed, bans, rate events, notice dedupe rows.
- **Removed with the sign-in** (checked in the live database): work experience, document rows, equity data, sessions and identities.

## What is kept

- **Job and post reports** they filed (the `reports` table): kept, with the reporter link cleared. The free-text `details` field is kept as written, so it may still contain anything the member typed. That is not full anonymisation.
- **Apply-button click counts:** kept, with the account link cleared by the database. An anonymous device id stays.
- **Deletion record:** kept, holding the account id, email, reason, and requested/processed times.
- **Admin audit log entry:** kept (`account_self_deleted`, the account id and email). Only admins can see it.
- **Contact-form messages and employer enquiries:** kept. They are matched by email address, not by account.
- No retention period is set in the system for any of the kept records.

## Tests run

- Unit tests (10 passing): only `confirmEmail` and `password` are accepted, and target fields are refused; malformed bodies are refused; confirmation must match the account's own email; the 10-minute sign-in window, including a missing claim and a future time; the storage sweep refuses an empty or invalid id, so the bucket root is never listed.
- Live checks against the preview server: no token, the publishable key, a refresh token, a forged token, and a token in another header all returned 401. A token in the query string returned 400. A spoofed `userId` returned 400. Someone else's email returned 422. Text instead of JSON returned 400. GET returned 405, OPTIONS 204, and the 6th attempt 429 with `Retry-After`.
- The owner's staff account was refused with `403 staff_protected`. The test also sent a deliberately wrong password, so even a broken staff check could not have deleted anything. No deletion record was created.
- **Not yet run:** a real successful deletion, a member token trying another member's account (the target can't be chosen at all, but this wasn't run with two accounts), and forced partial-failure recovery. These need dedicated throwaway test accounts, and the owner hasn't approved creating them yet.

## Database changes

None. No migration is waiting for approval. The existing deletion-request record is reused with a new `processing` status; the column is free text with no constraint.

## Mobile app (after publishing)

- Profile/Settings → "Delete my account": list what is deleted and kept, require typing the account email, and ask for the password. For Google-only accounts, run Google sign-in again first.
- Disable the button while the request is running. Don't retry automatically.
- Only on `200 {"deleted": true}`: clear that user's drafts, caches, generated Z83/CV files and session. Check that the stored session still belongs to the same user id first, in case someone else signed in meanwhile. Offer a separate choice to turn off the device's anonymous weekly reminder.
- On `401`, a timeout or `5xx`: don't show success and don't clear data; show the message.
- On `403 reauth_*`: ask for the password or a fresh sign-in.

> Historical implementation request, now superseded by the published [email-code contract](account-deletion-email-code-contract.md). No backend deployment is performed by this mobile branch.

# Lovable request: confirm account deletion by email, without Google sign-in

The owner wants members to confirm deletion inside FirstJobly using a code sent to their existing account email. Do not send them through Google/Gmail OAuth, a Supabase verification page, or another login flow. Use the existing FirstJobly transactional email provider and branded template/layout used for other account emails. The owner reports Supabase verification email is not working; first inspect actual delivery/configuration rather than assuming a cause.

## Verified source audit (14 November 2026)

The supplied live-code audit confirms:

- There is NO deletion-purpose or account-email code API today. This request describes proposed work, not a deployed contract.
- Reuse `sendFirstJoblyEmail({to, subject, html, text?, replyTo?})` in `src/lib/email-resend.server.ts`. It sends through Resend with server-only `RESEND_API_KEY` and returns `{ok:true,id}` or `{ok:false,error}`.
- Reuse the transactional `renderEmail({preheader, heading, subheading, body})` shell and `escapeHtml` in `src/lib/email-layout.ts`: pink #E1225F, navy #061A30, existing typography/layout. Sender: `FirstJobly <notifications@firstjobly.co.za>`; reply-to `info@firstjobly.co.za`. Include plain text. Keep the code out of the subject line.
- Existing GraduateRoom codes go to institution emails, reset GraduateRoom status to pending, and then verify student status. NEVER call `/api/graduateroom` send-code/confirm-code for deletion, and never write its code table.
- Employer/company codes are bound to private portal links and different recipients. Do not reuse them.
- `auth.reauthenticate()` and the existing `reauthentication.tsx` template cannot prove deletion authorization: the audited code can only be redeemed for a password change. The active auth-email hook is `/lovable/email/auth/webhook`; do not switch it to the legacy `/api/auth/send-email` route.
- Shared `register_code_attempt` accepts only employer and graduateroom. A deletion call would raise `unknown code kind`. Do not use an existing kind to bypass this.
- Existing code policies offer a useful proposed baseline: six digits, ten-minute expiry, sixty-second resend cooldown, five guesses and fifteen-minute lock. These are not yet deletion API rules. Confirm them in the reviewed implementation and contract.
- Existing Resend calls lack a timeout. Bound the new send request and define an honest failure/cooldown result when delivery is uncertain. Avoid logging email bodies/codes or repeatedly resending automatically after a timeout.

## Schema review comes before implementation/deployment

The audit lists code-table columns and describes `register_code_attempt`, but does not supply complete DDL, constraints, grants, policies, indexes or its exact function definition. Before preparing a migration, return the current relevant definitions (including exact function overload/signature, `pg_get_functiondef`, execution grants and search path) and confirm whether the proposed deletion-specific object names already exist. Also inspect the deletion handler's current concurrency/partial-failure behavior.

Prefer a separate deletion-only challenge table and attempt/consume mechanism so this work cannot change GraduateRoom or employer verification. Choose this after reviewing the real schema; do not assume names, constraints or callable functions. Preserve the shared function's existing behavior if you propose extending it instead.

Then prepare ONE SQL migration file containing the complete proposed schema change, with owner-readable comments explaining challenge lifetime, attempts/lock behavior, atomic consumption, RLS and service-only access. STOP and return it for owner/Lovable audit and approval. Do not apply it, deploy a handler requiring it, or claim the new API works yet. The owner has authorized preparation, not application. Do not request provider secrets or database credentials in chat.

The verified existing mobile contract is:

- `POST https://firstjobly.co.za/api/app/account/delete`.
- Current member session JWT in `Authorization: Bearer ...`; no token URL parameters, no publishable/service key as the bearer, no arbitrary target user ID/email.
- Body currently accepts ONLY `{confirmEmail, password?}`, maximum 4KB. Unknown fields are rejected.
- Requires password proof or a real sign-in within 600 seconds, checked using AMR, not a refreshed JWT's issue time.
- No deletion OTP exists in the supplied audit. Do not tell the app to send a new field until the backend supports and audits it.
- Success is exactly HTTP 200 `{deleted:true}` only after deletion finishes. Existing staff restrictions, deletion/retention behavior and safe errors remain.

## Desired flow

1. Signed-in member opens Delete my account. Display the existing account email; require typing it to confirm, with existing permanent-deletion disclosures.
2. Member taps **Send confirmation code**. Server validates the current member session, derives the recipient/account from it and sends a deletion-specific code to that account's current email using the existing FirstJobly mailer and branded email layout. A client cannot choose another recipient.
3. Member reads that email wherever they normally read mail and enters the code in the FirstJobly app. No forced browser login or session replacement. The email should say **Confirm your account deletion**, state that the member must return to FirstJobly and explicitly confirm deletion, and say to ignore it if unrequested. Reuse the brand/template wrapper but use deletion-specific wording, never a misleading login or signup message.
4. Prefer the smallest flow: one authenticated send-code request, then the existing deletion POST with a newly supported `emailCode` field when the member explicitly taps **Permanently delete my account**. This is a PROPOSAL pending schema approval and an audited published contract, not a field the app can send today. The deletion handler verifies/consumes the code before executing deletion. No separate verification/proof endpoint is necessary unless your audited design requires it. Sending/reading the email, opening a link or merely typing the code must not trigger deletion.
5. Existing deletion handler accepts the deletion-specific email code as an alternative to password/recent-login. If an `emailCode` is supplied, an incorrect/expired code must fail; do not silently fall back to recent authentication. Define/reject mixed proof modes explicitly. Preserve existing password/recent-login consumers, target derivation, protected-staff rules, 4KB limit and removal/retention semantics. Google-only accounts must work without a password or a fresh Google login.
6. App clears private local data/session ONLY after confirmed deletion, preserving the existing account-switch protections and unknown-result behavior. Failure to send/verify never clears data, logs the user out, creates an account or replaces their session.

## Security and reliability requirements

- Require the current valid member bearer session on send/verify/delete. Email text typed in a form is confirmation, not evidence of email ownership.
- Bind challenge/proof to the authenticated account, its current email and the deletion purpose. Do not reuse a signup/login/marketing code as deletion authorization. Reject a proof for another account, a changed email or another purpose. Audit appropriate session binding using the real auth claims; do not guess claim names.
- Use cryptographically generated short-lived codes; store only a protected hash, not the raw code. If the existing challenge mechanism provides equivalent protection, reuse it. Use bounded verification attempts, send/resend throttling, account/IP limits, expiry and single-use authorization. Return precise expiry/cooldown information and friendly errors.
- Make one active challenge/replacement behavior explicit. Resending must not accidentally leave old codes valid indefinitely or send duplicate emails on double taps.
- A valid code must not bypass the final explicit deletion action. Enforce its one-use/claim semantics on the server, including concurrent requests and guesses. Reject a challenge replaced during verification. Resend must not let an attacker erase an active lock or continually reset the guessing budget. Document behavior if existing multi-step deletion partially fails or the response is lost; do not promise transactionality that the deletion implementation lacks.
- Do not log codes, proofs, passwords, JWTs, email bodies or provider credentials. Keep email credentials and privileged keys server-only.
- Preserve existing website/mobile password and recent-auth consumers while introducing a documented compatible alternative. Do not weaken the admin deletion operation or grant member admin access.
- No client-side Supabase email OTP workaround that signs in/replaces the app session, creates users, relies on an unconfigured Supabase email template, or assumes a generic OTP automatically satisfies the deletion endpoint's reauthentication checks.

## Deployment boundary

This is Lovable Cloud. Do not use `supabase link`/`db push` or request a Supabase access token/database password. If a database change is needed, first provide the current relevant schema, then prepare ONE SQL migration file and STOP for owner audit/approval. Do not apply it. Backend/email configuration or deployment must follow the owner's Lovable approval process. The mobile workspace cannot configure the server email provider/template.

## Return the contract for the mobile app

After schema approval and backend implementation, provide deployed status, exact apex URLs and HTTP methods for send/delete (and verify only if actually needed); request fields with examples; success/error/status envelopes; bearer requirements; code format/length; expiry and resend rules; rate-limit/Retry-After behavior; challenge/proof lifecycle; duplicate-send and account-switch behavior; existing deletion endpoint compatibility; and any migration/configuration awaiting owner approval.

Verify with owner-approved disposable member accounts for email/password AND Google-only identities, expired/incorrect/reused codes, resend, wrong account/email/purpose, unauthorized calls, concurrent attempts, mail delivery failures and deletion failure/unknown-result cases. Do not delete the owner's staff account or real member accounts. Report what was actually tested. Once published and audited, the mobile app can replace the Google reauthentication UI with this flow without changing ordinary login, ads, Apply, CV/Z83 or reminders.

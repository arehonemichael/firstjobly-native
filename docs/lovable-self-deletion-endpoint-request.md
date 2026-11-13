# Lovable task: authenticated self-deletion for the FirstJobly mobile app

Implement and audit the backend in the current Lovable project. This is a **requested new API**, not an assertion that an endpoint exists. The mobile repository does not contain the live TanStack Start compliance implementation. Do not apply database changes automatically; if schema changes are necessary, first audit the current schema and return one SQL migration for owner/Lovable approval.

## Verified existing behavior supplied by the owner

`deleteAccountPermanently` in `src/lib/compliance.functions.ts` is an admin/super_admin-only POST TanStack server function. Its generated transport is not a stable public REST URL. It takes target email + matching confirmation, refuses the caller's own account and protected staff accounts, and deletes through several nontransactional steps. Ordinary members cannot use it. `previewAccountDeletion` is also admin-only. Do not expose either function to members or remove their authorization restrictions.

There is an `account_deletion_requests` table, but no audited member-facing request endpoint or automatic processor. Inserting a request does not execute deletion. Do not have the mobile app write to that table directly or report a request as completed deletion.

## New endpoint to implement

Expose a stable authenticated POST HTTP route for **the caller's own account only**. Lovable should choose/confirm the final path; **do not assume `/api/account/delete` exists**. Return the deployed path and exact contract after implementation/audit.

1. Accept the shared user's session `access_token` only in `Authorization: Bearer ...`. Validate it server-side with the existing trusted auth service. Derive the target user ID and current email from that validated user; never trust a client-supplied target ID, target email, role or publishable key. Reject missing/expired/invalid sessions, token query parameters and unknown target fields.
2. Proposed request shape: `{ "confirmEmail": "member@example.com" }`. This is a proposal until audited. Normalize and check the confirmation against the authenticated user's current email. It is confirmation, not target selection. Reuse the existing basic email validation. Do not require completion of a job-seeker profile or Community membership just to delete an account.
3. Keep the existing protection for staff/admin/moderator accounts and return a safe support/manual-deletion message for them. Do not grant admin access, use a member token as a service key or weaken the existing admin operation's caller/target restrictions.
4. Audit and document the member reauthentication policy. Reuse an existing supported password/OTP/recent-auth proof if available; return its exact contract. A refreshed token or JWT `iat` alone must not be described as proof of a fresh password/OTP check. No reauthentication currently exists in the audited admin operation, so do not claim one is already implemented.
5. Refactor/share the **internal server-only deletion steps** where appropriate, keeping authorization at separate admin and self-service entry points. The self-service path may bypass the admin function's *own-caller refusal* only through its own explicit owner authorization. Never call the admin-only public server function from a member client.
6. Scope every read, storage removal and delete to the server-derived target. Use the existing trusted server credentials only on the server. Preserve the admin tool's protections and behavior.

## Data behavior and truthful results

Reuse/audit the existing operation's removal of stored CVs/certificates/proofs/photos; applications/saves/searches/views; notifications/preferences/push tokens; AI/tool events and alert-send records; GraduateRoom content/relations/verification; Career Hub comments; circular-job saves/applications/subscriptions/push logs; blocks/roles; profile; then the sign-in account. Verify the existing cascades for Community/work-experience/documents/equity in the current live schema before relying on them.

The audited implementation retains reports with `user_id` cleared, deletion-request records and a restricted admin audit record. Confirm the current retention policy; clearing `user_id` alone must not be described as complete anonymization of every report field. They may include the deleted email/identifier. Explain that retention precisely; do not return “every trace was erased.” Do not fabricate retention periods.

Storage/auth/database deletion is multi-step, not one transaction. Make retries safe and tolerate already-removed target-owned records. Never report success on partial failure. Do not automatically retry a destructive HTTP request without an explicit idempotency design. If existing schema cannot track retry/progress safely, return the current schema facts and one proposed migration for review; do not guess columns or silently apply it.

Proposed completed result: HTTP 200 `{ "deleted": true }` **only after all required steps complete**. If deletion is intentionally asynchronous, return an explicit pending response/status contract and real completion mechanism; the app must not label pending as deleted. A later 401 is not proof that deletion completed.

Provide a stable JSON error envelope, for example `{ "error": "Safe user-facing message", "code": "..." }`, and exact status/code mappings for auth required, confirmation invalid, staff protected, rate limit and deletion failure. These shapes are proposals, not current live facts. Keep internal SQL/storage details and credentials out of responses/logs. Add endpoint rate limits using the supported backend mechanism.

## Verify before returning the contract

- Normal member can delete only their own account after the required confirmation/reauthentication.
- Spoofed target ID/email, other-member token, missing/expired token, publishable/refresh token and malformed/unknown fields cannot select/delete another account.
- Protected staff accounts remain protected. Original admin preview/delete functions keep their permissions and restrictions.
- Partial storage/database/auth failures never return completed success; safe recovery/retry is demonstrated with isolated fixtures.
- Confirm actual cascades, expected removals and retained audit/report data against the current schema. No destructive live-member test without explicit owner authorization; use dedicated test accounts for approved end-to-end verification.

Return: deployed URL/method, exact auth/body/success/error/status contract, reauth flow, rate limits, retry/idempotency and partial-failure semantics, staff policy, deletion/retention summary, tests performed and any migration awaiting approval. Confirm whether it is actually deployed.

## Mobile follow-up after the endpoint is deployed

Only then implement Profile/Settings → Delete my account with explicit consequences, typed confirmation and any required reauthentication. Use the current session token; never embed privileged keys or send an arbitrary deletion target. Prevent duplicate taps and do not automatically replay the destructive POST on ambiguous network failure. Do not show success or clear the session on an unconfirmed partial/timeout/401 result.

On confirmed deletion, clear that user's private drafts/caches/generated files and local session, protecting a different account that might have signed in while the request was pending. Device-wide anonymous weekly reminder opt-in is separate; offer a clear choice to turn it off and never promise removal of every device setting. Preserve existing auth, ads, Apply and CV/Z83 behavior outside deletion.

Public App Review remains on hold until this endpoint, the mobile flow and the other release requirements are verified. Building/uploading a draft binary is not public deployment.

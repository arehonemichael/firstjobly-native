> Superseded: owner supplied the published final API contract on 14 November 2026. The review below records the pre-deployment approval stage, not work still required. Do not reapply the SQL. See [account-deletion-email-code-contract.md](account-deletion-email-code-contract.md) for current behavior.

# Deletion email-code review — version 2, 14 November 2026

Status: suitable for owner approval based on static review. No migration, backend change, email, secret provisioning or deletion was executed here. No further blocking issue was identified in the supplied SQL. This is not a certification of the live backend or an authorization to deploy.

The one proposed migration is `account-deletion-email-code-migration.sql`, now containing the supplied version 2. The original attachments remain the comparison source; do not apply both versions.

## Previous findings addressed

- The supplied v2 has a valid opening SQL comment. The earlier single-hyphen problem was in the pasted artifact, not necessarily Lovable's saved source.
- Claim and existing-row issuance take `clock_timestamp()` after their row-lock waits. The first-insert path restamps deadlines after insertion, avoiding a shortened lifetime after a unique-lock wait.
- Issuance retries insert-or-lock up to three times when a cleanup removes the conflicting row. It returns `busy` instead of success when no row can be stored. The bounded loop, missing-row handling and post-insert update resolve the reviewed false-success path.
- The revised review explicitly withdraws the claim that 401 confirms deletion. Only `200 {deleted:true}` authorizes success and deletion-specific local cleanup. Unknown completion must not trigger automatic destructive replay.

## Test evidence and limits

Lovable reports v2 loaded cleanly into a private PostgreSQL 17 database and passed the original issue/claim/limits/access/concurrency cases, plus lock-boundary and cleanup-race regression tests. It reports reproducing the v1 bugs first. These are supplied results, not tests independently executed here. This workspace review compared the SQL and read the report; no live database or local PostgreSQL execution was used.

Actual email/password and Google session_id behavior remains to be verified using authorized disposable accounts. The proposed handler must first validate the bearer token, then inspect the session_id of that exact token; a missing or invalid UUID must fail closed as documented. Token refresh should preserve the challenge; another sign-in session should not. Do not share raw bearer tokens in chat.

## Owner decision and next steps

The owner may now authorize Lovable to apply this single v2 migration and generate the server-only ACCOUNT_DELETION_CODE_KEY in managed secret storage. No secret belongs in mobile configuration, source control or chat.

After approval, Lovable still needs to implement the send endpoint and emailCode deletion mode, use the existing Resend branded mailer with bounded sends, add challenge cleanup to both deletion paths, and test before publication. Maintain current password/recent-login compatibility, staff restrictions and the no-fallback rule for an incorrect supplied emailCode.

Ensure the final HTTP contract includes the new database `busy` refusal, `session_unsupported`, all code failures and Retry-After fields, and distinguishes accepted delivery from uncertain delivery. Server response wording must explain when a new code is required after a consumed-code partial failure. It must never equate 401 with completed deletion.

Tests that actually delete accounts require separate explicit owner authorization limited to designated disposable accounts. Do not assume this review approves deleting real members or the owner's staff account.

The app must retain its current functioning deletion flow until Lovable confirms publication and supplies the final audited contracts for:

- POST https://firstjobly.co.za/api/app/account/delete-code
- POST https://firstjobly.co.za/api/app/account/delete with emailCode support

These are currently proposed, not available app capabilities. No mobile requests to the new route or new body fields have been introduced.

## Suggested approval wording, only if the owner agrees

"I approve version 2 of the account-deletion email-code migration and generation of ACCOUNT_DELETION_CODE_KEY in managed secret storage. Apply only this reviewed migration, implement and test the send/delete endpoint changes using our existing branded email mailer, then publish and return the final mobile API contract and actual test results. Preserve existing login, GraduateRoom, deletion protections and unrelated app behavior. Do not delete real member or staff accounts. Ask separately for authorization identifying disposable accounts before tests that perform deletion."

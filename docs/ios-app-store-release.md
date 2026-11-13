# Production iOS build and public App Review

Release preparation branch: `release/ios-app-store`, based on `feat/weekly-device-reminders`. Includes the iOS configuration, owner-supplied ad IDs, correctly typed rewarded interstitial and guest/member weekly device reminders. Main is unchanged.

## Prepared

- App version **1.0.1**, iOS build **3** (avoids reusing the earlier build numbers), bundle ID `com.first.firstjobly`.
- `ios-production`: App Store distribution and the owner's real iOS App ID/unit IDs, with `EXPO_PUBLIC_ADS_TEST_MODE=false` explicitly set. The inherited TestFlight test profile overrides it back to true. Android configuration is unchanged.
- A production build/upload does not publish the app publicly. App Store Connect metadata and Apple review are separate steps. No signing, upload or review submission was performed in this workspace.

## Current public-review gap

The app currently offers account creation but no in-app account-deletion flow. Apple's [account-deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app/) applies. The owner has now confirmed that only an **admin-only TanStack Start server function** exists. It refuses the caller's own account; there is no member-facing deletion endpoint or automatic request processor. Do not call it from the app, guess a REST URL, grant members admin permissions or treat an `account_deletion_requests` row as completed deletion. Give Lovable [the concrete self-deletion endpoint request](lovable-self-deletion-endpoint-request.md), obtain the deployed/audited contract, then implement and verify the mobile flow before public submission. Do not invent an API, directly delete auth/database rows or apply a database migration from this workspace.

Also complete App Privacy/age/content declarations from actual app/SDK behavior, privacy/support URLs, screenshots for the supported iPhone/iPad sizes, reviewer access and Community moderation requirements. The existing source icon is 72px; Expo produces an opaque 1024px icon, but a high-resolution brand master is recommended for public quality. Ads are subject to AdMob app readiness and iOS Privacy & Messaging configuration; real unit IDs do not guarantee impressions.

## Owner's PowerShell commands

Save uncommitted local work before switching. The Apple/Expo session is on the owner's PC, not this workspace.

```powershell
git fetch origin
git switch release/ios-app-store
npm ci
npm run typecheck
npm run test:ios
npm run test:reminders
npx eas-cli@latest env:list --environment production
```

Ensure EAS **production** has the same public settings as the working preview: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WEB_URL=https://firstjobly.co.za`. Do not add a Supabase admin/service key. The iOS profile already supplies the ad identifiers and disables test mode; no Apple passwords or private signing keys belong in Git/chat.

Build the App Store-signed binary:

```powershell
npx eas-cli@latest build --platform ios --profile ios-production
```

Create/select FirstJobly in App Store Connect with bundle ID `com.first.firstjobly`. After the build succeeds, upload **that exact build** (replace BUILD_ID with the ID from the build output):

```powershell
npx eas-cli@latest submit --platform ios --profile production --id BUILD_ID
```

The upload becomes available in App Store Connect/TestFlight after Apple processes it. Check the actual release binary on iPhone/iPad, including permissions/reminders while signed out, sign-in/restore, jobs/Apply, CV/Z83/Files, Community, consent/ads and the added account-deletion flow. Do not click live ads. Use official test builds for ad interaction tests.

Once the account-deletion gap is fixed and all review metadata/testing is complete, select the uploaded build under the iOS version and submit for App Review. Apple approval is required before public App Store release. If build 3 has already been uploaded, increase the iOS build number before the next build/upload.

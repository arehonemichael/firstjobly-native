# Production iOS build and public App Review

Release preparation branch: `fix/gov-job-card-ads-release`, based on `feat/email-attachments-z83-capitals`. Includes the latest email/PDF/Z83 improvements, account deletion by emailed code, Gov Jobs whole-card taps and shared ad policy, iOS configuration, owner-supplied ad IDs and guest/member weekly device reminders. Main is unchanged.

## Prepared

- App version **1.0.1**, iOS build **7** (avoids reusing the earlier build numbers), bundle ID `com.first.firstjobly`.
- `ios-production`: App Store distribution and the owner's real iOS App ID/unit IDs, with `EXPO_PUBLIC_ADS_TEST_MODE=false` explicitly set. The inherited TestFlight test profile overrides it back to true. Android configuration is unchanged.
- A production build/upload does not publish the app publicly. App Store Connect metadata and Apple review are separate steps. No signing, upload or review submission was performed in this workspace.

## App Store review

The app provides in-app account deletion using the published member endpoints; see [account-self-deletion.md](account-self-deletion.md) and the final [email-code contract](account-deletion-email-code-contract.md). The current mobile flow sends a code to the account email, accepts it inside the app and requires an explicit final deletion tap. It does not require Google reauthentication. Before public submission, complete owner-authorized disposable-account success/partial-failure and native-device checks, including a Google-only member. No real deletion was performed in this workspace. Do not apply the archived SQL migration again or expose privileged backend keys in the app.

Also complete App Privacy/age/content declarations from actual app/SDK behavior, privacy/support URLs, screenshots for the supported iPhone/iPad sizes, reviewer access and Community moderation requirements. The existing source icon is 72px; Expo produces an opaque 1024px icon, but a high-resolution brand master is recommended for public quality. Ads are subject to AdMob app readiness and iOS Privacy & Messaging configuration; real unit IDs do not guarantee impressions.

## Owner's PowerShell commands

Save uncommitted local work before switching. The Apple/Expo session is on the owner's PC, not this workspace.

```powershell
git fetch origin
git switch fix/gov-job-card-ads-release
git pull --ff-only
npm ci
npm run typecheck
npm run test:ios
npm run test:reminders
npm run test:circular
npm run test:ads
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

For this first public release, create the iOS version in App Store Connect and complete its required listing, privacy and review fields. Once Apple processes the uploaded build, select that build and submit for App Review on the website. Apple approval is required before public release. The website does not accept a direct IPA file upload: EAS Submit on Windows, Transporter on macOS, or Xcode uploads the binary first. If build 7 has already been uploaded, increase the iOS build number before another upload.

For a single build-and-upload command on the owner's authenticated PC (the current EAS CLI confirms this flag), use:

```powershell
npx eas-cli@latest build --platform ios --profile ios-production --auto-submit-with-profile production
```

This uploads the exact successful build rather than selecting an unrelated latest preview. On a first submission EAS may ask for the App Store Connect listing or its numeric Apple ID. It does not submit the App Store listing for review or make the app public; finish those steps on https://appstoreconnect.apple.com.

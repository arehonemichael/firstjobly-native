# Gov Jobs card taps, shared ads and first iOS release

Branch `fix/gov-job-card-ads-release`, stacked on `feat/email-attachments-z83-capitals` (PR #28). Version 1.0.1, iOS build 7, bundle ID `com.first.firstjobly`. Main unchanged.

## Fix

The old Gov Jobs card made only the title/department area pressable and navigated directly with `router.push`, bypassing the standard job-open interstitial manager. The title, department, location, salary, closing information and card padding now share one pressable surface. Save is a separate sibling button with a 44dp target, so it cannot bubble into job navigation or consume an ad opportunity. This also avoids nested interactive buttons on web and keeps both actions available to accessibility tools.

Every Gov Jobs card, including saved/batch feeds, uses the same `useEarlyJobInterstitial` hook as ordinary Jobs. Both job sources therefore share the singleton's existing click cadence, consent, preloaded-only behavior, session cap, cooldown, fullscreen lock and error/timeout continuation. No new ad units, counters or policy changes were introduced. Apply, email, CV/Z83 exports and their existing rewarded gates are unchanged.

The Gov Jobs feed now inserts `NativeAdBlock` using the same `shouldInsertNative(index)` predicate as ordinary Jobs (zero-based indices 3, 9, 15...). Ads sit outside the clickable card. A detail native slot uses the existing detail variant before the official-circular section, away from the fixed Apply controls. The native component retains its own consent, enabled-flag, unsupported-platform and no-fill handling.

## Verification

- TypeScript and targeted ESLint passed.
- Complete automated Node suite: 434 passed, including three new component tests and the existing ad controller/cadence/failure tests.
- `npm run test:circular` now includes the Gov card tests.
- Isolated Chromium: 131 Gov Jobs browser checks plus the document/account-isolation scenario passed. Added actual pointer clicks on location, salary, closing text and empty card padding, with Save verified not to navigate. All backend/auth responses were synthetic; no real writes, emails or applications.
- Production iOS JavaScript/Hermes export passed with `ios-production` profile variables and real iOS ad configuration.
- Production no-install iOS prebuild passed: build 7 and the owner-provided iOS AdMob App ID are present. This is project generation, not Xcode compilation.
- Android JavaScript export passed.
- Expo Doctor: 20/21 checks; the existing dependency patch-version check still flags 21 packages. Dependency versions were not changed as part of the card/ad fix.
- `git diff --check` passed.

## Release handoff

The owner will upload and finish the first App Store listing. EAS CLI `whoami` reported **Not logged in** in this workspace; no store-signed build, binary upload, App Review submission or public deployment was performed here. Xcode compilation, actual native ad impressions and the recently added multi-PDF email extension still need the owner/EAS/device checks.

See `ios-app-store-release.md` for verified PowerShell commands. App Store Connect's website handles the listing and review submission, but does not accept an IPA file directly; EAS Submit works from Windows. Create/select the listing for `com.first.firstjobly`, build/upload the exact `ios-production` build, then select version 1.0.1 (7) in the portal after Apple processes it and submit for App Review. Apple decides approval and availability.

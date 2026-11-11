# FirstJobly navigation and Home update

This package applies to the uploaded local project. It is an overlay containing changed source files, tests, and verification notes.

**The uploaded project differs from this repository's main branch.** Download and apply the ZIP to your existing local project. Merging this delivery branch alone does not install the redesign into the repository's app source.

[Download the update ZIP](https://github.com/arehonemichael/firstjobly-native/raw/refs/heads/codex/navigation-home-update/updates/firstjobly-navigation-home-update.zip)

## Install in PowerShell

Stop Expo with Ctrl+C. From `C:\Users\asus\firstjobly-native`, back up or commit your current changes, then run:

```powershell
Invoke-WebRequest -Uri "https://github.com/arehonemichael/firstjobly-native/raw/refs/heads/codex/navigation-home-update/updates/firstjobly-navigation-home-update.zip" -OutFile "..\firstjobly-navigation-home-update.zip"
Expand-Archive -Path "..\firstjobly-navigation-home-update.zip" -DestinationPath "." -Force
npm run test:navigation
npx expo start --clear
```

Keep your existing environment files. No new runtime dependencies are required.

## Included

- Compact Home/Menu dock and grouped navigation sheet with all seven existing destinations.
- Desktop navigation with keyboard controls; accessible menu states, focus management, and reduced-motion support.
- Home overview using existing profile, saved-job, application, and location data.
- Draft application resumption, profile completion, remote image fallbacks, and contextual login returns.
- Source-file checksum manifest and full installation/verification notes inside the ZIP.

## Verification

TypeScript, four unit tests, 97 browser assertions using isolated fixtures, and web/Android bundle exports passed.

The original source has 13 existing lint errors; those remain. Native device behavior, real-account authentication, and production database access have not been verified. The existing missing iOS AdMob app-ID warning remains.

The package excludes credentials, environment files, dependencies, and native build outputs.

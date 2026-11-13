# Weekly device reminders — iOS and Android

The owner selected **phone-scheduled weekly reminders**, including signed-out users. This is local OS scheduling, not server-sent push. No Supabase tables, API contracts, Lovable migrations, device tokens, APNs/FCM sends, background cron or remote credentials are required.

## Schedule

| Day | Phone-local time |
|---|---|
| Sunday | 19:30 |
| Monday | 06:00 and 19:30 |
| Thursday | 06:00 and 19:30 |

Five repeating native weekly calendar notifications, not JS timers or interval broadcasts. Expo weekdays are Sunday=1, Monday=2, Thursday=5. Times follow the phone's local calendar, so they are SAST when the phone is set to South African time. This does not enforce Africa/Johannesburg while travelling; reopen the app after changing timezone/settings to recheck its schedules. Focus/Do Not Disturb, denied notification permission, muted channels and Android battery/Doze restrictions can suppress or delay delivery. No exact-alarm special permission is requested; the installed SDK uses its standard inexact fallback where Android does not allow exact alarms.

The messages are general job-search reminders, not claims that new jobs were published. They include no name, account ID, saved-job data or other private information. Taps use the strict `weekly_job_reminder` payload with fixed `/jobs` destination, available to guests.

## Opt-in and lifecycle

- Home offers **Enable reminders** / **Not now** when this device has not made a choice. Enabling is an explicit action before the OS permission prompt; the app does not silently schedule notifications or repeatedly prompt on launches/sign-ins.
- More → Notifications has an always-accessible weekly reminder switch, times, status, permission/settings link and recovery action. This section works while signed out. The existing government-circular account preference remains separate and still requires sign-in.
- Preference belongs to the installation, not the account. Signing out or switching accounts does not remove reminders. Turning the switch off cancels only FirstJobly's weekly schedules, preserving unrelated notifications.
- Root start/Home focus/foreground returns check OS permission and reconcile existing schedules. Identifiers/version metadata prevent duplicates after repeated taps, refreshes, remounts and restarts. Operations are serialized.
- If permission is revoked, owned pending notifications are cancelled while the chosen opt-in is retained; granting permission and reopening restores the five schedules. Permission refusal on initial enable leaves the switch off.
- Partial scheduling errors clean up only owned entries, display an error and retain the opt-in for retry. Corrupt preferences reset to no opt-in rather than assuming consent.
- Native OS schedules remain after the app process closes; Metro/internet/sign-in are not needed for delivery once scheduled. Clearing app data/uninstalling removes schedules/preferences. Android force-stop can suppress local notifications until the app is opened again. OS restrictions prevent a guarantee of exact delivery.
- Web and Expo Go do not load the notification SDK or pretend schedules are active. Use a custom native build.

## Native configuration and changes

Added the existing `expo-notifications` config plugin, a default-importance Android reminder channel, guest settings/Home opt-in, a device-wide controller and injectable native adapter. Foreground presentation is enabled for these reminders; other notification kinds keep the previous foreground behavior. Existing Community/circular tap routing is preserved. No ad IDs, ad cadence, auth, Apply or CV/Z83 behavior changed.

Files: `src/lib/reminders/{schedule,controller,native-port,runtime}.ts`, `src/hooks/use-weekly-reminders.ts`, `src/components/weekly-reminders.tsx`, `src/app/{_layout,notifications}.tsx`, `src/app/(tabs)/index.tsx`, `src/lib/circular/links.ts`, `app.json`, `package.json`, the reminder/browser tests, and the iOS build-number assertion. iOS build number is now **2**, Android version code **33** for the next native builds. Native generated folders remain git-ignored.

## Verification

- 307 Node tests pass across reminders, iOS/platform/ads, startup, navigation, Gov jobs, Community and personalization. Reminder cases cover all five slots, opt-in/denial, reload persistence, duplicate/racing operations, opt-out ownership, permission revocation/restoration, partial failure cleanup/retry, stale records, timezone/offset changes on foreground refresh, corrupt preference recovery, public tap destinations and actual adapter payloads for both platforms.
- Typecheck and focused lint pass.
- Browser: signed-out Notifications displays the five times and native-only state without protected API requests or runtime errors. 120 Home/nav/login checks pass with isolated responses.
- iOS prebuild/JavaScript export and Android JavaScript export checked separately from native compilation. No physical-device notification delivery, signed builds or deployment performed in this workspace.

Build/test from PowerShell (save local work before switching):

```powershell
git fetch origin
git switch feat/weekly-device-reminders
npm ci
npm run typecheck
npm run test:reminders
npx eas-cli@latest build --platform all --profile preview
```

The internal iOS build needs the registered iPhone used previously. Install each new native build, open Home, tap **Enable reminders** and allow OS notifications. Alternatively use More → Notifications without signing in. Check five scheduled reminders, sign-out persistence, disable/re-enable, permissions in OS settings, background/closed-app delivery, and that a tap opens Jobs. A native rebuild is required for plugin/native-config changes; reloading the previously installed binary alone is not the complete release test. For a later TestFlight upload use `--platform ios --profile ios-testflight`; the new iOS build number is 2.

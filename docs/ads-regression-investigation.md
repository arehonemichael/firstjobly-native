# Missing ads: regression investigation

For the latest fresh-launch app-open and 1/3/6 job-tap policy, see [the current placement policy](ad-placement-policy.md). Earlier cadence/startup descriptions below record the prior implementation.

## Confirmed device regression and repair

The subsequent structured device trace resolves the earlier uncertainty:

```text
runtime: android / development-client / supported=true / sdkAvailable=true / testMode=true
consent.update-failed: publisher-configuration
consent.cached: status=UNKNOWN / canRequestAds=true
consent.blocked: publisher-configuration
```

**The app incorrectly rejected permission Google explicitly granted.** The extra NOT_REQUIRED/OBTAINED status whitelist, introduced with the consent gate, treated UNKNOWN as denial even when UMP returned `canRequestAds: true`. Thus SDK initialization and every placement stayed blocked. The publisher-configuration error is real, but it was not by itself evidence that this device lacked permission. Earlier instructions that publishing a form was the only way to unblock this particular device were too strong.

The repair accepts the SDK's recognized UNKNOWN status **only when canRequestAds is explicitly true**, both after a failed update and after a successful update. These requests remain non-personalized. UNKNOWN without permission, REQUIRED status during recovery, unrecognized statuses, refused OBTAINED storage/basic-ad choices and failed privacy withdrawals still do not authorize ads. Required forms are not skipped. No geography, IDs, placements, frequency or native configuration changed.

Changed implementation: `src/ads/consent-controller.ts`; regression tests: `scripts/test-ads.cjs`. The exact supplied trace is now covered, alongside concurrent preparation, no duplicate initialization and the successful UNKNOWN/true path without a forced form. **47 ad tests, 13 runtime tests, TypeScript and focused lint pass.** Real Android rendering still needs verification. No new binary is required.

After pulling the updated branch, expect `initialize.ready`, `consent.result` with `canRequestAds:true`, then placement/request outcomes. The update warning can remain while SDK-authorized NPA requests proceed. It does not establish fill; inspect loaded/error callbacks next. Configure appropriate UMP messages for users/regions that actually require them; do not infer universal permission from this device's result.

The sections below retain the earlier investigation evidence and its limitations for context; this confirmed trace supersedes the previously unresolved cached-permission question.

## Evidence and affected environment

The supplied device logs show FirstJobly running in an Android Expo **development client**, launched through `firstjobly://expo-development-client/`, on an SM-G973F. They are not Expo Go/web/iOS logs. All formats were reported absent. Google UMP reports:

> Publisher misconfiguration: Failed to read publisher's account configuration; no form(s) configured for the input app ID.

The received app ID matches the repository's unchanged Android AdMob app ID. Source configuration is app version 1.0.1 / Android versionCode 32, SDK 16.3.4; the **installed binary version is not established** by those logs. New runtime diagnostics report Constants.nativeAppVersion/nativeBuildVersion from the installed binary. A development JS bundle selects official test units; the new trace reports effective mode, support, flags and whether units are available.

No connected Android device/adb executable or AdMob account connector is available in this workspace. Native rendering, impressions, live dashboard status and installed APK contents cannot be verified here. The historical audit at `codex/brand-navigation-hot` / `f650e71` was read as source context, not as installed-device evidence.

## Source comparison and cause boundaries

Commit `a90861c` introduced the shared consent controller/gate. Immediately before that commit, banners requested ads directly without UMP permission checks, and AdMob initialized independently of the current UMP controller. This establishes a source regression boundary; it does **not** identify the exact last working installed APK.

The current provider-configuration error is confirmed. Before the recovery patch, any consent-update error forced permission false and blocked all formats before requests. Follow-up `de26e0c` checks the SDK's current retained permission, following Google's documented previous-session recovery. It does not infer permission from error text or permit ads after refusal.

Important: the old raw warning was emitted even when cached permission recovery succeeded. Therefore that warning alone does **not** establish the final current canRequestAds value, SDK initialization or whether a subsequent request failed/no-filled. The new trace resolves that ambiguity. No-fill, an account ban, available inventory and successful restoration are **not established** by the supplied logs.

## Current pipeline and changes

- Runtime/flags: trace supported platform, execution/build mode, test/production selection, native app/build version, effective format flags and unit availability.
- Consent: trace preparation, update errors with sanitized SDK code/message, current cached permission/status, final permission, retry and privacy-form errors.
- Initialization: trace start/reuse, completion and asynchronous initialization failure. Permission must still pass first.
- Placement: banners/native report mounted eligibility, layout width and skip reason. App-open reports startup/Home/onboarding/consent restrictions separately from foreground presentation eligibility.
- Request/loading: trace real load attempts, loaded callbacks, error/no-fill/network classification, bounded interstitial retries and timeouts. SDK native promise errors are retained rather than collapsed into an anonymous failure.
- Presentation/navigation: trace interstitial cadence/readiness/cooldown/cap/lock skips and missing-event timeouts; app-open route/launch/cooldown/late/lock skips and terminal failures. Existing exactly-once navigation and cold-start restrictions remain intact.
- Impression evidence: banner onAdImpression and native NativeAdEventType.IMPRESSION are observed. SDK 16.3.4's public full-screen AdEventType has **no IMPRESSION event**; OPENED is logged as presentation, never fabricated as an impression count. Check actual on-device presentation and AdMob reporting for full-screen impressions.
- Privacy: diagnostics run only with `__DEV__`, not in production or release test-unit builds. They whitelist primitive fields, redact URLs, emails, UUIDs, token/consent assignments and long opaque strings, and never serialize raw SDK response/consent objects. Logger failures cannot affect navigation. No raw errors are displayed to normal users.

No placement, cadence, feature flag, production ID, request personalization policy, native configuration, dependency, routing, Apply or backend change was made in this investigation. No consent bypass, geography override, fake creative, audience tag or extra retry loop was added.

## Previously identified failure points

| Historical concern | Current verification |
|---|---|
| Banner stays hidden permanently | Existing 30/60/120s recovery/remount and 12s timeout tests pass. |
| Banner width/permission reset | Keyed authorized child and component tests cover resize/regrant. |
| Native load hangs/late promise leaks | Existing 10s timeout, one retry, collapse and late destroy tests pass. |
| Unenforced switches | Existing runtime flag tests pass; configuration is unchanged here. |
| Interstitial opportunity consumed before load | Existing not-loaded immediate navigation/opportunity-retention test passes. |
| Lost presentation leaves navigation pending | Existing CLOSED/ERROR/rejection/start/safety completion tests pass. |
| Full-screen formats overlap | Existing shared owner lock/gap tests pass. |

These fixes already existed at the current checkout; they were not reimplemented or assumed to explain the new device logs.

## Changed files

| File | Purpose |
|---|---|
| `src/ads/diagnostics.ts` | Development-only structured/redacted logger and error classification. |
| `src/ads/consent-controller.ts` | Consent, retained-permission and initialization stage observations. |
| `src/ads/privacy.ts` | Removes the old unsanitized, ambiguous warning subscription. |
| `src/ads/AdMobLifecycle.tsx` | Runtime/version/flag and app-open eligibility diagnostics; maps existing OPENED event. |
| `src/ads/AdBanner.tsx` | Placement/layout, request/error, opened/closed and actual impression callbacks. |
| `src/ads/NativeAdBlock.tsx` | Native request/load/error/timeout and actual impression observations, with listener cleanup. |
| `src/ads/recovery.ts` | Preserves native SDK errors and reports banner attempts/load/timeouts without changing delays. |
| `src/ads/interstitial-manager.ts` | Request/retry/readiness/presentation/error/skip tracing without changing policy. |
| `src/ads/app-open-controller.ts` | Existing load/show/guard/failure observations and safe OPENED observation. |
| `scripts/test-ads.cjs` | Redaction, production silence, logger isolation, no-fill semantics and exact publisher-error pipeline tests. |
| `docs/ads-regression-investigation.md` | Evidence, limitations, source comparison and device/dashboard procedure. |

## Verification

- 44 ad tests and 13 Expo/runtime tests pass. This includes the exact publisher error with both blocked and valid-cached-permission outcomes; neither initialization nor LOADED is treated as impression evidence.
- TypeScript and focused ESLint pass.
- Web and Android JavaScript exports pass (existing missing-iOS-app-ID warning remains; native iOS advertising remains unsupported).
- Protected configuration, SDK gates, all screens, placements and backend files are unchanged against `de26e0c`.
- No live ads were requested or clicked by these tests. No installed-device rendering test was possible. These checks do not establish fill, revenue or policy compliance.

## Device test and remaining repair

This is JS-only instrumentation using APIs already present in SDK 16.3.4: **no new Android binary is required** for the reporting development client. Pull `ads-revenue-fix`, restart Metro with `npx expo start --dev-client -c`, fully close/reopen the app and enter Home. Do not clear app storage or call AdsConsent.reset during diagnosis, since that removes prior consent evidence.

Capture the `[FirstJobly ads]` structured lines. On Home, inspect `runtime`, `format`, `placement`, `consent.*`, `initialize.*`, `request`, `loaded`, `load.failed` and `impression`. Then scroll Jobs past the configured native slot, open a job for detail inventory, and exercise an eligible interstitial and later app-open return using **official test units only**. Verify withdrawal/regrant and no-fill recovery on-device; do not click production ads.

- If `consent.cached` / `consent.result` denies permission and `consent.blocked` reports publisher configuration, publish the appropriate UMP Privacy & messaging message for the exact existing Android app ID in AdMob. Verify the app selection, privacy-policy URL, message publication/regions, then retry after Google makes the configuration available. The repository cannot publish an account message.
- If permission is true but initialization fails, use `initialize.failed` and its sanitized SDK code; compare the installed binary/native SDK configuration rather than changing IDs speculatively.
- If initialization succeeds, inspect each actual request's code. No-fill is an unsuccessful load, not a successful restoration. With official test units, check device connectivity, VPN/private-DNS/ad blocking and Google Play services. With production units, verify app readiness, ad-unit format/status, app/account serving restrictions, Policy Center/account diagnostics, consent setup and app-ads.txt in AdMob. No restriction or ban has been inferred.
- If loaded but not visible, use placement width/eligibility and physical layout inspection. For full-screen formats, distinguish intentional cadence/route/launch/cooldown/lock skips from presentation failures. Cold startup deliberately does not show app-open ads.

Actual restoration remains unverified until a supported installed Android build renders Google test creatives and records the corresponding SDK callbacks. The later device trace above confirmed the additional UNKNOWN/true status-rejection bug and its repair; dashboard configuration and downstream fill must still be verified separately.

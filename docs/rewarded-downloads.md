# Rewarded ads for all current PDF downloads

Production rewarded unit: `ca-app-pub-1505001993402465/9710408715`. Development/preview uses SDK 16.3.4's official `TestIds.REWARDED`; no existing app/unit IDs were changed.

The in-app download search found two user actions: CV Maker's PDF and the completed official Z83 PDF. Both now use the same explicit opt-in rewarded flow. Employer-site links, Apply, signing fields and saving drafts are not download-ad triggers.

## User flow

1. The existing form validation runs first. Incomplete Z83 confirmation can be cancelled without requesting/showing a rewarded ad; CV still requires a name.
2. When native ads and consent permit an offer, the action says **Watch ad & download PDF/Z83**, with a plain completion/fallback explanation. Unsupported/denied paths keep the normal Download action.
3. Inventory is preloaded on the download screen; no ad shows merely from entering it. A tap attempts a ready rewarded ad through `RewardedAd.createForAdRequest`, using the shared consent request-options helper and full-screen lock/gap.
4. Only `RewardedAdEventType.EARNED_REWARD` earns the download. LOADED (which includes reward metadata) is not completion. The PDF workflow starts only after the ad closes. Closing early cancels that attempt and preserves the form.
5. No SDK, denied consent, disabled format, unavailable inventory, no-fill, an existing full-screen lock/gap, load/presentation failure or timeout uses a free-download fallback. The file is never permanently held behind an unavailable ad. No automatic presentation occurs after a late load.
6. An earned credit stays in JS memory until `savePdfToDownloads` succeeds. A PDF, network, directory-picker or save failure can retry without watching another ad. Credit is not persisted across a killed/restarted JS runtime. No document content, names, IDs or profile data are sent with ad requests.

Both screens use tap locks across validation/ad/PDF saving, preventing duplicate requests/files. Leaving a screen during the ad prevents its late completion from starting a download on the old screen. Buttons grow/wrap rather than clipping the longer opt-in label.

## Reliability and boundaries

- Uses the existing lazily gated SDK. Expo Go/web/iOS do not evaluate the native SDK or show rewarded ads; downloads retain the no-ad path.
- Permission/initialization gating is unchanged. No consent or refusal bypass, personalization change or audience tags were added.
- Shared full-screen coordination prevents overlap with app-open/interstitial formats. The existing 60-second post-close gap can make a download use the free fallback after another ad.
- Rewarded load timeout: 10s, with bounded 5/15/45s retry backoff. A later explicit prepare/tap can resume after exhaustion. Requests do not wait for a load before falling back.
- Missing OPENED timeout: 1.5s. Presentation safety timeout: 120s. Terminal paths resolve once and release listeners/timers/lock. Successful earned credits are honored after failures; no SDK-earned event is fabricated.
- There is no added backend, currency, server reward grant, new dependency or native configuration change. The installed SDK package already registers its rewarded native module.

## Changed files

| File | Change |
|---|---|
| `src/ads/config.ts` | Adds the supplied production rewarded unit, official test selection and enforced reward policy. |
| `src/ads/rewarded-manager.ts` | Shared load/show/reward state, cleanup, bounded recovery, lock and in-memory earned credit. |
| `src/ads/useRewardedDownload.ts` | Explicit download opt-in, cancellation/unmount handling and successful-save acknowledgement. |
| `src/ads/useRewardedDownload.web.ts` | Native-free normal web download path. |
| `src/ads/AdMobLifecycle.tsx` | Includes the rewarded flag/unit mode in development diagnostics. |
| `src/app/cv-maker.tsx` | Gates the existing validated PDF/save flow and discloses the opt-in action. |
| `src/app/z83.tsx` | Gates the existing official-form download after validation/confirmation. |
| `scripts/test-ads.cjs` | Reward lifecycle/fallback/credit tests plus actual CV/Z83 handler tests with isolated ports. |
| `scripts/test-expo-go.cjs` | Test/prod unit selection, unsupported boundaries, hook completion/cancellation/unmount coverage. |

PDF generation, Z83 coordinates/template content, filenames, Downloads/SAF handling, CV AI, account/profile/backend logic and existing ad policies/placements are otherwise unchanged.

## Checks performed

- `npm run test:ads`: **89 pass**. Includes earned-before-close ordering, early cancellation, error/rejected/throwing show, both presentation timeouts, bounded load recovery, consent/disabled paths, shared lock/gap, credit retention and reset. Actual screen handlers are executed against fake PDF/network/storage ports to verify validation order, cancelled attempts, duplicate taps and consume-only-after-save.
- `npm run test:expo-go`: **17 pass**, retaining existing unsupported-platform tests and verifying official rewarded test selection plus hook completion/cancellation/unmount behaviour.
- TypeScript and focused lint pass. CV screen lint has zero findings; Z83 retains its one existing finding, compared to the parent after normalizing shifted lines. No dependency changes.
- Android and web JS exports pass; the existing missing-iosAppId plugin warning remains. This does not enable native iOS ads.
- No real ad requests, impressions, clicks, private documents or backend writes were generated during verification. Mocks/JS exports do not establish live ad rendering, revenue or compliance.

## Device/AdMob checks

No new development-client binary is needed: these APIs/modules already ship in SDK 16.3.4. Pull `ads-revenue-fix`, reload the development client and use official test creatives. Verify CV and Z83 validation, opt-in disclosure, completion then actual saved PDF, early close, no-fill, directory cancellation/retry, unmount, large-text layout and shared-gap fallback.

For production, confirm this supplied unit is a **Rewarded** unit (not rewarded-interstitial) and active in AdMob. Existing release builds select it with test mode off. Optionally set the dashboard reward description to the corresponding digital download. No dashboard configuration or store release was performed here. Test ads earn no revenue.

Rollback: set `ADS_CONFIG.rewarded.enabled` to false; both download actions then follow the normal no-ad path. Other ad formats are unaffected.

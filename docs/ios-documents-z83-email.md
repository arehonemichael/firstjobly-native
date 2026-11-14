# iOS documents, Z83 reuse and government email handoff

Branch: `fix/ios-documents-z83-email`, based on `feat/account-deletion-email-code`. No backend/schema change, real application/email, EAS build, submission or deployment was performed. Ads and tab/navigation configuration are unchanged.

## Causes and changes

- Profile documents previously opened signed web URLs, with no explicit native export. The iOS action now obtains a fresh private Storage signed URL, downloads a local file, validates it and opens the system share sheet. A single GET retry renews a 401/403 expired link. Ownership is checked before download and presentation. Existing CV/Word/image extensions, MIME/UTI and clear document-kind filenames are preserved. PDFs are parsed with the existing lazy-loaded pdf-lib; empty, damaged or password-protected PDFs fail with a recoverable message.
- The PDF saver could silently keep circular/application Z83 files in the app Documents directory; it did not establish a user-visible Files copy. All iOS generated PDF saves now use a temporary named export copy and the system share sheet's **Save to Files** route. The user selects an available Files provider/location. The app does not enable public access to its private Documents directory or invent a public Downloads path. Profile open/export uses the same route on iOS. Android keeps the existing SAF/Downloads and viewer behavior.
- `expo-sharing.shareAsync` returns void and exposes one file URL, not a destination or save/cancel result. Wording therefore says export options closed/check Files if saved; it never claims a successful Files save from a cache file or sheet opening. Temporary export copies remain until the sheet resolves and then are removed. Generated standalone sources are cleaned after handoff/failure; circular application sources stay available until that application finishes/leaves/signs out. External Files copies belong to the user and are not removed by app cleanup.
- Government email previously treated `MailComposer.isAvailableAsync() === false` as no mail app being set up. On iOS this only tests Apple's configured native composer. The new flow distinguishes composer capability from installed clients/default mailto support and keeps copy/save options available.
- Z83 restoration used a device-wide AsyncStorage draft that retained job identifiers and some personal information. It also defaulted the declaration date and derived initials. That draft is no longer imported, is removed when Z83 opens, and no Z83 answers are auto-written to AsyncStorage. Fields now load from verified own-profile sources plus explicitly remembered secure details. New applications start with only their selected job's reliable metadata; initials/signature/declaration date are blank. Changing job identity also clears signing details. Each application requires an explicit review switch, invalidated by edits, before PDF generation.

## Z83 field sources and separation

| Fields | Source and rules |
| --- | --- |
| Full names, DOB, email/phone/address | Existing own `profiles` fields used by the current Profile screen. ISO DOB is formatted DD/MM/YYYY. No identity-number-derived DOB. |
| Availability/current study | Only explicit `available_immediately=true`, or `currently_studying=true` with supplied institution/study text. Missing/false does not invent notice periods or course details. |
| Language names | Existing profile language list; speaking/writing proficiency stays blank unless explicitly entered and remembered. No default preferred language or correspondence method. |
| Qualifications, employment | Existing institution/qualification/year and own work_experience rows. User-entered remembered rows/proficiency/reasons take precedence. Template capacity: four qualifications, three employment rows, three references, five languages. |
| ID/passport, race/gender/disability, citizenship/nationality/work permit | Only explicitly entered and consented remembered Z83 values; no guessed profile/equity columns, name/ID/phone inference or defaults. Blank/prefer-not-disclosed choices stay blank. |
| Disclosures, state-business answers, experience totals, registration details, references | User-entered values only, optionally remembered securely. They remain editable and require review each time. |
| Post/department/reference | Current selected `detail.job` fields only; missing reference stays blank. Never restored from reusable storage. Manual normal Z83 starts blank. Existing server prefill is filtered through `safePrefill`; uncontracted Section B data is not trusted. |
| Initials, signature, declaration date, review confirmation | Never remembered or inferred. User supplies/reviews them per application. No automatic date or signing. Generated PDFs are immutable snapshots; later profile/saved-detail edits do not rewrite them. |

### Explicit secure remembering

**Remember reusable details securely** asks for explicit consent, naming identity/equity/medical/disclosure data. Updating saved details is an explicit action, not background autosave. **Forget remembered details** removes the account's secure record without clearing the current form. Missing/unavailable profile or secure storage leaves a manual form and a recoverable notice; loading is bounded, and late responses cannot overwrite another form/account or edits made while a manual profile refresh was pending.

Remembered data uses the already-installed Expo SecureStore: OS Keychain/Keystore, iOS WHEN_UNLOCKED_THIS_DEVICE_ONLY, small UTF-8 chunks under 1.2KB and a per-account manifest with two fixed slots. Writes are serialized; partial writes preserve the previous committed record. Fixed slots allow forgetting/confirmed-deletion cleanup even after an interrupted/corrupt manifest. There is no plaintext/web fallback. Web can prefill known profile data but cannot remember sensitive answers.

Records intentionally survive app restarts and a later sign-in to the same account. Another account cannot read them through this flow. iOS Keychain may survive uninstall; use Forget or confirmed account deletion to remove remembered details. Confirmed deletion also clears the new secure record; a secure cleanup failure does not prevent the other owner-file cleanup steps and offers the existing cleanup-only retry.

CV drafts now use owner-scoped versions of the existing draft/template keys. Legacy ownerless CV drafts are not imported, and guests do not persist a new shared draft. The confirmed owner-deletion cleanup removes the scoped keys. This prevents a different account inheriting a previous CV during export.

## Email paths and limitations

1. **Configured Apple Mail composer / Android intent:** validate local PDFs, pass the exact selected application recipient, required subject/reference, editable message and CV/Z83 plus selected supporting PDFs. The user reviews and sends. Saved-draft/cancelled results do not mark sent. Android does not reliably distinguish cancellation; the app still requires explicit user confirmation.
2. **Other installed iOS clients:** Expo's native `getClients()` reports queryable apps. The existing expo-mail-composer config plugin supplies schemes including Gmail, Outlook and other SDK-known clients. Named buttons open only discovered/available apps. These are inbox launches, with explicit instructions to paste details and attach saved files manually; no unsupported attachment/prefill promise is made.
3. **Default email app:** encoded mailto preserves recipient, subject and editable message. It never includes an attachment parameter or promises attachments. The user adds Files copies manually. Capability is checked; installed/default options refresh on return to the app.
4. **System share/Files:** Save/share each PDF separately. Compatible mail targets may appear; the sharing API cannot prefill recipient/subject reliably or export multiple URLs together. Copy email/subject/message controls are shown before handoff, and the page explains manual steps.
5. **No usable target:** application details, copy controls and document saves remain available. No dead-end “No mail app set up” assumption, automatic send or automatic Applied status. Handoff/cancellation/return is not delivery. Only the existing explicit **Yes, I sent it** action records the user's confirmation.

Up to four supporting PDFs (5MB each) can be selected. Application memory owns these cache copies, validates them, and cleans them on replacement, finish or owner/session removal. They are not uploaded to a guessed backend endpoint. Returning from export/mail keeps the application files available for the remaining steps.

## Files changed

- `src/lib/save-pdf.ts`, new `src/lib/document-export.ts`, Profile documents and CV/Z83 screens: validation, native export, honest wording, ownership and temporary cleanup.
- New `src/lib/z83/{reusable,secure-store,saved}.ts`, existing types and account cleanup: field allowlists, source mapping, secure opt-in persistence and blank per-application declarations.
- `src/lib/circular/{io,io.web,email-contract,state}.ts` and application screen: mail capability/fallback paths, copy/body controls, supporting-file lifetime and honest confirmation.
- `app.json`: existing mail-composer plugin and iOS query schemes; iOS build number 5. Android version code remains 34. No new dependency or ad settings.
- Document/unit/browser regression scripts and this report. Existing test expectations were updated for the intentional export/review behavior; ad cancellation, duplicate-tap and reward-credit checks remain.

## Verification and limits

- 424 Node tests pass, including secure-store chunking/consent/recovery/owner isolation, reused fields/job/declaration separation, full PDF validation, mailto encoding, Apple Mail/Gmail/no-target ports, draft/cancellation and supporting-file cleanup. Existing Android SAF/viewer and rewarded-generation checks pass.
- 126 isolated Gov Jobs browser checks, a dedicated document-form/isolation browser scenario and 13 deletion browser scenarios pass. Backend/auth traffic is intercepted; no real applications or emails were sent. The form scenario checks profile/DOB prefill, no legacy job/declaration import, editing invalidates review, no plaintext Z83 answer in localStorage, and account/CV-draft isolation.
- Generated two fixture Z83 PDFs using the real public official template; reopened both with pdf-lib and extracted text with pdftotext. Separate REF-A/REF-B remained separate; rendered page 1 was visually inspected with synthetic data. Generated a one-page CV PDF from the existing HTML using Chromium and reopened/extracted fixture text. This validates document content in the test environment, not native Expo Print or Files reopening on an iPhone.
- Typecheck and focused new-module lint pass. Repository lint retains 8 pre-existing errors (including the old Profile documents effect/purity findings); warnings are 15, versus 16 before this work. Expo Doctor remains 20/21 with existing SDK patch mismatches. No dependency upgrade is bundled.
- Both iOS/Android JS exports and no-install iOS prebuild pass. Generated Info.plist contains mailto, googlegmail and ms-outlook queries and CFBundleVersion 5.
- **Native verification blocked:** no iPhone/iOS simulator/Xcode or attached Android device is available here. Actual Files provider selection/cancellation/reopening, native Expo Print, Keychain behavior, mail-client discovery/attachment acceptance, keyboard/signature drawing and OS return/cancellation must be tested on installed builds. Do not interpret browser/native-port mocks as proof these passed. No real employer messages or member documents were used.

## Rebuild and test (PowerShell)

An iOS rebuild is required for the new query-scheme configuration. Existing installed libraries already provide export, mail, picker and secure storage; no new dependency was added. Build 5 is prepared. Do not deploy automatically.

```powershell
git fetch origin
git switch fix/ios-documents-z83-email
git pull --ff-only
npm ci
npm run typecheck
npm run test:documents
npx eas-cli@latest build --platform ios --profile preview
```

Preview is the existing internal/test-ad profile for a registered physical iPhone. For a development client instead, use the existing development profile, then `npx expo start --dev-client -c`. This workspace did not start a remote build or submit anything to Apple.

On-device checklist: existing PDF and Word CV export; generated CV/Z83 Save to Files and reopen; cancel; expire a signed link; remember/edit/forget details; change accounts; use two jobs without stale metadata/signing; configured Apple Mail; Gmail/Outlook without configured Apple Mail; no usable target; verify copied recipient/reference/body and all manually/automatically attached PDFs; cancel/return without a false Applied status. Use synthetic documents and owner-approved test accounts only, never real applications.

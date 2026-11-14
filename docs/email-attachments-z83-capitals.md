# Application email handoff and Z83 block capitals

Branch: `feat/email-attachments-z83-capitals`, based on `fix/ios-documents-z83-email` (PR #27).

## Behavior

The Government Jobs email action previously used Apple Mail's composer, with inbox-only Gmail/Outlook links and one-file manual exports when Apple Mail was unavailable. A `mailto:` link cannot attach documents.

On a new iOS binary, **Choose email app — attach all PDFs** now presents a public UIKit activity sheet with the generated Z83, selected CV, and every selected supporting PDF together (maximum four supporting PDFs). It supplies the exact existing application subject and a short, editable job-specific message. The user selects a compatible installed email extension. Targets decide whether to accept subject/message; arbitrary extensions expose no recipient-setting API, so the address remains visible with an explicit Copy action and review guidance. The chooser may also offer other compatible share activities. No private APIs, URL file attachments, or sending/delivery claims are used.

Apple Mail's existing composer remains the fallback for old installed binaries. Existing manual save/copy actions remain available. Android retains its existing multi-attachment email composer. Cancellation and failures preserve the source PDFs for retry. An application is recorded sent only after the user's separate explicit confirmation.

An optional saved-document picker reads the existing owner-filtered `user_documents` fields already used in Profile, and lets users choose saved profile PDFs without uploading again. Each selection downloads through a fresh 60-second private `documents` storage URL, validates the PDF and size, checks application ownership, and keeps only an application-owned temporary copy. One expired-link GET retry is allowed. Only explicitly selected documents are attached; profile documents are not silently added. Existing CV/supporting selection from the phone remains available. Supporting files remain PDF-only, as before.

Z83 free-text input uses block capitals; final PDF rendering enforces capitals even for older mixed-case saved answers. Names use surname then given names separated by spaces (`GUNDULA AREHONE`), stripping the old comma. Live editing preserves a trailing space so users can type multiword names. Enum values, drawn signature image bytes, consent, job-specific declarations, and rewarded-download behavior are preserved.

## Files

- `modules/firstjobly-mail/`: small Apple-only Expo module using `UIActivityViewController`, public `UIActivityItemSource` subject API, readable local file checks, iPad popover anchor, presentation lock and completion/cancellation handling.
- `src/lib/circular/mail-share.ts`: optional module lookup for old-binary compatibility.
- `src/lib/circular/io.ts` and `.web.ts`: grouped iOS handoff, selected saved-PDF preparation, web guidance.
- `src/components/circular/saved-application-documents.tsx`: explicit per-account saved PDF selection and recoverable loading failure.
- `src/app/circular-jobs/apply.tsx`: chooser action, short editable message, saved profile documents and honest platform guidance.
- `src/lib/z83/format.ts`, `reusable.ts`, `fill.ts`, `src/app/z83.tsx`: block capitals and surname-first names without commas.
- `app.json`: iOS build number 6; new native binary required.
- Document/circular regression fixtures and tests updated for the new formatting and native port.

## Verification

- TypeScript: `npx tsc --noEmit` passed.
- Targeted ESLint on all changed app/library/component TypeScript files: passed, no errors or warnings.
- Complete Node suite: **431 tests passed**. New tests cover all six PDFs in one payload, exact subject/body, cancellation/failure preservation, stale ownership, invalid PDF rejection, optional-module fallback, fresh/retried profile document download, partial-copy cleanup, legacy/name input normalization and every actual PDF text drawing call in capitals.
- Isolated Chromium: document/profile/account-isolation scenario plus **127 Government Jobs browser checks passed**, using intercepted synthetic auth/backend responses. No real application/email was submitted.
- iOS production JavaScript/Hermes export passed.
- No-install iOS prebuild passed. Expo Apple autolinking resolves `FirstJoblyMailModule` and its local pod correctly.
- `git diff --check` passed.

This Linux workspace has no Xcode/iPhone: the new Swift module has not been compiled by Xcode or exercised with actual Gmail/Outlook/Apple Mail extensions here. EAS/device verification is still required. No backend, ads, account/auth rules, or deployed app were changed.

## Install the new iPhone test build (PowerShell)

```powershell
git fetch origin
git switch feat/email-attachments-z83-capitals
git pull --ff-only
npm install
npx eas-cli@latest build --platform ios --profile preview
```

Open the completed build's EAS page in Safari on the already registered iPhone, tap Install and replace the previous preview build. If EAS says the phone is not registered, use `npx eas-cli@latest device:create`, complete registration in Safari, then rebuild. Metro is not needed for the preview build. A JS reload alone cannot add this native module.

On-device checks: choose Gmail/Outlook/Apple Mail with Z83+CV and four selected supporting PDFs; inspect exact subject/body and every attachment, paste copied recipient if needed, cancel and retry, test Apple Mail unavailable/no email extension, rotate/use an iPad, save a Z83 and inspect all text and name spacing. Use a test recipient for an intentional sending check. Verify Android's existing chooser still includes all selected PDFs.

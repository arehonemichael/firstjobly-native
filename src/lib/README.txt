FIRSTJOBLY NATIVE EASY APPLY + APPLICATIONS

This package:
- adds src/lib/apply-gate.ts
- adds src/app/applications.tsx
- replaces src/app/jobs/[id].tsx

It follows the website rules:
- Easy Apply requires sign-in
- minimum profile completion: 50%
- CV is always required
- Matric certificate is additionally required for government jobs or jobs that explicitly name Matric / Grade 12
- supports cover note
- supports Save as draft
- writes to the same applications table
- My Applications reads the same applications + application_status_history tables
- external application links still open the employer site

After copying:
1. npx tsc --noEmit
2. reload the app
3. Test an Easy Apply job
4. Open /applications after submission

NOTE:
The website also triggers its server-side employer notification after a successful Easy Apply.
This mobile package saves the application into the same backend, but the employer-notification
server action still needs to be exposed to the native client safely. Do not put email/provider
secrets in the app.

# FirstJobly startup motion

## Assets and presentation

The opening reuses `assets/images/icon.png` (the actual pink/navy FirstJobly icon),
the existing FirstJobly wordmark, Plus Jakarta Sans, brand tokens, and the existing
“Your next step into work”, “Jobs, internships and learnerships”, and session
“Did you know” content. The interface now consistently uses the established sans-serif family. The unused
Expo sample splash icon/AnimatedIcon templates are not activated. No new identity,
placeholder jobs, letter animation, music, sound, or animation dependency is added.

The logo fades from 0 to 1 with restrained 0.94 → 1 scale over 480 ms. The wordmark
and existing copy follow with an 8 px rise/fade (160 ms offset, 440 ms duration),
and the existing fact card fades in last. The full entrance can settle in about
800 ms, but it never establishes a minimum loading duration. Once settled, the
screen stays quiet with an indeterminate loading announcement; it does not loop.
A clean 140 ms crossfade connects to the routed screen rather than attempting a
fragile shared-logo geometry transition to different headers.

Reduced motion uses static logo/copy and near-instant entry. Motion preference
resolution defaults safely to reduced motion if its API fails or stalls. Animated
values are transform/opacity only, with the native driver on native platforms.
Timelines, exit deadlines and accessibility subscriptions are cleaned up. If an
animation start fails, branding settles immediately; if exit frames/callbacks
never arrive, a 220 ms readiness-only watchdog removes the overlay.

## Real readiness and failure behavior

Authentication restoration and font loading start immediately, alongside the
opening. All `useAuth()` callers share one app-scope auth store and SDK event
subscription; route mounts do not each restore a session. Readiness requires a
resolved session (which may genuinely be signed out) and settled fonts. Fast
launches skip unfinished reveal work; reduced motion or readiness before motion
starts removes the overlay directly. No jobs, images, profile completion,
optional API, permission prompt or recommendation request gates launch.

An auth rejection/error never grants entry as an assumed guest: startup shows a
recoverable error and Retry startup. An unresolved auth request reaches that error
after 10 seconds. Retrying starts a fresh generation, deduplicates repeated taps,
and rejects stale results. During restoration, SDK initial/signed-out events
cannot race ahead of the actual getSession result. The SDK may itself discard a
revoked refresh token during initialization and then return a genuinely resolved
signed-out state; that case uses the existing screen's sign-in recovery.

Fonts that reject fall back immediately; stalled fonts stop blocking after four
seconds. The splash uses a system face until the existing fonts are available.
An optional logo error leaves the wordmark/message usable and cannot block entry.
Page skeletons, errors and retries handle nonessential data after entry.

## Routing and accessibility

The existing Stack stays mounted from the first branded frame. Startup never
calls `router.replace('/')` or substitutes Home for the initial route. Job deep
links, auth return parameters and the existing protected-screen sign-in prompts
remain in control. Home is only the normal default. No dedicated onboarding
route or launch-time onboarding gate existed in the inspected app; none is
invented, bypassed or removed here. Existing signup/profile flows are unchanged.

Until startup completes, the routed shell is visually hidden as needed,
noninteractive, excluded from native accessibility, and `inert` on web. A failed
restore retains the gate and offers a keyboard-accessible retry control. The
launch overlay is unmounted completely on completion; it cannot remain as an
invisible touch/focus blocker. A memory-only completion latch prevents replay
across navigator-driven root remounts, route/tab changes, token events and brief
focus/background returns. A cold JS/document launch gets a fresh opening.

## Native and web handoff

`app.json` configures the existing `expo-splash-screen` plugin with the real icon,
72 dp image width and the same `#F6F7F9` background as the currently light app,
including system dark preference. This preserves the app's existing light theme;
it does not introduce a dark palette. Native launch screens stay static. The
root calls preventAutoHideAsync at module scope, then hides the OS splash when
the first branded in-app layout is ready. This handoff does not wait for fonts
or network. It uses layout directly, avoiding a cancellable frame callback that
could be lost during development Strict Mode cleanup.

This project exports a single-page web shell. `public/index.html` therefore adds
the same critical background before JavaScript or external CSS downloads (a
`+html.tsx` document would not apply to this output mode). Existing global CSS
continues that background after hydration. No service-worker behavior is changed.

## Files and checks

Product changes are in `app.json`, `public/index.html`, `src/app/_layout.tsx`,
`src/components/launch-splash.tsx`, `src/hooks/use-auth.ts`,
`src/lib/auth-session-store.ts`, and `src/hooks/use-reduced-motion.ts`.

- `npm run test:startup` covers fast/slow restoration, shared initialization,
  errors, timeout, retry, auth events, sign-out races, stale results and teardown.
- `APP_URL=http://localhost:8784 node scripts/verify-startup.cjs` runs isolated
  Playwright checks for actual motion/readiness, signed-in/out states, deep links,
  reduced motion, small/desktop layouts, revoked credentials, timeout/retry, focus,
  cold relaunch, missing animation frames, delayed jobs, offline responses, stalled
  fonts, failed fonts/logo and login return destinations. The HTTP fixtures exercise
  real app code and Supabase SDK; they do not use production account data/writes.
- Existing UI, Home hero, navigation and personalization suites remain relevant.
  The UI sign-in test now waits for a non-inert shell before filling inputs,
  matching when a real user can type, rather than merely waiting for DOM nodes.
- TypeScript, focused ESLint, Expo web/Android JavaScript exports, and resolved
  native splash-plugin config are checked. Native exports are not APK/device tests.

## Remaining device verification

The native OS launch screen needs a new binary; clearing Metro alone cannot update
it. Expo SDK 57 documentation notes that Expo Go/development builds cannot fully
replicate standalone launch-screen behavior. Build and install the existing APK
preview profile with `npx eas-cli build --platform android --profile preview`, then
check cold starts, Android system splash handoff, TalkBack/reduced motion and real
background/resume behavior on-device. No EAS build, store release or backend
change was performed here. Browser tests can verify the in-app motion and web
shell background, but cannot prove the absence of an OS-specific native flash.

Verified in this workspace: 10 startup unit checks and 40 startup browser checks
passed; existing 211 UI, 52 Home hero browser, 16 personalization browser, 29
recommendation unit/query-client, 9 hero unit and 5 navigation checks passed.
TypeScript, focused lint and web/Android JavaScript exports passed. Full-source
lint retains 13 pre-existing errors and now has 19 warnings (one fewer than the
prior baseline). No production auth/account writes or native release/device
verification were performed.

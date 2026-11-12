# Restore Home's session image and messages

## Cause and provenance

The image/message hero was absent from the rewritten Home component. This branch
also had no `assets/images/hero` directory, so neither authentication nor a retry
could make the old block appear. `session-fact.ts` still selected a fact for the
launch splash, but Home did not consume any session hero content.

The working historical implementation is preserved at `6408b9b` (with the seven
photo references finalized in `71027f3`). The local-photo migration is `a87baa2`,
and the additional photos were added in `82398e8`. All seven original PNG files
are restored byte-for-byte; no replacement imagery was generated or downloaded.
The four original headlines and full 24-entry fact bank are restored too.

An early revision (`9a5b2c6`) paired three headlines with selected facts. The later
bundled-photo implementation explicitly replaced that with independent image,
headline and fact draws (`ba90430`, retained through `6408b9b`). There is no fixed
seven-photo pairing map in that working implementation. This fix follows that
later behavior rather than inventing one: it stores the resulting image/headline/
fact group atomically, so the combination never changes partway through a session.

## Focused implementation

- The hero sits below the current Home introduction, before the account overview
  and job listings—the original introductory position relative to the listings.
  The current header, circular navigation, overview, job cards and actions remain.
- The original photos, headline copy, facts and dark readability scrim are used.
  Text wraps without a fixed maximum card height. The CTA opens the existing job
  search; it does not claim that the current chronological feed is personalized.
- A memory-only store sits above route mounts. Root auth hydration establishes the
  owner before choosing content, so both visitors and returning accounts load it.
- One selection lasts for the running app session, including route changes,
  Home remounts, foreground/focus events and same-user token refreshes. A cold JS
  launch or a guest/account transition selects again. Repeats are allowed.
- No AsyncStorage or account persistence, timers, job/profile request dependencies,
  new API calls, permissions or dependencies are introduced.
- Photo loading leaves the selected messages readable. An image error removes
  only the image and uses the navy background, retaining the same copy and CTA.
  It never silently swaps to another photo/message pair. A pending auth snapshot
  has an accessible loading state.

## Verification

- `npm run test:home-hero`: nine unit tests cover exact historical photo hashes,
  content availability, selection bounds, atomic combinations, guest/returning
  hydration, consumer remounts, refreshes, account transitions, repeated choices,
  new app stores and listener cleanup.
- `npm run test:navigation`: the existing five routing/geometry tests pass.
- `npm run typecheck`: passes.
- Focused ESLint for the new component, hook, selector, content and test scripts
  passes. Existing unrelated full-source lint findings are outside this fix.
- All 52 checks in `node scripts/verify-home-hero.cjs` pass against an exported
  web build, verifying new
  and returning sessions at 320px, 390px and desktop widths; actual bundled photo
  loading; image/message stability through Home navigation and focus; historical
  placement; and delayed/failed image behavior without production account calls.
- All 211 checks in the existing `scripts/verify-ui.cjs` suite pass for Home, navigation,
  saving, draft resumption and sign-in return behavior with isolated responses.
- Production web and Android Hermes exports validate static inclusion of all seven
  restored images. Bundle export is not a physical-device test. The existing iOS
  AdMob app-ID warning is unchanged.

Run the optional browser check against a local Expo/web server:

```sh
APP_URL=http://localhost:8081 node scripts/verify-home-hero.cjs
```

It accepts the same `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `SCREENSHOT_DIR`
options as the existing browser suite. Test sessions and backend responses are
isolated; the tests make no production account writes.

// Optional Playwright checks against an exported web app. All auth/data traffic
// is intercepted; no production accounts, credentials or writes are used.
const { Buffer } = require("node:buffer");
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { backend } = require("./personalization/backend.cjs");
const { uid, job } = require("./personalization/fixtures.cjs");
const base = process.env.APP_URL ?? "http://localhost:8784";
const screenshots = process.env.SCREENSHOT_DIR;
function session(expired = false) {
  const user = {
    id: uid.alice,
    email: "candidate@example.test",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {},
    app_metadata: {},
    created_at: "2026-01-01",
  };
  const expires_at = Math.floor(Date.now() / 1000) + (expired ? -600 : 3600);
  return {
    user,
    access_token: `e30.${Buffer.from(JSON.stringify({ sub: uid.alice, exp: expires_at })).toString("base64url")}.fixture`,
    refresh_token: "fixture",
    expires_at,
    expires_in: expired ? -600 : 3600,
    token_type: "bearer",
  };
}
const gate = () => {
  let release;
  const promise = new Promise((r) => (release = r));
  return { promise, release };
};
let checks = 0;
function check(v, label) {
  assert.ok(v, label);
  checks++;
  console.log("PASS", label);
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  async function setup({
    signedIn = false,
    slow = false,
    reduced = "no-preference",
    width = 390,
    height = 844,
    authGate = null,
    authFailure = false,
    jobGate = null,
    fontGate = null,
    fontFailure = false,
    imageFailure = false,
    offline = false,
    stalledAnimation = false,
  } = {}) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: reduced,
    });
    const b = backend(),
      stats = {
        refresh: 0,
        authReleased: 0,
        imageFailures: 0,
        fontFailures: 0,
        errors: [],
      };
    await context.addInitScript(
      (s) => {
        if (s)
          localStorage.setItem(
            "sb-ehwqqjqtevppsnmxximg-auth-token",
            JSON.stringify(s),
          );
        window.__launch = {
          mounts: 0,
          first: null,
          ready: null,
          removed: null,
          samples: [],
        };
        let seen = false,
          done = false;
        new MutationObserver(() => {
          const shell = document.querySelector(
            '[data-testid="application-shell"]',
          );
          if (
            shell?.getAttribute("data-startup-ready") === "true" &&
            window.__launch.ready == null
          )
            window.__launch.ready = Date.now();
        }).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-startup-ready"],
        });
        const sample = () => {
          const splash = document.querySelector(
            '[data-testid="launch-splash"]',
          );
          if (splash) {
            if (!seen) {
              seen = true;
              window.__launch.mounts++;
              window.__launch.first = Date.now();
            }
            const logo = document.querySelector('[data-testid="launch-logo"]'),
              copy = document.querySelector('[data-testid="launch-copy"]');
            if (logo && copy)
              window.__launch.samples.push({
                at: Date.now(),
                logo: Number(getComputedStyle(logo).opacity),
                scale: getComputedStyle(logo).transform,
                copy: Number(getComputedStyle(copy).opacity),
                move: getComputedStyle(copy).transform,
              });
          } else if (seen && !done) {
            done = true;
            window.__launch.removed = Date.now();
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      signedIn ? session(slow) : null,
    );
    if (stalledAnimation)
      await context.addInitScript(() => {
        window.requestAnimationFrame = () => 0;
      });
    if (fontGate || fontFailure)
      await context.route(/\.(ttf|woff2?|otf)(\?.*)?$/, async (route) => {
        if (fontGate) await fontGate.promise;
        if (fontFailure) {
          stats.fontFailures++;
          return route.abort();
        }
        return route.continue();
      });
    if (imageFailure)
      await context.route(
        /\/assets\/assets\/images\/icon\.[^/]+\.png$/,
        (route) => {
          stats.imageFailures++;
          return route.abort();
        },
      );
    await context.route(
      "**/ehwqqjqtevppsnmxximg.supabase.co/**",
      async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.pathname.includes("/auth/v1/token")) {
          stats.refresh++;
          if (authGate) await authGate.promise;
          stats.authReleased = Date.now();
          if (authFailure)
            return route.fulfill({
              status: 400,
              json: {
                code: "refresh_token_not_found",
                error: "invalid_grant",
                error_description: "Fixture restoration failure",
              },
            });
          return route.fulfill({ json: session() });
        }
        if (url.pathname.endsWith("/auth/v1/user"))
          return route.fulfill({ json: session().user });
        if (offline)
          return route.fulfill({
            status: 503,
            json: { message: "Offline fixture" },
          });
        if (
          url.pathname.endsWith("/user_documents") ||
          url.pathname.endsWith("/application_status_history")
        )
          return route.fulfill({ json: [] });
        if (url.pathname.endsWith("/jobs") && jobGate) await jobGate.promise;
        let owner = null;
        try {
          owner = JSON.parse(
            Buffer.from(
              request.headers().authorization.split(".")[1],
              "base64url",
            ),
          ).sub;
        } catch {}
        try {
          const response = await b.fetch(
            `https://isolated.supabase.test${url.pathname}${url.search}`,
            {
              method: request.method(),
              headers: {
                ...request.headers(),
                authorization: owner
                  ? `Bearer token:${owner}`
                  : "Bearer public-fixture-key",
              },
              body: request.postData() ?? undefined,
            },
          );
          return route.fulfill({
            status: response.status,
            body: await response.text(),
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          return route.fulfill({ status: 500, json: { message: e.message } });
        }
      },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(18000);
    page.on("pageerror", (e) => stats.errors.push(e.message));
    return { context, page, stats };
  }
  const splash = (p) => p.locator('[data-testid="launch-splash"]');
  const waitEntry = async (p) => {
    await p.locator('[data-testid="application-shell"]:not([inert])').waitFor();
    await splash(p).waitFor({ state: "detached" });
  };
  // Confirm the initial HTML shell colour independently of JavaScript/CSS.
  {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await context.route(/\.(js|css)(\?.*)?$/, (r) => r.abort());
    await page.goto(base);
    check(
      (await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      )) === "rgb(246, 247, 249)",
      "brand background exists before JavaScript or stylesheet loading",
    );
    await context.close();
  }
  {
    const t = await setup();
    await t.page.goto(base);
    await waitEntry(t.page);
    const launch = await t.page.evaluate(() => window.__launch);
    check(launch.mounts === 1, "one splash instance on fast signed-out launch");
    check(
      launch.ready != null && launch.removed - launch.ready < 450,
      "entry follows actual initialization readiness without a minimum wait",
    );
    check(
      new URL(t.page.url()).pathname === "/" &&
        (await t.page
          .getByRole("tab", { name: "Home", exact: true })
          .getAttribute("aria-selected")) === "true",
      "Home is the default destination",
    );
    await t.page
      .getByRole("button", { name: "See more opportunities", exact: true })
      .click();
    await t.page.waitForURL("**/discover");
    await t.page.goBack();
    await t.page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    check(
      (await splash(t.page).count()) === 0,
      "route changes and focus/resume do not replay the introduction",
    );
    check(t.stats.errors.length === 0, "fast launch has no runtime errors");
    await t.page.reload();
    await waitEntry(t.page);
    check(
      (await t.page.evaluate(() => window.__launch.mounts)) === 1,
      "a fresh document gets one new launch, with no persisted delay",
    );
    await t.context.close();
  }
  {
    const auth = gate(),
      t = await setup({ signedIn: true, slow: true, authGate: auth });
    await t.page.goto(base + "/jobs/" + job(1).id);
    await splash(t.page).waitFor();
    check(
      (await t.page
        .locator('[data-testid="application-shell"][inert]')
        .count()) === 1,
      "unresolved authentication keeps routed content inert",
    );
    await t.page.waitForFunction(() =>
      window.__launch.samples.some((s) => s.logo > 0.99 && s.copy > 0.99),
    );
    check(
      await t.page
        .getByText("Your next step into work", { exact: true })
        .isVisible(),
      "existing message and wordmark reveal while restoration runs",
    );
    check(
      await t.page
        .locator('[data-testid="launch-logo"] img')
        .getAttribute("src")
        .then((s) => s.includes("/assets/images/icon.")),
      "real existing app icon is reused",
    );
    const samples = await t.page.evaluate(() => window.__launch.samples);
    check(
      samples.some((s) => s.logo > 0 && s.logo < 0.99) &&
        samples.every((s) => s.logo >= 0 && s.logo <= 1),
      "logo opacity is restrained and animated",
    );
    check(
      samples.some(
        (s) => s.scale !== "none" && !s.scale.startsWith("matrix(1,"),
      ),
      "logo uses a small transform reveal",
    );
    check(
      await t.page
        .getByRole("progressbar", { name: "Opening FirstJobly", exact: true })
        .isVisible(),
      "slow startup settles on an indeterminate loading state",
    );
    if (screenshots)
      await t.page.screenshot({ path: screenshots + "/slow-launch.png" });
    auth.release();
    await waitEntry(t.page);
    const ended = await t.page.evaluate(() => window.__launch.removed);
    check(
      ended - t.stats.authReleased < 500,
      "ready launch interrupts remaining motion instead of waiting for the introduction",
    );
    check(
      t.page.url().includes("/jobs/" + job(1).id),
      "cold job deep link survives startup",
    );
    check(
      t.stats.refresh === 1,
      "multiple auth consumers share one restoration request",
    );
    check(
      t.stats.errors.length === 0,
      "slow signed-in launch has no runtime errors",
    );
    await t.context.close();
  }
  {
    const auth = gate(),
      t = await setup({
        signedIn: true,
        slow: true,
        authGate: auth,
        reduced: "reduce",
        width: 320,
        height: 568,
      });
    await t.page.goto(base);
    await splash(t.page).waitFor();
    await t.page.waitForFunction(() =>
      window.__launch.samples.some((s) => s.logo === 1),
    );
    const samples = await t.page.evaluate(() => window.__launch.samples);
    check(
      samples.every(
        (s) => s.scale === "none" || s.scale.startsWith("matrix(1,"),
      ),
      "reduced motion has no scaling",
    );
    check(
      await t.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "small-screen splash has no horizontal overflow",
    );
    auth.release();
    await waitEntry(t.page);
    check(
      (await t.page.evaluate(() => window.__launch.removed)) -
        t.stats.authReleased <
        300,
      "reduced motion enters nearly instantly when ready",
    );
    await t.context.close();
  }
  {
    const t = await setup({ signedIn: true, slow: true, authFailure: true });
    await t.page.goto(base + "/saved");
    // The SDK discards a revoked refresh token during its own initialization.
    // getSession then correctly reports a resolved signed-out state.
    await waitEntry(t.page);
    check(
      await t.page
        .getByText("Save jobs for later", { exact: true })
        .isVisible(),
      "revoked session resolves to the existing signed-out recovery screen",
    );
    check(
      await t.page
        .getByRole("button", { name: "Sign in", exact: true })
        .isVisible(),
      "revoked credentials never expose saved account content",
    );
    check(
      t.page.url().endsWith("/saved"),
      "invalid credentials preserve the requested protected destination",
    );
    check(
      t.stats.errors.length === 0,
      "revoked-session recovery has no runtime exceptions",
    );
    await t.context.close();
  }
  {
    const auth = gate(),
      t = await setup({ signedIn: true, slow: true, authGate: auth });
    await t.page.goto(base);
    await t.page
      .getByRole("button", { name: "Retry startup", exact: true })
      .waitFor();
    check(
      true,
      "a hanging authentication request reaches recovery instead of endless splash",
    );
    check(
      (await t.page.getByRole("alert").textContent()).includes(
        "We couldn’t restore your session",
      ),
      "restoration timeout is clearly announced",
    );
    check(
      (await t.page
        .locator('[data-testid="application-shell"][inert]')
        .count()) === 1,
      "unresolved authentication never exposes underlying content",
    );
    await t.page.keyboard.press("Tab");
    check(
      await t.page
        .getByRole("button", { name: "Retry startup", exact: true })
        .evaluate((el) => el === document.activeElement),
      "startup failure leaves a keyboard-accessible retry control",
    );
    auth.release();
    await t.page.waitForTimeout(150);
    await t.page
      .getByRole("button", { name: "Retry startup", exact: true })
      .click();
    await waitEntry(t.page);
    check(true, "timed-out restoration can recover without reloading the app");
    await t.context.close();
  }
  {
    const auth = gate(),
      t = await setup({
        signedIn: true,
        slow: true,
        authGate: auth,
        stalledAnimation: true,
      });
    await t.page.goto(base);
    await splash(t.page).waitFor();
    await t.page.waitForTimeout(350);
    auth.release();
    await waitEntry(t.page);
    check(
      Date.now() - t.stats.authReleased < 1500,
      "missing animation frames/callbacks cannot leave a stuck overlay",
    );
    await t.context.close();
  }
  {
    const jobs = gate(),
      t = await setup({ jobGate: jobs });
    await t.page.goto(base);
    await waitEntry(t.page);
    check(
      (await t.page.getByText("Opportunity 1", { exact: true }).count()) === 0,
      "entry does not wait for job listings or their images",
    );
    jobs.release();
    await t.page.getByText("Opportunity 1", { exact: true }).first().waitFor();
    check(
      true,
      "nonessential listings load after the launch overlay is removed",
    );
    await t.context.close();
  }
  {
    const t = await setup({ offline: true });
    await t.page.goto(base);
    await waitEntry(t.page);
    await t.page
      .getByText(
        "Recommendations are unavailable. Retry or browse job search.",
        { exact: true },
      )
      .waitFor();
    check(
      await t.page
        .getByRole("button", { name: "Browse job search", exact: true })
        .isVisible(),
      "failed optional data requests show page recovery without returning to splash",
    );
    await t.context.close();
  }
  {
    const fonts = gate(),
      t = await setup({ fontGate: fonts });
    await t.page.goto(base);
    await waitEntry(t.page);
    check(true, "stalled fonts fall back after a bounded startup wait");
    fonts.release();
    check(t.stats.errors.length === 0, "font fallback does not crash startup");
    await t.context.close();
  }
  {
    const auth = gate(),
      t = await setup({
        signedIn: true,
        slow: true,
        authGate: auth,
        fontFailure: true,
        imageFailure: true,
        width: 1440,
        height: 900,
      });
    await t.page.goto(base);
    await splash(t.page)
      .getByText("Your next step into work", { exact: true })
      .waitFor();
    await t.page.waitForFunction(() =>
      window.__launch.samples.some((s) => s.logo > 0.99 && s.copy > 0.99),
    );
    check(
      t.stats.fontFailures > 0 && t.stats.imageFailures > 0,
      "font and logo failure paths are actually exercised",
    );
    check(
      await t.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "desktop fallback splash remains responsive",
    );
    auth.release();
    await waitEntry(t.page);
    check(
      t.stats.errors.length === 0,
      "optional image and font failures never block entry",
    );
    await t.context.close();
  }
  {
    const t = await setup();
    const destination = "/jobs/" + job(1).id;
    await t.page.goto(
      base + "/auth?returnTo=" + encodeURIComponent(destination),
    );
    await waitEntry(t.page);
    await t.page
      .getByPlaceholder("you@example.com", { exact: true })
      .fill("candidate@example.test");
    await t.page
      .getByPlaceholder("Your password", { exact: true })
      .fill("fixture-password");
    await t.page.getByRole("button", { name: "Sign in", exact: true }).click();
    await t.page.waitForURL("**" + destination);
    check(
      true,
      "login return destination remains intact through splash and sign-in",
    );
    check(
      (await splash(t.page).count()) === 0,
      "sign-in does not replay the full launch introduction",
    );
    await t.context.close();
  }
  await browser.close();
  console.log(
    `${checks} startup browser checks passed; all auth/data requests intercepted.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

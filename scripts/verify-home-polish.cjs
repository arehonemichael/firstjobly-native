// Real web app, isolated job/logo fixtures. Native AdMob has no web inventory.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { backend } = require("./personalization/backend.cjs"),
  { job } = require("./personalization/fixtures.cjs");
const base = process.env.APP_URL ?? "http://localhost:8792";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = async (f) => {
  for (let i = 0; i < 100; i++) {
    if (f()) return;
    await pause(20);
  }
  throw Error("fixture request did not arrive");
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
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: width === 390 ? 2 : 1,
        reducedMotion: "reduce",
      }),
      b = backend();
    const variants = [
      "wide",
      "tall",
      "transparent",
      "tiny",
      "missing",
      "broken",
    ];
    b.tables.jobs = variants.map((v, i) =>
      job(i + 1, {
        company_name: `Company ${v}`,
        company_logo_url:
          v === "missing" ? null : `https://logos.fixture.test/${v}.svg`,
      }),
    );
    let release,
      hold = true,
      fail = false,
      jobs = 0,
      broken = 0;
    let gate = new Promise((r) => (release = r));
    await context.route("https://logos.fixture.test/**", async (route) => {
      const v = new URL(route.request().url()).pathname.slice(1).split(".")[0];
      if (v === "broken") {
        broken++;
        return route.abort();
      }
      const [w, h] =
        v === "wide"
          ? [240, 60]
          : v === "tall"
            ? [60, 240]
            : v === "tiny"
              ? [8, 6]
              : [120, 120];
      return route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="#061A30" fill-opacity="${v === "transparent" ? ".6" : "1"}"/></svg>`,
      });
    });
    await context.route(
      "**/ehwqqjqtevppsnmxximg.supabase.co/**",
      async (route) => {
        const r = route.request(),
          u = new URL(r.url());
        if (u.pathname.endsWith("/jobs")) {
          jobs++;
          if (hold) await gate;
          if (fail)
            return route.fulfill({
              status: 503,
              json: { message: "Fixture outage" },
            });
        }
        if (u.pathname.includes("/auth/")) return route.fulfill({ json: {} });
        const response = await b.fetch(
          `https://isolated.supabase.test${u.pathname}${u.search}`,
          { method: r.method(), headers: r.headers() },
        );
        return route.fulfill({
          status: response.status,
          body: await response.text(),
          headers: { "content-type": "application/json" },
        });
      },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (width === 390) await page.clock.install();
    await page.goto(base);
    await page
      .locator('[data-testid="application-shell"]:not([inert])')
      .waitFor();
    const brand = page.locator('[aria-label="FirstJobly"]');
    check(
      (await brand.innerText()) === "FirstJobly",
      `complete official spelling at ${width}px`,
    );
    check(
      await page.locator("#home-session-hero").isVisible(),
      `local Home content appears before jobs at ${width}px`,
    );
    check(
      (await page.getByLabel("Loading opportunity", { exact: true }).count()) >
        0,
      `first-load skeletons are limited to the list at ${width}px`,
    );
    hold = false;
    release();
    await page.getByText("Opportunity 1", { exact: true }).waitFor();
    // The provider image component lazily requests offscreen logos.
    await page
      .locator('[data-testid="company-logo"]')
      .nth(5)
      .scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll('[data-testid="company-logo"] img'),
        ).length === 4 &&
        Array.from(
          document.querySelectorAll('[data-testid="company-logo"] img'),
        ).every((i) => i.complete && i.naturalWidth > 0),
    );
    const logos = page.locator('[data-testid="company-logo"]');
    check(
      (await logos.count()) === 6,
      `correct logo/company associations at ${width}px`,
    );
    const image = async (index) =>
      logos
        .nth(index)
        .locator("img")
        .evaluate((img) => ({
          fit: getComputedStyle(img).objectFit,
          w: img.getBoundingClientRect().width,
          h: img.getBoundingClientRect().height,
          nw: img.naturalWidth,
          nh: img.naturalHeight,
        }));
    const wide = await image(0),
      tall = await image(1),
      tiny = await image(3);
    check(
      wide.fit === "contain" && wide.w / wide.h > 3.8,
      `wide logos retain their aspect ratio at ${width}px`,
    );
    check(
      tall.fit === "contain" && tall.h / tall.w > 3.8,
      `tall logos retain their aspect ratio at ${width}px`,
    );
    check(
      (await logos.nth(2).innerText()) === "",
      `transparent logos have no initials showing through at ${width}px`,
    );
    check(
      tiny.w <= tiny.nw && tiny.h <= tiny.nh,
      `tiny logos are not upscaled at ${width}px`,
    );
    check(
      (await logos.nth(4).innerText()) === "CM" &&
        (await logos.nth(5).innerText()) === "CB",
      `missing/broken logos show company initials at ${width}px`,
    );
    check(broken === 1, `broken image is requested once at ${width}px`);
    const face = await brand.evaluate((el) => getComputedStyle(el).fontFamily);
    check(
      face.includes("PlusJakartaSans_600SemiBold") &&
        !face.includes("Editorial"),
      `established sans-serif is used at ${width}px`,
    );
    check(
      await page.evaluate(() => {
        const faces = Array.from(document.fonts).filter((f) =>
          f.family.includes("PlusJakartaSans"),
        );
        return (
          faces.length === 3 &&
          faces.every((f) => f.status === "loaded") &&
          !Array.from(document.fonts).some((f) =>
            /Lora|Editorial/.test(f.family),
          )
        );
      }),
      `actual selected font files load at ${width}px`,
    );
    const largeTextStyle = await page.addStyleTag({
      content:
        '[aria-label="FirstJobly"]{font-size:32px!important;line-height:44px!important}',
    });
    await brand.scrollIntoViewIfNeeded();
    const a = await brand.boundingBox(),
      c = await page
        .getByRole("button", { name: "Search jobs or companies", exact: true })
        .boundingBox();

    check(
      a.x >= 0 &&
        a.x + a.width <= width &&
        (a.y + a.height <= c.y || a.x + a.width <= c.x),
      `larger wordmark does not overlap controls at ${width}px`,
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no horizontal overflow at ${width}px`,
    );
    check(
      (await page.locator('[data-testid="home-ad-placement"]').count()) === 0,
      `unsupported web has no fabricated advertising at ${width}px`,
    );
    await largeTextStyle.evaluate((node) => node.remove());
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/home-loaded-${width}.png`,
      });
    if (width === 390) {
      console.log(
        "CARD_HEIGHTS",
        await page
          .locator('[data-testid="home-job-card"]')
          .evaluateAll((nodes) =>
            nodes.map((n) => Math.round(n.getBoundingClientRect().height)),
          ),
      );
      const pairing = await page.locator("#home-session-hero").innerText();
      await page.clock.fastForward(180001);
      const before = jobs;
      hold = true;
      gate = new Promise((r) => (release = r));
      await page.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      await wait(() => jobs > before);
      check(
        await page.getByText("Opportunity 1", { exact: true }).isVisible(),
        "previous recommendations remain visible during a genuine delayed refresh",
      );
      check(
        (await page
          .getByLabel("Loading opportunity", { exact: true })
          .count()) === 0,
        "background refresh never replaces valid cards with skeletons",
      );
      hold = false;
      release();
      await page
        .getByText("Updating opportunities…", { exact: true })
        .waitFor({ state: "detached" });
      check(broken === 1, "cached refresh does not retry a broken logo");
      check(
        (await page.locator("#home-session-hero").innerText()) === pairing,
        "session hero wording stays unchanged during refresh",
      );
      fail = true;
      await page.clock.fastForward(180001);
      await page.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      await page
        .getByText(
          "Recommendations are unavailable. Retry or browse job search.",
          { exact: true },
        )
        .waitFor();
      check(
        await page
          .getByRole("button", { name: "Browse job search", exact: true })
          .isVisible(),
        "recommendation failure shows explicit recovery rather than an empty feed",
      );
      check(
        (await page
          .getByText("No opportunities yet", { exact: true })
          .count()) === 0,
        "failed recommendations are not disguised as no matching jobs",
      );
    }
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/home-${width}.png`,
        fullPage: true,
      });
    check(errors.length === 0, `no runtime errors at ${width}px`);
    await context.close();
  }
  await browser.close();
  console.log(
    `${checks} Home polish browser checks passed; all account/logo data intercepted.`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

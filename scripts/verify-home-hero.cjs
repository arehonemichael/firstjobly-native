/* Optional Playwright checks against a running web build. No production writes. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { Buffer } = require("node:buffer");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.APP_URL || "http://localhost:8081";
const screenshots = process.env.SCREENSHOT_DIR;
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "returning@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: { full_name: "Returning Candidate" },
  app_metadata: {},
  created_at: "2026-01-01",
};
const session = {
  access_token: `e30.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`,
  refresh_token: "fixture",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  console.log("PASS", label);
  checks++;
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const signedIn of [false, true])
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      if (signedIn)
        await context.addInitScript(
          (value) =>
            localStorage.setItem(
              "sb-ehwqqjqtevppsnmxximg-auth-token",
              JSON.stringify(value),
            ),
          session,
        );
      await context.route("**/*.supabase.co/**", (route) => {
        const table = new URL(route.request().url()).pathname.split("/").pop();
        const data =
          table === "profiles"
            ? { first_name: "Returning", last_name: "Candidate" }
            : [];
        return route.fulfill({
          json: data,
          headers: { "content-range": "*/0" },
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      const hero = page.locator("#home-session-hero");
      await hero.waitFor();
      const capture = async () => ({
        headline: await hero.getByRole("heading").innerText(),
        message: await hero
          .locator('[data-testid="home-session-hero-message"]')
          .innerText(),
        image: await hero.locator("img").first().getAttribute("src"),
      });
      await hero
        .locator("img")
        .first()
        .evaluate((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((resolve, reject) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", reject, { once: true });
              }),
        );
      const first = await capture();
      check(
        first.headline.length > 0 && first.message.length > 0,
        `image/messages available for ${signedIn ? "returning" : "new"} user at ${width}px`,
      );
      check(
        /hero-[1-7]/.test(first.image),
        `historical bundled photo loads at ${width}px`,
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `no overflow at ${width}px`,
      );
      const placement = await page.evaluate(() => {
        const hero = document.getElementById("home-session-hero");
        const title = Array.from(
          document.querySelectorAll('[role="heading"]'),
        ).find((el) => el.textContent === "Latest opportunities");
        const intro = Array.from(
          document.querySelectorAll('[role="heading"]'),
        ).find((el) => el.textContent.includes("Your next step"));
        return (
          !!hero &&
          !!title &&
          !!intro &&
          !!(
            intro.compareDocumentPosition(hero) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ) &&
          !!(
            hero.compareDocumentPosition(title) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        );
      });
      check(
        placement,
        `hero remains below the intro and above listings at ${width}px`,
      );
      await hero
        .getByRole("button", { name: "Search jobs", exact: true })
        .click();
      await page.waitForURL("**/jobs");
      await page.goBack();
      await hero.waitFor();
      assert.deepEqual(await capture(), first);
      check(true, `complete pairing survives Home remount at ${width}px`);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForTimeout(150);
      assert.deepEqual(await capture(), first);
      check(true, `complete pairing survives focus/refetch at ${width}px`);
      check(errors.length === 0, `no runtime errors at ${width}px`);
      if (screenshots && width === 390 && !signedIn) {
        fs.mkdirSync(screenshots, { recursive: true });
        await page.screenshot({ path: `${screenshots}/home-restored.png` });
      }
      await context.close();
    }
  for (const mode of ["slow", "failed"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 1000 },
    });
    await context.route("**/*.supabase.co/**", (r) =>
      r.fulfill({ json: [], headers: { "content-range": "*/0" } }),
    );
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let imageRequests = 0;
    await context.route("**/assets/**", async (route) => {
      if (!/hero-[1-7]/.test(route.request().url())) return route.continue();
      imageRequests++;
      if (mode === "slow") {
        await gate;
        return route.continue();
      }
      return route.abort("failed");
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    const hero = page.locator("#home-session-hero");
    await hero.waitFor();
    const copy = async () => ({
      headline: await hero.getByRole("heading").innerText(),
      message: await hero
        .locator('[data-testid="home-session-hero-message"]')
        .innerText(),
    });
    const first = await copy();
    check(
      first.headline.length > 0 && first.message.length > 0,
      `copy visible with ${mode} image`,
    );
    if (mode === "slow") {
      await page.getByLabel("Loading career photo").waitFor();
      check(true, "loading indicator is available");
      release();
      await hero
        .locator("img")
        .first()
        .evaluate((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((resolve) =>
                img.addEventListener("load", resolve, { once: true }),
              ),
        );
    } else {
      await page
        .getByTestId("home-session-hero-image")
        .waitFor({ state: "detached" });
      check(
        await hero.evaluate(
          (el) => getComputedStyle(el).backgroundColor === "rgb(6, 26, 48)",
        ),
        "failed image has a readable navy fallback",
      );
    }
    assert.deepEqual(await copy(), first);
    check(true, `${mode} image never swaps the messages`);
    check(imageRequests > 0, `${mode} asset request was actually intercepted`);
    check(errors.length === 0, `no runtime error for ${mode} image`);
    if (screenshots && mode === "failed")
      await page.screenshot({ path: `${screenshots}/home-image-fallback.png` });
    await context.close();
  }
  await browser.close();
  console.log(
    `${checks} Home hero browser checks passed; all account/data responses were intercepted.`,
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

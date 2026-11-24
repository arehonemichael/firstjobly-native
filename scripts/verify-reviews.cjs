/* Web UI/link checks only; OS review UI is mocked in unit tests, not exercised here. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://localhost:8860";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      window.__reviewLinks = [];
      window.open = (url) => {
        window.__reviewLinks.push(String(url));
        return null;
      };
    });
    await context.route(/https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) =>
      r.fulfill({ json: [] }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(120000);
    await page.goto(base + "/settings");
    await page
      .getByRole("button", {
        name: "Rate FirstJobly on Google Play",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Rate FirstJobly on App Store",
        exact: true,
      })
      .click();
    assert.deepEqual(await page.evaluate(() => window.__reviewLinks), [
      "https://play.google.com/store/apps/details?id=com.first.firstjobly&showAllReviews=true",
      "https://apps.apple.com/app/id6834798190?action=write-review",
    ]);
    await page.goto(base + "/more");
    await page
      .getByRole("button", {
        name: "Rate FirstJobly on Google Play",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Rate FirstJobly on App Store",
        exact: true,
      })
      .waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS Rate FirstJobly in Settings and More at 360px, correct explicit store links, no real store page opened or browser runtime errors",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

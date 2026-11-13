/* Anonymous navigation check; all backend requests remain isolated. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      reducedMotion: "reduce",
    });
    let calls = 0;
    const errors = [];
    await context.route(
      "**/ehwqqjqtevppsnmxximg.supabase.co/**",
      async (route) => {
        calls++;
        await route.fulfill({ json: [] });
      },
    );
    await context.route("https://firstjobly.co.za/api/**", async (route) => {
      calls++;
      await route.fulfill({ json: { enabled: false } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(120000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      (process.env.APP_URL || "http://localhost:8840") + "/notifications",
    );
    await page.getByText("Weekly job reminders", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("switch", { name: "Weekly job reminders" })
        .isDisabled(),
      true,
    ); // Native-only functionality is honest on web.
    await page
      .getByText(
        /Sunday 19:30 · Monday 06:00 and 19:30 · Thursday 06:00 and 19:30/,
      )
      .waitFor();
    await page.getByText(/Available without signing in/).waitFor();
    await page
      .getByText("Use an iOS or Android native build to enable reminders.")
      .waitFor();
    assert.equal(
      calls,
      0,
      "Guest reminder settings must not depend on protected APIs",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Guest notification settings, five times, native-only state, no protected requests and no runtime errors: PASS",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

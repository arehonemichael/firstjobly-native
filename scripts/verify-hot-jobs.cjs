// Test-enabled export only. All backend traffic is intercepted; no live clicks.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { backend } = require("./personalization/backend.cjs");
const { job } = require("./personalization/fixtures.cjs");
const base = process.env.APP_URL || "http://localhost:8801";
let checks = 0;
function check(v, label) {
  assert.ok(v, label);
  console.log("PASS " + label);
  checks++;
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    async function setup(mode = "normal") {
      const context = await browser.newContext({
        viewport: { width: 390, height: 1000 },
        reducedMotion: "reduce",
      });
      const b = backend();
      b.tables.jobs = [1, 2, 3, 4, 5].map((i) =>
        job(i, {
          company_logo_url: null,
          approval_status: "approved",
          is_active: true,
          closing_date: i === 4 ? "2020-01-01" : null,
        }),
      );
      let ranking = 0,
        clicks = [],
        hold = mode === "slow",
        release;
      const gate = new Promise((r) => (release = r));
      const errors = [];
      await context.route(
        "**/ehwqqjqtevppsnmxximg.supabase.co/**",
        async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            table = url.pathname.split("/").pop();
          if (table === "hot_job_cache") {
            ranking++;
            if (hold) await gate;
            if (mode === "error")
              return route.fulfill({
                status: 503,
                json: { message: "Fixture ranking unavailable" },
              });
            return route.fulfill({
              json:
                mode === "empty"
                  ? []
                  : [1, 2, 3, 4, 5].map((i) => ({
                      job_id: job(i).id,
                      rank: i,
                      click_count: i === 5 ? 1 : 30 - i,
                      refreshed_at: new Date().toISOString(),
                    })),
            });
          }
          if (table === "apply_clicks") {
            clicks.push(request.postDataJSON());
            assert.equal(url.searchParams.get("select"), null);
            return route.fulfill({ status: 201, body: "" });
          }
          if (url.pathname.includes("/auth/"))
            return route.fulfill({ json: {} });
          if (
            table === "jobs" &&
            url.searchParams.has("id") &&
            request.headers().accept?.includes("vnd.pgrst.object")
          )
            return route.fulfill({
              json:
                b.tables.jobs.find((j) => url.search.includes(j.id)) ||
                b.tables.jobs[0],
            });
          const response = await b.fetch(
            `https://isolated.supabase.test${url.pathname}${url.search}`,
            { method: request.method(), headers: request.headers() },
          );
          return route.fulfill({
            status: response.status,
            body: await response.text(),
            headers: { "content-type": "application/json" },
          });
        },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      return {
        context,
        page,
        b,
        errors,
        get ranking() {
          return ranking;
        },
        get clicks() {
          return clicks;
        },
        release() {
          hold = false;
          release();
        },
      };
    }
    {
      const f = await setup("slow");
      await f.page.goto(base);
      await f.page
        .locator('[data-testid="application-shell"]:not([inert])')
        .waitFor();
      await f.page.getByText("Opportunity 1", { exact: true }).waitFor();
      check(
        await f.page.getByTestId("brand-wordmark").isVisible(),
        "brand and recommendations render while popularity is held",
      );
      check(
        (await f.page.getByTestId("hot-jobs-section").count()) === 0,
        "no fake Hot loading section",
      );
      f.release();
      await f.page
        .getByRole("heading", { name: "Hot right now", exact: true })
        .waitFor();
      check(f.ranking === 1, "all card badges share one ranking request");
      const section = f.page.getByTestId("hot-jobs-section");
      await section.scrollIntoViewIfNeeded();
      check(
        (await section.getByText("Opportunity 4", { exact: true }).count()) ===
          0,
        "expired ranking job excluded",
      );
      check(
        (await section.getByText("Opportunity 5", { exact: true }).count()) ===
          0,
        "below-threshold ranking job excluded",
      );
      check(
        (await section
          .getByText("Trending · Apply activity", { exact: true })
          .count()) === 3,
        "accurate activity badges on qualified cards",
      );
      check(
        (await f.page.getByText(/Most applied/).count()) === 0,
        "no application claim from click data",
      );
      await section
        .getByRole("button", { name: "See all trending jobs", exact: true })
        .click();
      await f.page.waitForURL("**/hot-jobs");
      await f.page
        .getByRole("heading", { name: "Hot right now", exact: true })
        .waitFor();
      check(true, "See all opens working ranking list");
      await f.page
        .getByRole("button", { name: /^View job: Opportunity 1 at/ })
        .click();
      await f.page.waitForURL("**/jobs/10000000-0000-4000-8000-000000000001");
      await f.page
        .getByText("Trending · Apply activity", { exact: true }).last()
        .waitFor();
      check(true, "shared cards open existing job details with matching badge");
      await f.page.getByRole("button", { name: "Easy Apply", exact: true }).click();
      for (let i = 0; i < 40 && !f.clicks.length; i++) await f.page.waitForTimeout(50);
      check(f.clicks.length === 1 && !('user_id' in f.clicks[0]) && f.clicks[0].anonymous_id.length >= 16, 'Apply click uses stable anonymous ID and minimal insert');
      await f.page.getByRole("button", { name: "Easy Apply", exact: true }).click();
      await f.page.waitForTimeout(100);
      check(f.clicks.length === 1, 'repeat taps do not flood activity inserts');
      check(f.errors.length === 0, "ranking and detail have no runtime errors");
      await f.context.close();
    }
    for (const mode of ["empty", "error"]) {
      const f = await setup(mode);
      await f.page.goto(base);
      await f.page.getByText("Opportunity 1", { exact: true }).waitFor();
      await f.page.waitForTimeout(300);
      check(
        (await f.page.getByTestId("hot-jobs-section").count()) === 0,
        `${mode} popularity omits optional section`,
      );
      check(
        (await f.page
          .getByText("Trending · Apply activity", { exact: true })
          .count()) === 0,
        `${mode} popularity has no fabricated badge`,
      );
      await f.page.goto(base + "/hot-jobs");
      if (mode === "error") {
        await f.page
          .getByText(
            "Trending opportunities couldn't load. Please try again.",
            { exact: true },
          )
          .waitFor();
        check(
          (await f.page
            .getByText("No trending opportunities right now", { exact: true })
            .count()) === 0,
          "ranking failure is not an empty feed",
        );
      } else {
        await f.page
          .getByText("No trending opportunities right now", { exact: true })
          .waitFor();
        check(true, "empty ranking list offers browse action");
      }
      check(f.errors.length === 0, `${mode} state has no runtime errors`);
      await f.context.close();
    }
    console.log(
      `${checks} Hot browser checks passed; all backend responses intercepted.`,
    );
  } catch (error) {
    for (const context of browser.contexts())
      for (const page of context.pages())
        await page
          .screenshot({
            path: "/workspace/work/hot-browser-failure.png",
            fullPage: true,
          })
          .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

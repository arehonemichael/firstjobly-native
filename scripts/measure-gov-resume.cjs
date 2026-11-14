/* Controlled Expo-web measurements, not installed-device or live-backend results. */
const { chromium } = require("playwright");
const { performance } = require("node:perf_hooks");
const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const { backend } = require("./personalization/backend.cjs");
const { job, jid, uid } = require("./personalization/fixtures.cjs");
const base = process.env.APP_URL || "http://localhost:8840";
const output = process.env.PERF_OUTPUT || "/tmp/app-performance.json";
const user = {
  id: uid.alice,
  aud: "authenticated",
  role: "authenticated",
  email: "perf@example.test",
  email_confirmed_at: "2026-01-01",
  created_at: "2026-01-01",
  app_metadata: {},
  user_metadata: {},
};
const token =
  Buffer.from('{"alg":"HS256"}').toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url") +
  ".fixture";
const session = {
  access_token: token,
  refresh_token: "fixture-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
};
const batch = {
  id: "batch-41",
  title: "Public Service Vacancy Circular 41 of 2026",
  circular_number: 41,
  circular_year: 2026,
  issue_date: "2026-11-13",
  job_count: 20,
  earliest_closing_date: "2099-01-01",
  pdf_download_url: null,
  official_pdf_url: null,
};
const circular = {
  id: "circular-1",
  batch_id: "batch-41",
  post_title: "ADMINISTRATION CLERK",
  department: "Fixture department",
  centre: "Pretoria",
  province: "Gauteng",
  salary_text: "R216 417 per annum",
  closing_date: "2099-01-01",
  closes_in_days: 100,
  is_closing_soon: false,
  is_expired: false,
  saved: false,
  application_stage: null,
  job_type: "permanent",
};
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const samples = [];
  try {
    async function setup() {
      const context = await browser.newContext({
        viewport: { width: 390, height: 900 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        (session) =>
          localStorage.setItem(
            "sb-ehwqqjqtevppsnmxximg-auth-token",
            JSON.stringify(session),
          ),
        session,
      );
      const b = backend();
      b.tables.jobs = Array.from({ length: 80 }, (_, i) => job(i + 1));
      b.tables.profiles[0] = {
        ...b.tables.profiles[0],
        first_name: "Perf",
        last_name: "Fixture",
        email: user.email,
        onboarding_completed: true,
      };
      b.tables.saved_jobs = [{ user_id: user.id, job_id: jid(1) }];
      const calls = [];
      await context.route(
        "**/ehwqqjqtevppsnmxximg.supabase.co/**",
        async (r) => {
          const req = r.request(),
            url = new URL(req.url()),
            p = url.pathname;
          if (p.includes("/auth/v1/token")) return r.fulfill({ json: session });
          if (p.includes("/auth/v1/user")) return r.fulfill({ json: user });
          if (p.includes("/auth/v1/logout")) return r.fulfill({ status: 204 });
          const select = url.searchParams.get("select") || "";
          calls.push({
            path: p,
            select,
            method: req.method(),
            at: performance.now(),
          });
          await new Promise((resolve) =>
            setTimeout(resolve, select.includes("jobs!inner") ? 600 : 120),
          );
          if (p.includes("/application_status_history"))
            return r.fulfill({ json: [] });
          try {
            const headers = {
              ...req.headers(),
              authorization: "Bearer token:" + user.id,
            };
            const response = await b.fetch(
              "https://isolated.supabase.test" + p + url.search,
              {
                method: req.method(),
                headers,
                body: req.postData() || undefined,
              },
            );
            return r.fulfill({
              status: response.status,
              body: await response.text(),
              headers: {
                "content-type": "application/json",
                ...(response.headers.get("content-range")
                  ? { "content-range": response.headers.get("content-range") }
                  : {}),
              },
            });
          } catch {
            return r.fulfill({ json: [] });
          }
        },
      );
      await context.route("https://firstjobly.co.za/api/**", async (r) => {
        const url = new URL(r.request().url());
        const path = url.pathname;
        const data = r.request().postDataJSON();
        calls.push({
          path,
          action: data?.action,
          method: r.request().method(),
          at: performance.now(),
        });
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (path.endsWith("/circular-batches/latest"))
          return r.fulfill({ json: { batch } });
        if (path.endsWith("/circular-jobs"))
          return r.fulfill({
            json: {
              items: [circular],
              page: 1,
              page_size: 20,
              total: 1,
              has_more: false,
            },
          });
        if (path.endsWith("/circular-jobs/saved"))
          return r.fulfill({ json: { items: [] } });
        return r.fulfill({ json: { enabled: false } });
      });
      const page = await context.newPage();
      const timings = [];
      const traces = [];
      const renderTraces = [];
      page.on("console", (msg) => {
        if (msg.text().startsWith("[FirstJobly circular render]")) {
          try {
            renderTraces.push(
              JSON.parse(
                msg.text().slice("[FirstJobly circular render]".length).trim(),
              ),
            );
          } catch {}
        }
        if (msg.text().startsWith("[FirstJobly circular]")) {
          try {
            traces.push(
              JSON.parse(
                msg.text().slice("[FirstJobly circular]".length).trim(),
              ),
            );
          } catch {}
        }
      });
      page.on("response", async (response) => {
        if (!response.url().includes("/api/app/circular-jobs?")) return;
        const receivedAt = performance.now();
        const body = await response.body();
        timings.push({
          receivedAt,
          payloadBytes: body.length,
          records: JSON.parse(body).items.length,
          network: response.request().timing(),
        });
      });
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(120000);
      return { context, page, calls, timings, traces, renderTraces };
    }
    for (let sample = 0; sample < 3; sample++) {
      const { context, page, calls, timings, traces, renderTraces } =
        await setup();
      await page.goto(base);
      await page.getByText(/^Perf ·/).waitFor();
      const start = performance.now();
      await page.getByRole("tab", { name: "Gov jobs", exact: true }).click();
      await page.getByTestId("circular-feed").waitFor();
      const shellMs = performance.now() - start;
      await page
        .getByRole("button", { name: "Open Administration Clerk", exact: true })
        .waitFor();
      const usableMs = performance.now() - start;
      await page.getByRole("tab", { name: "Jobs", exact: true }).click();
      await page.waitForTimeout(500);

      const returned = performance.now();
      await page.getByRole("tab", { name: "Gov jobs", exact: true }).click();
      const cachedVisible = await page
        .getByRole("button", { name: "Open Administration Clerk", exact: true })
        .isVisible();
      await page
        .getByRole("button", { name: "Open Administration Clerk", exact: true })
        .waitFor();
      await page.waitForTimeout(300);
      samples.push({
        shellMs: Math.round(shellMs),
        usableMs: Math.round(usableMs),
        cachedVisible,
        returnMs: Math.round(performance.now() - returned),
        listRequests: calls.filter((c) => c.path.endsWith("/circular-jobs"))
          .length,
        timings: timings.map((t) => ({
          ...t,
          receivedAt: undefined,
          receivedToUsableMs: Math.round(start + usableMs - t.receivedAt),
        })),
        traces,
        renderTraces,
        latestRequests: calls.filter((c) =>
          c.path.endsWith("/circular-batches/latest"),
        ).length,
      });
      console.log(
        JSON.stringify({
          sample: sample + 1,
          shellMs: samples.at(-1).shellMs,
          usableMs: samples.at(-1).usableMs,
          listRequests: samples.at(-1).listRequests,
        }),
      );
      await context.close();
    }
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          conditions:
            "Expo web development, Chromium390x900, isolated signed-in responses120ms, one job, warm tab return; expiry tested separately with a fake clock; not live/device",
          samples,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

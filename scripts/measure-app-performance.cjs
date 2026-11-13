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
const author = {
  id: "member-2",
  name: "Fixture M.",
  anonymous: false,
  handle: "",
  avatarHue: 172,
  isMine: false,
  viewerFollows: false,
};
const post = {
  id: "post-1",
  topic: "general",
  title: "Fixture career discussion",
  body: "Isolated career advice content for a controlled performance measurement.",
  author,
  upvoteCount: 0,
  commentCount: 0,
  viewerVoted: false,
  viewerSaved: false,
  status: "visible",
  pinned: false,
  piiFlagged: false,
  sharedFromGraduateRoom: false,
  edited: false,
  createdAt: "2026-11-13T08:00:00Z",
  media: [],
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
        if (path.endsWith("/community"))
          return r.fulfill({
            json:
              data?.action === "viewer-state"
                ? {
                    member: true,
                    banned: false,
                    canWrite: true,
                    isStaff: false,
                    newAccount: false,
                  }
                : data?.action === "get-post"
                  ? { post, comments: [], nextCursor: null }
                  : { posts: [post], nextCursor: null, pinned: [] },
          });
        if (path.endsWith("/circular-jobs/saved"))
          return r.fulfill({ json: { items: [] } });
        return r.fulfill({ json: { enabled: false } });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(120000);
      return { context, page, calls };
    }
    for (let sample = 0; sample < 3; sample++) {
      const { context, page, calls } = await setup();
      const start = performance.now();
      await page.goto(base);
      await page
        .locator('[data-testid="application-shell"]:not([inert])')
        .waitFor();
      const shellMs = performance.now() - start;
      await page.getByText(/^Perf ·/).waitFor();
      const homeProfileMs = performance.now() - start;
      await page.getByRole("tab", { name: "Jobs", exact: true }).click();
      await page
        .getByRole("button", { name: /View job: Opportunity 1 at/ })
        .first()
        .waitFor();
      const jobsAt = performance.now();
      await page
        .getByRole("button", { name: /View job: Opportunity 1 at/ })
        .first()
        .click();
      await page
        .getByText("Opportunity 1", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      const detailMs = performance.now() - jobsAt;
      await page.goBack();
      await page.getByRole("tab", { name: "Saved", exact: true }).click();
      await page
        .getByText("Saved jobs", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      await page
        .getByText("Opportunity 1", { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      const savedReads = calls.filter(
        (c) => c.path.endsWith("/saved_jobs") && c.select === "job_id",
      ).length;
      await page.getByRole("tab", { name: "More", exact: true }).click();
      await page.getByRole("button", { name: "Profile", exact: true }).click();
      await page
        .getByRole("textbox", { name: "First name", exact: true })
        .waitFor();
      const profileReadCount = calls.filter((c) =>
        c.path.endsWith("/profiles"),
      ).length;
      await context.close();
      const cold = await setup();
      const govStart = performance.now();
      await cold.page.goto(base + "/circular-jobs");
      await cold.page
        .getByRole("button", { name: "Open Administration Clerk", exact: true })
        .waitFor();
      await cold.page.getByText(batch.title, { exact: true }).waitFor();
      const govMs = performance.now() - govStart;
      const latestReads = cold.calls.filter((c) =>
        c.path.endsWith("/circular-batches/latest"),
      ).length;
      await cold.context.close();
      samples.push({
        shellMs: Math.round(shellMs),
        homeProfileMs: Math.round(homeProfileMs),
        detailMs: Math.round(detailMs),
        savedReads,
        profileReadCount,
        govMs: Math.round(govMs),
        latestReads,
      });
      console.log("sample", sample + 1, JSON.stringify(samples.at(-1)));
    }
    const report = {
      conditions:
        "Chromium 390x900, Expo web development build, isolated signed-in fixtures, 120ms API latency; optional Home draft applications read delayed 600ms. Three fresh browser contexts. Not Android/device or production.",
      samples,
    };
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log("Saved " + output);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

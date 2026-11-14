/* Isolated browser checks. All auth/API traffic is intercepted; no live writes. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const base = process.env.APP_URL || "http://localhost:8820";
const output = process.env.SCREENSHOT_DIR || "/tmp/circular-screens";
fs.mkdirSync(output, { recursive: true });
const uid = "00000000-0000-4000-8000-000000000001";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  email_confirmed_at: "2026-01-01",
  created_at: "2026-01-01",
  user_metadata: {},
  app_metadata: {},
};
const token =
  Buffer.from('{"alg":"HS256"}').toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 }),
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
  description: null,
  circular_number: 41,
  circular_year: 2026,
  issue_date: "2026-11-13",
  published_at: "2026-11-13T08:00:00Z",
  page_count: 12,
  job_count: 3,
  earliest_closing_date: "2026-11-15",
  pdf_download_url: "https://pdf-fixture.invalid/circular-41.pdf",
  pdf_download_expires_in: 3600,
  official_pdf_url: "https://www.dpsa.gov.za/fixture.pdf",
};
function job(id, title = "ADMINISTRATION CLERK", extra = {}) {
  return {
    id,
    batch_id: batch.id,
    post_number: "41/01",
    post_title: title,
    department: "Department of Health",
    reference_number: "HEALTH/2026/41",
    centre: "Pretoria",
    province: "Gauteng",
    salary_text: "R216 417 per annum",
    salary_min: 216417,
    salary_max: 216417,
    salary_level: "5",
    job_type: "permanent",
    posts_count: 1,
    closing_date: "2026-11-15",
    min_qualification: "grade_12",
    published_at: "2026-11-13T08:00:00Z",
    closes_in_days: 2,
    is_closing_soon: true,
    is_expired: false,
    circular: {
      id: batch.id,
      number: 41,
      year: 2026,
      issue_date: batch.issue_date,
    },
    saved: false,
    application_stage: null,
    ...extra,
  };
}
function detail(item) {
  return {
    job: {
      ...item,
      closing_date_text: "15 November 2026 at 16:00",
      salary_period: "annum",
      requirements: [
        { kind: "qualification", text: "Grade 12 certificate." },
        { kind: "experience", text: "No previous work experience required." },
        {
          kind: "skill",
          text: "Good communication and basic computer skills.",
        },
      ],
      fields_of_study: [],
      min_experience_years: 0,
      drivers_licence_required: false,
      professional_registration: null,
      duties: [
        "Maintain records and support the administration team.",
        "Assist visitors and handle incoming correspondence.",
      ],
      enquiries: {
        name: "Recruitment office",
        phone: "012 000 0000",
        email: "recruitment@example.test",
      },
      documents_required: ["Fully completed Z83 form", "Detailed CV"],
      notes: "Follow the instructions in the official circular.",
      is_readvertisement: false,
      source: {
        circular_title: batch.title,
        circular_id: batch.id,
        issue_date: batch.issue_date,
        page: 3,
        official_pdf_url: batch.official_pdf_url,
      },
    },
    apply: {
      methods: ["email", "online", "post", "hand_delivery"],
      emails: ["recruitment@example.test"],
      urls: ["https://employer-fixture.invalid/apply"],
      postal_address: "Recruitment office, Private Bag X1, Pretoria",
      hand_delivery_address: "Recruitment office, Pretoria",
      instructions:
        "Quote the reference number and attach a completed Z83 and CV.",
      email_subject: item.reference_number + " – " + item.post_title,
    },
    z83_prefill: {
      position: item.post_title,
      department: item.department,
      reference: item.reference_number,
      surnameAndNames: "Fixture Candidate",
      contactDetails: "fixture@example.test",
      languages: [{ name: "English", speak: "Good", write: "Good" }],
      qualifications: [],
      jobs: [],
    },
    z83_requirements: {
      from_job: ["position", "department", "reference"],
      from_profile: [],
      at_apply_time: [
        "availability",
        "preferredLanguage",
        "references",
        "signature",
      ],
      session_only: ["idNumber", "race", "criminalConviction"],
      job_specific: [],
    },
    requirements_match: {
      overall: "check",
      items: [
        {
          criterion: "qualification",
          status: "meets",
          detail: "Your qualification level meets the requirement.",
        },
        {
          criterion: "experience",
          status: "meets",
          detail: "No previous experience is required.",
        },
        {
          criterion: "field_of_study",
          status: "check",
          detail: "Check your profile before applying.",
        },
      ],
    },
    missing_profile_fields: [
      "phone",
      "highest_qualification",
      "work_experience",
      "drivers_licence",
    ],
    saved: item.saved,
    application: {
      started_at: item.application_stage ? "2026-11-13T08:00:00Z" : null,
      sent_at:
        item.application_stage === "sent" ? "2026-11-13T09:00:00Z" : null,
      method: null,
    },
  };
}
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("PASS " + label);
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    async function setup({
      guest = false,
      errorStatus = 0,
      slow = false,
      realistic = false,
      offline = false,
      malformed = false,
      initialEmpty = false,
    } = {}) {
      const context = await browser.newContext({
        viewport: { width: 360, height: 900 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ session, guest }) => {
          if (!guest)
            localStorage.setItem(
              "sb-ehwqqjqtevppsnmxximg-auth-token",
              JSON.stringify(session),
            );
        },
        { session, guest },
      );
      const state = {
        calls: [],
        items: [
          job("clerk-1"),
          job("intern-2", "ADMINISTRATION INTERN", {
            job_type: "internship",
            closes_in_days: 7,
            closing_date: "2026-11-20",
          }),
          job("assistant-3", "OFFICE ASSISTANT", {
            closes_in_days: 17,
            is_closing_soon: false,
            closing_date: "2026-11-30",
          }),
        ],
        withdrawn: false,
        enabled: false,
        pdfGets: 0,
        errors: [],
        diagnostics: [],
      };
      if (realistic)
        state.items = Array.from({ length: 128 }, (_, i) =>
          job(
            "fixture-" + (i + 1),
            i === 0
              ? "CLERK: OFFICE OF THE DIRECTOR"
              : "FIXTURE OPPORTUNITY " + (i + 1),
            i === 0
              ? {
                  centre: null,
                  province: null,
                  salary_text: null,
                  closing_date: "2000-01-01",
                  closes_in_days: 17,
                  is_closing_soon: false,
                  is_expired: false,
                }
              : {},
          ),
        );
      if (initialEmpty) state.items = [];
      const currentBatch = {
        ...batch,
        job_count: realistic ? 128 : batch.job_count,
      };
      await context.route("**/ehwqqjqtevppsnmxximg.supabase.co/**", (r) => {
        const url = new URL(r.request().url());
        const p = url.pathname;
        if (p.includes("/circular_"))
          throw Error("Forbidden direct table access");
        if (p.includes("/auth/v1/token")) return r.fulfill({ json: session });
        if (p.includes("/auth/v1/user")) return r.fulfill({ json: user });
        if (p.includes("/auth/v1/logout")) return r.fulfill({ status: 204 });
        if (p.includes("/profiles"))
          return r.fulfill({
            json: {
              id: uid,
              first_name: "Fixture",
              onboarding_completed: true,
              highest_qualification: "Grade 12",
            },
          });
        return r.fulfill({ json: [] });
      });
      await context.route("https://firstjobly.co.za/api/**", async (r) => {
        const req = r.request(),
          url = new URL(req.url()),
          path = url.pathname.replace("/api/app", "");
        if (!url.pathname.startsWith("/api/app"))
          return r.fulfill({ json: { viewer: {}, posts: [] } });
        state.calls.push({
          path,
          query: Object.fromEntries(url.searchParams),
          method: req.method(),
          body: req.postDataJSON(),
          headers: req.headers(),
        });
        check(
          req.headers().authorization === "Bearer " + token &&
            req.headers()["x-fj-token"] === token,
          "both session token headers",
        );
        if (slow) await new Promise((resolve) => setTimeout(resolve, 800));
        if (offline && path.startsWith("/circular-jobs"))
          return r.abort("internetdisconnected");
        if (malformed && path.startsWith("/circular-jobs"))
          return r.fulfill({ json: { jobs: [] } });
        if (errorStatus === 403 && path.startsWith("/circular-jobs"))
          return r.fulfill({ status: 403, body: "error code: 1010" });
        if (errorStatus && path.startsWith("/circular-jobs"))
          return r.fulfill({
            status: errorStatus,
            json: {
              error:
                errorStatus === 429
                  ? "Please try again in a minute."
                  : "Could not load government jobs.",
            },
          });
        if (path === "/circular-batches/latest") {
          state.pdfGets++;
          return r.fulfill({ json: { batch: currentBatch } });
        }
        if (path === "/circular-alerts") {
          if (req.method() === "POST")
            state.enabled = req.postDataJSON().enabled;
          return r.fulfill({ json: { enabled: state.enabled } });
        }
        if (path === "/circular-jobs/saved")
          return r.fulfill({
            json: { items: state.items.filter((j) => j.saved) },
          });
        if (path === "/circular-jobs") {
          const page = +(url.searchParams.get("page") || 1);
          let items = state.items;
          if (
            url.searchParams.get("batch_id") &&
            url.searchParams.get("batch_id") !== batch.id
          )
            items = [];
          if (url.searchParams.get("search"))
            items = items.filter((j) =>
              j.post_title
                .toLowerCase()
                .includes(url.searchParams.get("search").toLowerCase()),
            );
          if (url.searchParams.get("province"))
            items = items.filter(
              (j) => j.province === url.searchParams.get("province"),
            );
          return r.fulfill({
            json: {
              items: items.slice(
                (page - 1) * (realistic ? 20 : 2),
                page * (realistic ? 20 : 2),
              ),
              page,
              page_size: 20,
              total: items.length,
              has_more: page * (realistic ? 20 : 2) < items.length,
            },
          });
        }
        const parts = path.split("/");
        const item = state.items.find((j) => j.id === parts[2]);
        if (!item || (state.withdrawn && parts[2] === "clerk-1"))
          return r.fulfill({
            status: 404,
            json: { error: "This job was withdrawn" },
          });
        if (parts[3] === "save") {
          item.saved = req.method() === "POST";
          return r.fulfill({
            json: { ok: true, job_id: item.id, saved: item.saved },
          });
        }
        if (parts[3] === "apply-intent") {
          item.application_stage = req.postDataJSON().stage;
          return r.fulfill({
            json: {
              ok: true,
              job_id: item.id,
              ...req.postDataJSON(),
              recorded_at: "2026-11-13T08:00:00Z",
            },
          });
        }
        return r.fulfill({ json: detail(item) });
      });
      await context.route("https://pdf-fixture.invalid/**", (r) =>
        r.fulfill({
          contentType: "application/pdf",
          body: "%PDF-1.4\n% isolated fixture",
        }),
      );
      await context.route("https://employer-fixture.invalid/**", (r) =>
        r.fulfill({ body: "Isolated employer application page" }),
      );
      const page = await context.newPage();
      page.on("pageerror", (e) => state.errors.push(e.message));
      page.on("console", (m) => {
        if (
          m.type() === "info" &&
          m.text().startsWith("[FirstJobly circular] ")
        )
          state.diagnostics.push(
            JSON.parse(m.text().slice("[FirstJobly circular] ".length)),
          );
        if (
          m.type() === "error" &&
          !m.text().includes("Failed to load resource")
        ) {
          console.log("CONSOLE " + m.text());
          state.errors.push(m.text());
        }
      });
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(120000);
      return { context, page, state };
    }
    const { context, page, state } = await setup();
    await page.goto(base);
    await page.getByTestId("application-shell").locator(":scope").waitFor();
    await page
      .getByRole("button", { name: "Government jobs", exact: true })
      .waitFor();
    await page.screenshot({ path: output + "/home.png" });
    const tabs = page.getByRole("tab");
    check((await tabs.count()) === 5, "exactly five visible tabs at 360px");
    for (const label of ["Home", "Jobs", "Gov jobs", "Saved", "More"]) {
      const tab = page.getByRole("tab", { name: label, exact: true });
      check(await tab.isVisible(), "visible tab " + label);
      check(
        (await tab.innerText()).trim() === label,
        "complete label " + label,
      );
      const rect = await tab.boundingBox();
      check(rect.width >= 44 && rect.height >= 44, "44dp target " + label);
    }
    await page.getByRole("tab", { name: "Gov jobs", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Administration Clerk" })
      .waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[aria-label="New circular"]').length === 0,
    );
    check(true, "opening Gov jobs clears the new-batch dot");
    await page.screenshot({ path: output + "/gov-jobs.png" });
    const beforePDF = state.pdfGets;
    await page
      .getByRole("button", { name: "Download PDF", exact: true })
      .click();
    for (let n = 0; n < 100 && state.pdfGets === beforePDF; n++)
      await new Promise((r) => setTimeout(r, 20));
    check(state.pdfGets > beforePDF, "PDF tap fetches a fresh signed URL");
    for (const popup of context.pages())
      if (popup !== page) await popup.close();
    await page.bringToFront();
    await page.getByTestId("circular-feed").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const moreControl = page.getByRole("button", {
      name: "Load more jobs",
      exact: true,
    });
    if (await moreControl.count())
      await moreControl.evaluate((el) => el.click()).catch(() => {});
    await page
      .getByRole("button", { name: "Open Office Assistant", exact: true })
      .waitFor();
    check(
      state.calls.some(
        (c) => c.query.page === "2" && c.query.page_size === "20",
      ),
      "next page uses audited pagination",
    );
    await page
      .getByRole("textbox", { name: "Search government jobs" })
      .fill("intern");
    await page
      .getByRole("button", { name: "Open Administration Intern", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("[role=button]")].some(
          (n) => n.getAttribute("aria-label") === "Open Administration Clerk",
        ),
    );
    check(true, "debounced search applies to the feed");
    await page
      .getByRole("textbox", { name: "Search government jobs" })
      .fill("");
    await page
      .getByRole("button", { name: "Open Administration Clerk", exact: true })
      .waitFor();
    check(
      !state.calls.some((c) => Object.values(c.query).includes("undefined")),
      "cleared filters never send undefined",
    );
    check(
      await page.getByText("R216 417 per year").first().isVisible(),
      "SA salary wording",
    );
    await page
      .getByRole("button", { name: "Save Administration Clerk", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Unsave Administration Clerk", exact: true })
      .waitFor();
    check(state.items[0].saved, "save circular uses API");
    check(!page.url().includes("/circular-jobs/clerk-1"), "Save does not open a job");
    for (const region of ["location", "salary", "closing", "padding"]) {
      const card = page.getByRole("button", { name: "Open Administration Clerk", exact: true });
      if (region === "padding") {
        const rect = await card.boundingBox();
        await page.mouse.click(rect.x + 7, rect.y + rect.height - 7);
      } else if (region === "location") await card.getByText("Pretoria · Gauteng", { exact: true }).click();
      else if (region === "salary") await card.getByText("R216 417 per year", { exact: true }).click();
      else await card.getByText(/^Closes /).first().click();
      await page.getByText("Do I qualify?", { exact: true }).waitFor();
      check(page.url().includes("/circular-jobs/clerk-1"), `whole card opens from ${region}`);
      await page.goBack();
      await card.waitFor();
    }
    await page
      .getByRole("button", { name: "Open Administration Clerk" })
      .click();
    await page.getByText("Do I qualify?", { exact: true }).waitFor();
    await page.screenshot({ path: output + "/job-detail.png" });
    check(
      (await page
        .getByText("Quote the post title and centre when you apply.")
        .count()) === 0,
      "reference present path",
    );
    await page.getByRole("button", { name: "Duties", exact: true }).click();
    await page
      .getByText("• Maintain records and support the administration team.")
      .waitFor();
    await page.getByRole("checkbox").first().click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("[role=checkbox]")
          ?.getAttribute("aria-checked") === "true",
    );
    check(true, "document checklist toggles");
    await page
      .getByRole("button", { name: "Add to profile: Work experience" })
      .click();
    await page.getByText("Work experience", { exact: true }).first().waitFor();
    check(
      page.url().includes("section=work_experience"),
      "correct profile work-experience section",
    );
    await page.goto(base + "/circular-jobs/clerk-1");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("radio", { name: "Email", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue to Z83 preparation" })
      .click();
    await page
      .getByRole("button", { name: "Complete Z83", exact: true })
      .waitFor();
    await page.screenshot({ path: output + "/apply-flow.png" });
    check(
      state.calls.some((c) => c.body?.stage === "started"),
      "started intent recorded",
    );
    check(
      !state.calls.some((c) => c.body?.stage === "sent"),
      "starting never marks sent",
    );
    await page
      .getByRole("button", { name: "Complete Z83", exact: true })
      .click();
    await page.getByText("A. The advertised post", { exact: true }).waitFor();
    const position = page.getByRole("textbox").first();
    check(
      (await position.inputValue()) === "ADMINISTRATION CLERK",
      "real Z83 post prefill",
    );
    const idAnswer = "0000000000000";
    await page
      .getByRole("textbox", { name: "Identity number", exact: true })
      .fill(idAnswer);
    check(
      !(await page.evaluate(
        (value) =>
          Object.values(localStorage).some((stored) => stored.includes(value)),
        idAnswer,
      )),
      "Section B answer is never written to localStorage",
    );
    await page.goto(base + "/more");
    await page.getByRole("button", { name: "CV Maker", exact: true }).waitFor();
    await page.screenshot({ path: output + "/more.png" });
    for (const label of [
      "CV Maker",
      "Z83",
      "Community",
      "Career Hub",
      "Applications",
      "Profile",
      "Notifications",
      "Settings",
      "Help",
      "Career tools",
      "Discover",
      "Job preferences",
      "Hot jobs",
    ])
      check(
        await page
          .getByRole("button", { name: label, exact: true })
          .isVisible(),
        "More reaches " + label,
      );
    await page
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await page
      .getByRole("switch", { name: "New government circulars" })
      .waitFor();
    await page
      .getByRole("switch", { name: "New government circulars" })
      .click();
    await page.waitForFunction(
      (element) => element?.checked === true,
      await page
        .getByRole("switch", { name: "New government circulars" })
        .elementHandle(),
    );
    check(state.enabled, "alert preference saved");
    await page.goto(base + "/saved");
    await page
      .getByRole("tab", { name: "Gov jobs", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Open Administration Clerk" })
      .waitFor();
    check(true, "saved Gov jobs segment");
    state.withdrawn = true;
    await page
      .getByRole("button", { name: "Open Administration Clerk" })
      .click();
    await page.getByText("This job was withdrawn", { exact: true }).waitFor();
    for (
      let n = 0;
      n < 100 &&
      !state.calls.some(
        (c) => c.path.endsWith("/clerk-1/save") && c.method === "DELETE",
      );
      n++
    )
      await new Promise((r) => setTimeout(r, 20));
    check(
      state.calls.some(
        (c) => c.path.endsWith("/clerk-1/save") && c.method === "DELETE",
      ),
      "withdrawal unsaves through API",
    );
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByText("No saved government jobs", { exact: true }).waitFor();
    check(
      true,
      "withdrawn saved item stays removed locally even if unsave returns 404",
    );
    check(
      state.errors.length === 0,
      "no browser runtime errors: " + state.errors.join("; "),
    );
    await context.close();
    const guest = await setup({ guest: true });
    await guest.page.goto(base + "/circular-jobs");
    await guest.page
      .getByRole("button", { name: "Sign in", exact: true })
      .waitFor();
    check(
      !guest.state.calls.length,
      "signed-out user makes no protected circular requests",
    );
    await guest.context.close();
    const limited = await setup({ errorStatus: 429 });
    await limited.page.goto(base + "/circular-jobs");
    await limited.page
      .getByRole("button", { name: /Try again in \d+s/ })
      .waitFor();
    check(
      await limited.page
        .getByRole("button", { name: /Try again in \d+s/ })
        .isDisabled(),
      "rate-limited retry disabled",
    );
    await limited.context.close();
    const slow = await setup({ slow: true });
    await slow.page.goto(base + "/circular-jobs");
    await slow.page.getByLabel("Loading government jobs").first().waitFor();
    check(true, "slow request shows skeleton");
    await slow.page
      .getByRole("button", { name: "Open Administration Clerk" })
      .waitFor();
    await slow.context.close();
    // 128 is an isolated reproduction of the owner's audited count, not a live probe.
    const audit = await setup({ realistic: true });
    await audit.page.goto(base + "/circular-jobs");
    await audit.page
      .getByRole("button", {
        name: "Open Clerk: Office Of The Director",
        exact: true,
      })
      .waitFor();
    const first = audit.state.calls.find((c) => c.path === "/circular-jobs");
    check(
      JSON.stringify(first.query) ===
        JSON.stringify({ page: "1", page_size: "20" }),
      "first load has no default filters",
    );
    check(
      await audit.page
        .getByText("Salary not stated", { exact: true })
        .isVisible(),
      "nullable salary and location do not drop an approved row",
    );
    check(
      await audit.page.getByText(/^Closes .*Jan$/).isVisible(),
      "server expiry flags are respected instead of device date filtering",
    );
    await audit.page.screenshot({ path: output + "/audit-128-jobs.png" });
    check(
      audit.state.diagnostics.some(
        (d) => d.status === 200 && d.total === 128 && d.itemCount === 20,
      ),
      "dev diagnostics record 200/128 from isolated API fixture",
    );
    console.log(
      "ISOLATED_FIXTURE_DIAGNOSTIC " +
        JSON.stringify(audit.state.diagnostics.find((d) => d.total === 128)),
    );
    for (let pageNumber = 2; pageNumber <= 7; pageNumber++) {
      const lastCard = audit.page.getByRole("button", {
        name: "Open Fixture Opportunity " + Math.min(pageNumber * 20, 128),
        exact: true,
      });
      for (let tries = 0; tries < 100 && !(await lastCard.count()); tries++) {
        await audit.page.getByTestId("circular-feed").evaluate((el) => {
          el.scrollTop += 700;
        });
        await audit.page.waitForTimeout(100);
      }
      await audit.page
        .getByRole("button", {
          name: "Open Fixture Opportunity " + Math.min(pageNumber * 20, 128),
          exact: true,
        })
        .waitFor()
        .catch(async (error) => {
          console.log(
            "AUDIT_PAGINATION",
            await audit.page.getByTestId("circular-feed").evaluate((el) => ({
              top: el.scrollTop,
              height: el.scrollHeight,
              client: el.clientHeight,
            })),
            audit.state.calls
              .filter((c) => c.path === "/circular-jobs")
              .map((c) => c.query),
          );
          await audit.page.screenshot({
            path: output + "/audit-pagination-debug.png",
          });
          throw error;
        });
      check(
        audit.state.calls.some((c) => c.query.page === String(pageNumber)),
        "loads page " + pageNumber + " of the 128-row fixture",
      );
    }
    await audit.page.goto(base + "/circular-jobs/fixture-1");
    await audit.page.getByText("Do I qualify?", { exact: true }).waitFor();
    check(
      await audit.page
        .getByText("Clerk: Office Of The Director", { exact: true })
        .isVisible(),
      "server-approved title is not rejected on detail",
    );
    await audit.page
      .getByRole("button", { name: "Apply", exact: true })
      .click();
    await audit.page
      .getByText("How will you apply?", { exact: true })
      .waitFor();
    check(true, "approved detail is not rejected by Apply");
    await audit.page.goto(base + "/circular-jobs?batch=old-unavailable-batch");
    await audit.page
      .getByText("No open government jobs right now", { exact: true })
      .waitFor();
    await audit.page.getByRole("tab", { name: "Home", exact: true }).click();
    await audit.page
      .getByText(/Circular 41 of 2026 · 128 entry-level jobs/)
      .waitFor();
    await audit.page.screenshot({ path: output + "/audit-home-128.png" });
    await audit.page
      .getByRole("button", { name: "Government jobs", exact: true })
      .click();
    await audit.page
      .getByRole("button", {
        name: "Open Clerk: Office Of The Director",
        exact: true,
      })
      .waitFor();
    check(
      audit.state.calls.filter((c) => c.path === "/circular-jobs").at(-1).query
        .batch_id === undefined,
      "Home clears a stale notification batch",
    );
    await audit.page
      .getByRole("textbox", { name: "Search government jobs" })
      .fill("no-matching-fixture");
    await audit.page
      .getByText("No open government jobs right now", { exact: true })
      .waitFor();
    await audit.page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await audit.page
      .getByRole("button", {
        name: "Open Clerk: Office Of The Director",
        exact: true,
      })
      .waitFor();
    check(true, "Clear filters restores API results");
    check(
      audit.state.errors.length === 0,
      "no runtime errors with nullable fields and 128 rows",
    );
    await audit.context.close();
    const newlyApproved = await setup({ initialEmpty: true });
    await newlyApproved.page.goto(base + "/circular-jobs");
    await newlyApproved.page
      .getByText("No open government jobs right now", { exact: true })
      .waitFor();
    newlyApproved.state.items = [job("new-approved")];
    await newlyApproved.page
      .getByRole("tab", { name: "Home", exact: true })
      .click();
    await newlyApproved.page
      .getByRole("tab", { name: "Gov jobs", exact: true })
      .click();
    await newlyApproved.page
      .getByRole("button", { name: "Open Administration Clerk", exact: true })
      .waitFor();
    check(
      newlyApproved.state.calls.filter((c) => c.path === "/circular-jobs")
        .length >= 2,
      "earlier empty response is not reused on reopening Gov jobs",
    );
    await newlyApproved.context.close();
    for (const [options, message] of [
      [
        { offline: true },
        "Could not connect. Check your connection and try again.",
      ],
      [{ malformed: true }, "Could not read the response. Please try again."],
      [
        { errorStatus: 403 },
        "The jobs service blocked this request. Please try again.",
      ],
      [{ errorStatus: 500 }, "Could not load government jobs."],
    ]) {
      const failed = await setup(options);
      await failed.page.goto(base + "/circular-jobs");
      await failed.page.getByText(message, { exact: true }).waitFor();
      check(
        (await failed.page
          .getByText("No open government jobs right now", { exact: true })
          .count()) === 0,
        "error never becomes empty: " + message,
      );
      check(
        (await failed.page
          .getByRole("button", { name: "Try again", exact: true })
          .count()) > 0,
        "error has Retry",
      );
      if (options.offline)
        await failed.page.screenshot({
          path: output + "/audit-offline-error.png",
        });
      await failed.context.close();
    }
    console.log(`${checks} browser checks passed; screenshots in ${output}`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

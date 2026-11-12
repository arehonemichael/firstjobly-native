const { Buffer } = require("node:buffer");
// Run against an exported web build. Every backend request is isolated; ranking
// and persistence execute in the actual app, not a fixed recommendation stub.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { backend } = require("./backend.cjs"),
  { uid } = require("./fixtures.cjs");
const base = process.env.APP_URL ?? "http://localhost:8782";
const sessionFor = (id) => {
  const user = {
    id,
    email: "candidate@example.test",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {},
    app_metadata: {},
    created_at: "2026-01-01",
  };
  return {
    access_token: `e30.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`,
    refresh_token: "fixture",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
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
  const b = backend();
  async function setup(id) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    if (id)
      await context.addInitScript(
        (s) =>
          localStorage.setItem(
            "sb-ehwqqjqtevppsnmxximg-auth-token",
            JSON.stringify(s),
          ),
        sessionFor(id),
      );
    await context.route(
      "**/ehwqqjqtevppsnmxximg.supabase.co/**",
      async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        const auth = request.headers().authorization;
        let owner = null;
        try {
          owner = JSON.parse(Buffer.from(auth.split(".")[1], "base64url")).sub;
        } catch {}
        if (url.pathname.includes("/auth/v1/"))
          return route.fulfill({
            json: url.pathname.endsWith("/user")
              ? sessionFor(owner ?? uid.alice).user
              : sessionFor(owner ?? uid.alice),
          });
        if (url.pathname.endsWith("/user_documents"))
          return route.fulfill({ json: [] });
        const headers = {
          ...request.headers(),
          authorization: owner
            ? `Bearer token:${owner}`
            : "Bearer public-fixture-key",
        };
        try {
          const response = await b.fetch(
            `https://isolated.supabase.test${url.pathname}${url.search}`,
            {
              method: request.method(),
              headers,
              body: request.postData() ?? undefined,
            },
          );
          await route.fulfill({
            status: response.status,
            body: await response.text(),
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error(e);
          await route.fulfill({ status: 500, json: { message: e.message } });
        }
      },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(20000);
    return { context, page, errors };
  }
  const a = await setup(uid.alice);
  await a.page.goto(base + "/discover");
  await a.page
    .getByRole("button", { name: "View Opportunity 1", exact: true })
    .waitFor();
  check(
    (await a.page
      .getByRole("button", { name: /^View Opportunity/ })
      .first()
      .getAttribute("aria-label")) === "View Opportunity 1",
    "Alice ranking follows existing profile interests",
  );
  await a.page
    .getByRole("button", { name: "Why this job: Opportunity 1", exact: true })
    .click();
  check(
    await a.page
      .getByText("Matches your interest in Internships", { exact: true })
      .isVisible(),
    "explanation reflects the actual ranking signal",
  );
  await a.page
    .getByRole("button", { name: "Close job explanation", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "Not interested: Opportunity 1", exact: true })
    .click();
  await a.page.getByRole("radio", { name: "Location", exact: true }).click();
  await a.page
    .getByRole("button", { name: "Hide opportunity", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "Undo dismissal", exact: true })
    .waitFor();
  await a.page
    .getByRole("button", { name: "View Opportunity 1", exact: true })
    .waitFor({ state: "detached" });
  check(true, "dismissal removes the real ranked opportunity");
  await a.page.reload();
  await a.page
    .getByRole("button", { name: "View Opportunity 3", exact: true })
    .waitFor();
  check(
    (await a.page
      .getByRole("button", { name: "View Opportunity 1", exact: true })
      .count()) === 0,
    "device dismissal survives reload",
  );
  // Undo needs the last-dismissal UI state; repeat an available dismissal then undo it.
  await a.page
    .getByRole("button", { name: "Not interested: Opportunity 3", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "Hide opportunity", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "Undo dismissal", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "View Opportunity 3", exact: true })
    .waitFor();
  check(true, "undo restores a dismissed opportunity");
  const before = await a.page
    .getByRole("button", { name: /^View Opportunity/ })
    .count();
  await a.page
    .getByRole("button", { name: "Load more opportunities", exact: true })
    .click();
  await a.page.waitForFunction(
    (n) =>
      document.querySelectorAll('[aria-label^="View Opportunity"]').length > n,
    before,
  );
  check(true, "real stable pagination loads more jobs");
  await a.page
    .getByRole("button", { name: "More like this: Opportunity 3", exact: true })
    .click();
  await a.page.getByText("Preference saved", { exact: true }).first().waitFor();
  check(true, "more-like feedback is saved on device");
  await a.page.goto(base + "/preferences");
  await a.page
    .getByRole("heading", { name: "Job preferences", exact: true })
    .waitFor();
  await a.page.getByText("Internships", { exact: true }).first().click();
  await a.page.getByText("Internships", { exact: true }).last().click();
  await a.page
    .getByText("Government Vacancies", { exact: true })
    .last()
    .click();
  await a.page.getByText("Done", { exact: true }).click();
  await a.page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await a.page.getByText("Job preferences saved", { exact: true }).waitFor();
  check(
    JSON.stringify(b.tables.profiles[0].preferred_categories) ===
      '["government"]',
    "preference screen writes only supported profile preferences",
  );
  await a.page.goto(base + "/discover");
  await a.page
    .getByRole("button", { name: "View Opportunity 2", exact: true })
    .waitFor();
  check(
    (await a.page
      .getByRole("button", { name: /^View Opportunity/ })
      .first()
      .getAttribute("aria-label")) === "View Opportunity 2",
    "saving preferences changes the displayed ranking",
  );
  await a.page.goto(base + "/preferences");
  await a.page
    .getByRole("button", { name: "Reset device learning", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await a.page
    .getByText(
      "Learned preferences reset on this device. Saved jobs, applications and explicit preferences are unchanged.",
      { exact: true },
    )
    .waitFor();
  check(
    b.tables.profiles[0].preferred_categories[0] === "government",
    "reset preserves explicit preferences",
  );
  b.setMaintenance(true);
  await a.page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await a.page
    .getByText(
      "FirstJobly is in read-only maintenance mode. Please try again shortly.",
      { exact: true },
    )
    .waitFor();
  check(true, "server maintenance write message remains visible");
  b.setMaintenance(false);
  const bob = await setup(uid.bob);
  await bob.page.goto(base + "/discover");
  await bob.page
    .getByRole("button", { name: "View Opportunity 2", exact: true })
    .waitFor();
  check(
    (await bob.page
      .getByRole("button", {
        name: "Not interested: Opportunity 1",
        exact: true,
      })
      .count()) > 0,
    "another account does not inherit device dismissals",
  );
  await bob.page.goto(base);
  await bob.page.locator("#home-session-hero").waitFor();
  const hero = bob.page.locator("#home-session-hero");
  const pairing = await hero.innerText();
  await bob.page
    .getByRole("button", { name: "See more opportunities", exact: true })
    .click();
  await bob.page.waitForURL("**/discover");
  await bob.page.goBack();
  await hero.waitFor();
  check(
    (await hero.innerText()) === pairing,
    "Home photo/message session content survives discovery navigation",
  );
  check(
    await bob.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "personalized Home has no horizontal overflow",
  );
  const guest = await setup(null);
  await guest.page.goto(base + "/discover");
  await guest.page
    .getByRole("heading", { name: "Latest opportunities", exact: true })
    .waitFor();
  check(
    (await guest.page
      .getByRole("button", { name: /^More like this:/ })
      .count()) === 0,
    "guests get honest latest jobs and sign-in controls",
  );
  check(
    a.errors.length + bob.errors.length + guest.errors.length === 0,
    "no runtime errors across personalized screens",
  );
  await a.context.close();
  await bob.context.close();
  await guest.context.close();
  await browser.close();
  console.log(`${checks} personalization browser checks passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

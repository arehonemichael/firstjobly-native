/* Chromium web form/isolation checks, not native Files/mail/Keychain tests.
 * Every auth/backend request is intercepted; no real documents or applications. */
const { chromium } = require("playwright");
const { Buffer } = require("node:buffer");
const assert = require("node:assert/strict");
const base = process.env.APP_URL || "http://localhost:8840";
const aid = "00000000-0000-4000-8000-000000000001",
  bid = "00000000-0000-4000-8000-000000000002";
const storageKey = "sb-ehwqqjqtevppsnmxximg-auth-token";
function session(id) {
  const user = {
    id,
    email: `${id === aid ? "alice" : "bob"}@example.test`,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: "2026-01-01",
    app_metadata: {},
    user_metadata: {},
  };
  const token =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(
      JSON.stringify({
        sub: id,
        session_id: id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".fixture";
  return {
    user,
    access_token: token,
    refresh_token: "fixture",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
  };
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      ({ key, current }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(current));
        localStorage.setItem(
          "firstjobly.z83.base.native.v1",
          JSON.stringify({
            position: "OLD JOB",
            department: "OLD DEPARTMENT",
            reference: "OLD REFERENCE",
            idNumber: "LEGACY SECRET",
            signature: "LEGACY SIGNATURE",
          }),
        );
        localStorage.setItem(
          "firstjobly.cv.draft.v1",
          JSON.stringify({ firstName: "LEGACY OTHER USER" }),
        );
      },
      { key: storageKey, current: session(aid) },
    );
    await context.route("**/ehwqqjqtevppsnmxximg.supabase.co/**", async (r) => {
      const url = new URL(r.request().url());
      if (url.pathname.includes("/auth/v1/user"))
        return r.fulfill({ json: session(aid).user });
      if (url.pathname.includes("/auth/v1/token"))
        return r.fulfill({ json: session(aid) });
      if (url.pathname.includes("/profiles")) {
        const bob = (url.searchParams.get("id") || "").includes(bid);
        return r.fulfill({
          json: {
            id: bob ? bid : aid,
            first_name: bob ? "Bob" : "Alice",
            last_name: "Fixture",
            date_of_birth: "1990-05-09",
            phone: "0123456789",
            email: bob ? "bob@example.test" : "alice@example.test",
            address: "Fixture road",
            city: "Pretoria",
            province: "Gauteng",
            institution: "Fixture College",
            field_of_study: "Diploma",
            year_completed: 2020,
            languages: ["English"],
            onboarding_completed: true,
          },
        });
      }
      return r.fulfill({ json: [] });
    });
    await context.route("https://firstjobly.co.za/api/**", (r) =>
      r.fulfill({ json: { enabled: false } }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(120000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const box = (name) => page.getByRole("textbox", { name, exact: true });
    await page.goto(base + "/z83");
    await box("Surname and full names").waitFor();
    assert.equal(
      await box("Surname and full names").inputValue(),
      "FIXTURE ALICE",
    );
    assert.equal(
      await box("Date of birth (DD/MM/YYYY)").inputValue(),
      "09/05/1990",
    );
    for (const name of [
      "Position you are applying for (as advertised)",
      "Department where the position was advertised",
      "Reference number",
      "Identity number",
      "Initials (printed on both pages)",
      "Declaration date",
    ])
      assert.equal(await box(name).inputValue(), "");
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("firstjobly.z83.base.native.v1"),
      ),
      null,
    );
    await box("Position you are applying for (as advertised)").fill("Job A");
    await box("Reference number").fill("REF A");
    const review = page.getByRole("switch", {
      name: "I reviewed this Z83 for this application",
    });
    assert.equal(await review.isChecked(), false);
    await review.click();
    assert.equal(await review.isChecked(), true);
    await box("Identity number").fill("9876543210123");
    assert.equal(await review.isChecked(), false);
    assert.equal(
      await page.evaluate(() =>
        Object.values(localStorage).some((value) =>
          value.includes("9876543210123"),
        ),
      ),
      false,
    );
    await page.screenshot({
      path: "/tmp/firstjobly-z83-form.png",
      fullPage: true,
    });
    await page.reload();
    await box("Surname and full names").waitFor();
    assert.equal(await box("Reference number").inputValue(), "");
    assert.equal(await box("Identity number").inputValue(), "");
    assert.equal(await box("Declaration date").inputValue(), "");
    await box("Identity number").fill("9876543210123");
    async function switchTo(id) {
      await page.evaluate(
        ({ key, next }) => {
          localStorage.setItem(key, JSON.stringify(next));
          const channel = new BroadcastChannel(key);
          channel.postMessage({ event: "SIGNED_IN", session: next });
          setTimeout(() => channel.close(), 200);
        },
        { key: storageKey, next: session(id) },
      );
    }
    await switchTo(bid);
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Surname and full names"]')
          ?.value === "FIXTURE BOB",
    );
    assert.equal(await box("Identity number").inputValue(), "");
    await page.goto(base + "/cv-maker");
    await box("First name").waitFor();
    assert.equal(await box("First name").inputValue(), "");
    await box("First name").fill("Private Bob CV");
    await page.waitForTimeout(300);
    assert.ok(
      await page.evaluate(
        (key) => localStorage.getItem(key)?.includes("Private Bob CV"),
        "firstjobly.cv.draft.v1:" + bid,
      ),
    );
    await switchTo(aid);
    await page.waitForFunction(
      () => document.querySelector('[aria-label="First name"]')?.value === "",
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS profile/date autofill, no stale job/declaration, review invalidated on edit, no plaintext Z83 draft, account-switch and CV draft isolation (web fixtures only)",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

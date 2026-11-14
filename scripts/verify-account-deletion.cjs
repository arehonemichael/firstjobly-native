/* All auth/deletion requests are intercepted. No live account creation/deletion. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const base = process.env.APP_URL || "http://localhost:8840";
const owner = "00000000-0000-4000-8000-000000000001";
const user = {
  id: owner,
  email: "member@example.test",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-01-01",
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
  identities: [{ id: owner, provider: "email" }],
};
const token =
  Buffer.from('{"alg":"HS256"}').toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: owner,
      session_id: "00000000-0000-4000-8000-000000000010",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".fixture";
const session = {
  user,
  access_token: token,
  refresh_token: "fixture-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
};
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    async function setup(
      replies,
      failLogout = false,
      codeReply = null,
      google = false,
    ) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        (s) =>
          localStorage.setItem(
            "sb-ehwqqjqtevppsnmxximg-auth-token",
            JSON.stringify(s),
          ),
        google
          ? {
              ...session,
              user: {
                ...user,
                identities: [{ id: owner, provider: "google" }],
                app_metadata: { provider: "google", providers: ["google"] },
              },
            }
          : session,
      );
      await context.addInitScript(() =>
        localStorage.setItem("firstjobly.cv.draft.v1", "private-fixture-draft"),
      );
      let release;
      const heldReply = new Promise((resolve) => {
        release = resolve;
      });
      let codePosts = 0;
      let posts = 0,
        logouts = 0;
      const errors = [];
      await context.route(
        "**/ehwqqjqtevppsnmxximg.supabase.co/**",
        async (r) => {
          const p = new URL(r.request().url()).pathname;
          if (p.includes("/auth/v1/logout")) {
            logouts++;
            if (failLogout)
              return r.fulfill({
                status: 500,
                json: { error: "Local logout unavailable" },
              });
            return r.fulfill({ status: 204 });
          }
          if (p.includes("/auth/v1/user")) return r.fulfill({ json: user });
          if (p.includes("/auth/v1/token")) return r.fulfill({ json: session });
          return r.fulfill({ json: [] });
        },
      );
      await context.route("https://firstjobly.co.za/api/**", async (r) => {
        if (r.request().url().endsWith("/api/app/account/delete-code")) {
          codePosts++;
          assert.deepEqual(r.request().postDataJSON(), {});
          assert.equal(r.request().headers().authorization, "Bearer " + token);
          if (codeReply === "offline") return r.abort("failed");
          const result = codeReply ?? {
            status: 200,
            body: {
              sent: true,
              maskedEmail: "me****@example.test",
              expiresInSeconds: 600,
              expiresAt: new Date(Date.now() + 600000).toISOString(),
              retryAfterSeconds: 60,
            },
          };
          return r.fulfill({
            status: result.status,
            json: result.body,
            headers: result.headers ?? {},
          });
        }
        if (!r.request().url().endsWith("/api/app/account/delete"))
          return r.fulfill({ json: { enabled: false } });
        if (r.request().method() === "OPTIONS")
          return r.fulfill({
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "authorization,content-type",
            },
          });
        posts++;
        assert.equal(r.request().method(), "POST");
        assert.equal(r.request().headers().authorization, "Bearer " + token);
        assert.equal(r.request().headers()["x-fj-token"], undefined);
        assert.deepEqual(Object.keys(r.request().postDataJSON()).sort(), [
          "confirmEmail",
          "emailCode",
        ]);
        const reply = replies[Math.min(posts - 1, replies.length - 1)];
        if (reply === "offline") return r.abort("failed");
        if (reply.hold) await heldReply;
        return r.fulfill({ status: reply.status, json: reply.body });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(120000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.install();
      await page.goto(base + "/account-delete");
      await page
        .getByRole("textbox", { name: "Confirm account email" })
        .waitFor();
      return {
        context,
        page,
        errors,
        release,
        allowLogout() {
          failLogout = false;
        },
        get codePosts() {
          return codePosts;
        },
        get posts() {
          return posts;
        },
        get logouts() {
          return logouts;
        },
      };
    }
    async function requestCode(f) {
      const send = f.page.getByRole("button", {
        name: /^Send (confirmation code|again)/,
      });
      if (await send.isDisabled()) await f.page.clock.fastForward(61000);
      await send.click();
      await f.page.getByText(/Confirmation code sent to/).waitFor();
    }
    async function confirm(f) {
      await f.page
        .getByRole("textbox", { name: "Confirm account email" })
        .fill("member@example.test");
      await requestCode(f);
      await f.page
        .getByLabel("Email confirmation code", { exact: true })
        .fill("012345");
      await f.page
        .getByRole("switch", { name: "I understand deletion is permanent" })
        .click();
      await f.page
        .getByRole("button", {
          name: "Permanently delete my account",
          exact: true,
        })
        .click();
    }
    {
      const f = await setup([
        {
          status: 500,
          body: {
            error: "Temporary deletion failure. Please try again.",
            code: "deletion_failed",
            retry_safe: true,
          },
        },
        { status: 200, body: { deleted: true } },
      ]);
      assert.equal(
        await f.page
          .getByRole("button", {
            name: "Permanently delete my account",
            exact: true,
          })
          .isDisabled(),
        true,
      );
      await f.page.getByText(/no set deletion date/).waitFor();
      await confirm(f);
      await f.page
        .getByText("Temporary deletion failure. Please try again.", {
          exact: true,
        })
        .waitFor();
      assert.equal(f.posts, 1);
      assert.equal(f.logouts, 0);
      assert.equal(
        await f.page.evaluate(() =>
          localStorage.getItem("firstjobly.cv.draft.v1"),
        ),
        "private-fixture-draft",
      );
      assert.equal(
        await f.page
          .getByLabel("Email confirmation code", { exact: true })
          .inputValue(),
        "",
      );
      await requestCode(f);
      await f.page
        .getByLabel("Email confirmation code", { exact: true })
        .fill("012345");
      await f.page
        .getByRole("button", {
          name: "Permanently delete my account",
          exact: true,
        })
        .click();
      await f.page
        .getByText("Account deletion confirmed", { exact: true })
        .waitFor();
      await f.page.getByText(/Account-owned cleanup has finished/).waitFor();
      assert.equal(f.posts, 2);
      assert.equal(f.logouts, 1);
      assert.equal(
        await f.page.evaluate(() =>
          localStorage.getItem("firstjobly.cv.draft.v1"),
        ),
        null,
      );
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS typed confirmation, retention disclosure, 500 preservation, explicit retry, confirmed cleanup/session end",
      );
    }
    {
      const f = await setup([{ status: 200, body: { deleted: true } }], true);
      await confirm(f);
      await f.page
        .getByRole("button", { name: "Retry local cleanup", exact: true })
        .waitFor();
      assert.equal(f.posts, 1);
      f.allowLogout();
      await f.page
        .getByRole("button", { name: "Retry local cleanup", exact: true })
        .click();
      await f.page.getByText(/Account-owned cleanup has finished/).waitFor();
      assert.equal(f.posts, 1);
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log("PASS local cleanup retry never replays deletion POST");
    }
    {
      const f = await setup([
        { status: 200, body: { deleted: true }, hold: true },
      ]);
      await confirm(f);
      const b = {
        ...session,
        user: {
          ...user,
          id: "00000000-0000-4000-8000-000000000002",
          email: "other@example.test",
        },
      };
      await f.page.evaluate((next) => {
        const key = "sb-ehwqqjqtevppsnmxximg-auth-token";
        localStorage.setItem(key, JSON.stringify(next));
        localStorage.setItem(
          "firstjobly.cv.draft.v1",
          "new-account-private-draft",
        );
        const channel = new BroadcastChannel(key);
        channel.postMessage({ event: "SIGNED_IN", session: next });
        setTimeout(() => channel.close(), 100);
      }, b);
      await f.page
        .getByText("Account: other@example.test", { exact: true })
        .waitFor();
      f.release();
      await f.page.waitForTimeout(500);
      assert.equal(f.posts, 1);
      assert.equal(f.logouts, 0);
      assert.equal(
        await f.page.evaluate(() =>
          localStorage.getItem("firstjobly.cv.draft.v1"),
        ),
        "new-account-private-draft",
      );
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS account switch during POST preserves new account session and private draft",
      );
    }
    for (const reply of [
      "offline",
      {
        status: 401,
        body: { error: "Please sign in again.", code: "auth_required" },
      },
      {
        status: 403,
        body: {
          error: "Staff accounts need the support process.",
          code: "staff_protected",
        },
      },
    ]) {
      const f = await setup([reply]);
      await confirm(f);
      await f.page.getByRole("alert").waitFor();
      assert.equal(f.posts, 1);
      assert.equal(f.logouts, 0);
      assert.equal(
        await f.page
          .getByText("Account deletion confirmed", { exact: true })
          .count(),
        0,
      );
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS uncertain/auth/protected result sends once and preserves session",
      );
    }
    for (const google of [false, true]) {
      const f = await setup(
        [
          {
            status: 403,
            body: { error: "Wrong code", code: "code_wrong", attempts_left: 4 },
          },
        ],
        false,
        null,
        google,
      );
      await f.page
        .getByLabel("Confirm account email", { exact: true })
        .fill("member@example.test");
      assert.equal(
        await f.page
          .getByRole("button", { name: "Verify with Google again" })
          .count(),
        0,
      );
      assert.equal(
        await f.page
          .getByLabel("Confirm account password", { exact: true })
          .count(),
        0,
      );
      await requestCode(f);
      assert.equal(f.codePosts, 1);
      assert.equal(f.posts, 0);
      await f.page
        .getByLabel("Email confirmation code", { exact: true })
        .fill("012345");
      await f.page
        .getByRole("switch", { name: "I understand deletion is permanent" })
        .click();
      await f.page
        .getByRole("button", {
          name: "Permanently delete my account",
          exact: true,
        })
        .click();
      await f.page.getByText("4 attempts left for this code.").waitFor();
      assert.equal(f.posts, 1);
      assert.equal(f.logouts, 0);
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS email-code UI, no Google/password verification, wrong-code attempt count; provider=" +
          (google ? "google" : "email"),
      );
    }
    {
      const f = await setup([{ status: 200, body: { deleted: true } }], false, {
        status: 202,
        body: {
          sent: false,
          code: "send_uncertain",
          error: "Check inbox",
          maskedEmail: "me****@example.test",
          expiresInSeconds: 600,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          retryAfterSeconds: 60,
        },
      });
      await f.page
        .getByLabel("Confirm account email", { exact: true })
        .fill("member@example.test");
      await f.page
        .getByRole("button", { name: "Send confirmation code", exact: true })
        .click();
      await f.page.getByText(/Delivery is not confirmed/).waitFor();
      assert.equal(f.codePosts, 1);
      assert.equal(f.posts, 0);
      assert.equal(
        await f.page
          .getByRole("button", { name: /Send again in/ })
          .isDisabled(),
        true,
      );
      await f.page.clock.fastForward(61000);
      assert.equal(f.codePosts, 1);
      assert.equal(f.posts, 0);
      assert.equal(
        await f.page
          .getByRole("button", { name: "Send again", exact: true })
          .isEnabled(),
        true,
      );
      await f.page
        .getByLabel("Email confirmation code", { exact: true })
        .fill("012345");
      await f.page
        .getByRole("switch", { name: "I understand deletion is permanent" })
        .click();
      await f.page
        .getByRole("button", {
          name: "Permanently delete my account",
          exact: true,
        })
        .click();
      await f.page
        .getByText("Account deletion confirmed", { exact: true })
        .waitFor();
      assert.equal(f.codePosts, 1);
      assert.equal(f.posts, 1);
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS 202 keeps delivered code usable, countdown enables manual resend only",
      );
    }
    {
      const f = await setup([{ status: 200, body: { deleted: true } }]);
      await f.page
        .getByLabel("Confirm account email", { exact: true })
        .fill("member@example.test");
      await requestCode(f);
      await f.page
        .getByLabel("Email confirmation code", { exact: true })
        .fill("012345");
      async function changeSession(sessionId, event) {
        const jwt =
          "eyJhbGciOiJIUzI1NiJ9." +
          Buffer.from(
            JSON.stringify({
              sub: owner,
              session_id: sessionId,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ).toString("base64url") +
          ".fixture";
        await f.page.evaluate(
          ({ next, event }) => {
            const key = "sb-ehwqqjqtevppsnmxximg-auth-token";
            localStorage.setItem(key, JSON.stringify(next));
            const channel = new BroadcastChannel(key);
            channel.postMessage({ event, session: next });
            setTimeout(() => channel.close(), 100);
          },
          { next: { ...session, access_token: jwt }, event },
        );
      }
      await changeSession(
        "00000000-0000-4000-8000-000000000010",
        "TOKEN_REFRESHED",
      );
      await f.page.waitForTimeout(250);
      assert.equal(
        await f.page
          .getByLabel("Email confirmation code", { exact: true })
          .inputValue(),
        "012345",
      );
      await changeSession("00000000-0000-4000-8000-000000000011", "SIGNED_IN");
      await f.page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Email confirmation code"]')
            ?.value === "",
      );
      assert.equal(
        await f.page
          .getByLabel("Confirm account email", { exact: true })
          .inputValue(),
        "",
      );
      assert.equal(f.codePosts, 1);
      assert.equal(f.posts, 0);
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS refresh keeps code; same-account re-login clears code/confirmation without sending",
      );
    }
    for (const result of [
      {
        status: 502,
        body: {
          error: "Mail refused",
          code: "send_failed",
          retry_after_seconds: 60,
        },
        headers: { "Retry-After": "60" },
      },
      {
        status: 503,
        body: { error: "Code busy", code: "send_busy", retry_after_seconds: 5 },
        headers: { "Retry-After": "5" },
      },
      {
        status: 429,
        body: {
          error: "Codes locked",
          code: "code_locked",
          retry_after_seconds: 900,
        },
        headers: { "Retry-After": "900" },
      },
    ]) {
      const f = await setup(
        [{ status: 200, body: { deleted: true } }],
        false,
        result,
      );
      await f.page
        .getByLabel("Confirm account email", { exact: true })
        .fill("member@example.test");
      await f.page
        .getByRole("button", { name: "Send confirmation code", exact: true })
        .click();
      await f.page.getByText(result.body.error, { exact: true }).waitFor();
      assert.equal(f.codePosts, 1);
      assert.equal(f.posts, 0);
      assert.equal(f.logouts, 0);
      assert.equal(
        await f.page
          .getByRole("button", { name: /Send again in/ })
          .isDisabled(),
        true,
      );
      if (result.body.code === "code_locked") {
        await f.page
          .getByLabel("Email confirmation code", { exact: true })
          .fill("012345");
        await f.page
          .getByRole("switch", { name: "I understand deletion is permanent" })
          .click();
        assert.equal(
          await f.page
            .getByRole("button", {
              name: "Permanently delete my account",
              exact: true,
            })
            .isDisabled(),
          true,
        );
      }
      assert.equal(
        await f.page.evaluate(() =>
          localStorage.getItem("firstjobly.cv.draft.v1"),
        ),
        "private-fixture-draft",
      );
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS send failure/cooldown preserves private data: " +
          result.body.code,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

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
    JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600 }),
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
    async function setup(replies, failLogout = false) {
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
        session,
      );
      await context.addInitScript(() =>
        localStorage.setItem("firstjobly.cv.draft.v1", "private-fixture-draft"),
      );
      let release;
      const heldReply = new Promise((resolve) => {
        release = resolve;
      });
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
          "password",
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
        get posts() {
          return posts;
        },
        get logouts() {
          return logouts;
        },
      };
    }
    async function confirm(f) {
      await f.page
        .getByRole("textbox", { name: "Confirm account email" })
        .fill("member@example.test");
      await f.page
        .getByLabel("Confirm account password", { exact: true })
        .fill("fixture-password");
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
          .getByLabel("Confirm account password", { exact: true })
          .inputValue(),
        "",
      );
      await f.page
        .getByLabel("Confirm account password", { exact: true })
        .fill("fixture-password");
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
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

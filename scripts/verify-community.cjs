/* Community end-to-end checks use isolated auth/API responses only. No live writes. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const base = process.env.APP_URL || "http://localhost:8081";
const shots = process.env.SCREENSHOT_DIR || "/tmp/community-checks";
fs.mkdirSync(shots, { recursive: true });
const uid = "00000000-0000-4000-8000-000000000001";
const named = {
  id: "named-member",
  name: "Thandi M.",
  anonymous: false,
  handle: "",
  avatarHue: 172,
  isMine: false,
  viewerFollows: false,
};
const anon = {
  id: null,
  name: null,
  anonymous: true,
  handle: "CleverIntern76",
  avatarHue: 250,
  isMine: false,
  viewerFollows: false,
};
const own = {
  id: uid,
  name: "Test C.",
  anonymous: false,
  handle: "",
  avatarHue: 42,
  isMine: true,
  viewerFollows: false,
};
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WQAAAABJRU5ErkJggg==";
const makePost = (id, title, author = named) => ({
  id,
  title,
  topic: "general",
  body: "A detailed career discussion shared by the website.",
  author: { ...author },
  upvoteCount: 3,
  commentCount: 3,
  viewerVoted: false,
  viewerSaved: false,
  status: "visible",
  pinned: false,
  piiFlagged: false,
  sharedFromGraduateRoom: false,
  edited: false,
  createdAt: "2026-11-11T17:10:00Z",
  media: [],
});
let checks = 0;
function check(v, label) {
  assert.ok(v, label);
  checks++;
  console.log("PASS " + label);
}
async function revealActions(container) {
  await container
    .getByRole("button", { name: /^(More|Hide) discussion actions$/ })
    .first()
    .waitFor();
  const more = container
    .getByRole("button", { name: "More discussion actions", exact: true })
    .first();
  if (await more.count()) await more.click();
}
function sessionFor(id = uid) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.test",
    email_confirmed_at: "2026-01-01",
    user_metadata: {},
    app_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  return {
    access_token:
      Buffer.from('{"alg":"HS256"}').toString("base64url") +
      "." +
      Buffer.from(
        JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url") +
      ".fixture",
    refresh_token: "fixture-refresh",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    async function setup(options = {}) {
      const context = await browser.newContext({
        viewport: { width: options.width || 390, height: 844 },
        reducedMotion: "reduce",
      });
      const session = sessionFor(options.owner || uid);
      await context.addInitScript(
        ({ session, guest, draft }) => {
          if (!guest)
            localStorage.setItem(
              "sb-ehwqqjqtevppsnmxximg-auth-token",
              JSON.stringify(session),
            );
          if (draft)
            localStorage.setItem(
              "fj-community-draft:" + draft.owner,
              JSON.stringify(draft.value),
            );
        },
        { session, guest: options.guest, draft: options.draft },
      );
      const state = {
        calls: [],
        viewer: {
          member: !options.incomplete,
          banned: !!options.banned,
          canWrite: !options.incomplete && !options.banned,
          isStaff: false,
          newAccount: !!options.newAccount,
        },
        posts: [
          makePost("canonical-post", "Website-created discussion"),
          makePost("anonymous-post", "Anonymous career question", anon),
          makePost("own-post", "My editable discussion", own),
          {
            ...makePost("pinned-post", "Pinned career guidance"),
            pinned: true,
            sharedFromGraduateRoom: true,
          },
        ],
        comments: [
          {
            id: "reply-one",
            postId: "canonical-post",
            parentId: null,
            body: "A helpful first reply.",
            author: { ...named },
            status: "visible",
            edited: false,
            createdAt: "2026-11-11T17:11:00Z",
          },
          {
            id: "reply-two",
            postId: "canonical-post",
            parentId: "reply-one",
            body: "Anonymous second level.",
            author: { ...anon },
            status: "visible",
            edited: false,
            createdAt: "2026-11-11T17:12:00Z",
          },
          {
            id: "reply-three",
            postId: "canonical-post",
            parentId: "reply-two",
            body: "My third level reply.",
            author: { ...own },
            status: "visible",
            edited: false,
            createdAt: "2026-11-11T17:13:00Z",
          },
        ],
        fail: null,
        delay: 0,
        creates: 0,
        reports: 0,
        refreshes: 0,
        mediaRequests: 0,
      };
      state.posts[0].media = [
        {
          url: "https://community-fixture.invalid/photo.png?signature=one",
          width: 1600,
          height: 1200,
        },
      ];
      await context.route("https://community-fixture.invalid/**", (r) => {
        state.mediaRequests++;
        if (options.mediaFailure)
          return r.fulfill({ status: 403, body: "Expired fixture image" });
        return r.fulfill({
          contentType: "image/png",
          body: Buffer.from(png, "base64"),
        });
      });
      await context.route("**/ehwqqjqtevppsnmxximg.supabase.co/**", (r) => {
        const path = new URL(r.request().url()).pathname;
        if (path.includes("/auth/v1/token")) {
          state.refreshes++;
          return r.fulfill({ json: session });
        }
        if (path.includes("/auth/v1/user"))
          return r.fulfill({ json: session.user });
        if (path.includes("/auth/v1/logout"))
          return r.fulfill({ status: 204, body: "" });
        return r.fulfill({
          json: path.includes("/profiles")
            ? {
                id: session.user.id,
                first_name: "Test",
                onboarding_completed: true,
              }
            : [],
        });
      });
      await context.route("**/api/graduateroom", () => {
        throw Error("Obsolete endpoint requested");
      });
      const allowed = {
        "viewer-state": [],
        "list-posts": ["scope", "topic", "search", "cursor", "limit"],
        "get-post": ["postId"],
        "list-comments": ["postId", "cursor"],
        "create-post": ["title", "body", "topic", "isAnonymous", "photos"],
        "edit-post": ["postId", "title", "body", "topic"],
        "create-comment": ["postId", "parentId", "body", "isAnonymous"],
        "edit-comment": ["commentId", "body"],
        "toggle-vote": ["postId"],
        "toggle-save": ["postId"],
        "toggle-follow": ["targetId"],
        "delete-post": ["postId"],
        "delete-comment": ["commentId"],
        report: ["postId", "commentId", "reason", "details"],
      };
      await context.route(
        "https://firstjobly.co.za/api/community",
        async (r) => {
          const request = r.request();
          assert.equal(new URL(request.url()).search, "");
          assert.match(request.headers().authorization || "", /^Bearer /);
          const { action, data } = request.postDataJSON();
          assert.ok(action in allowed, action);
          assert.ok(
            Object.keys(data).every((k) => allowed[action].includes(k)),
            action + " strict fields",
          );
          state.calls.push({ action, data });
          if (state.fail?.action === action) {
            const f = state.fail;
            state.fail = null;
            if (f.network) return r.abort("failed");
            return r.fulfill({
              status: f.status || 400,
              json: {
                error: f.error || "Fixture rejection",
                code: f.code || "INVALID",
              },
              headers: f.retry ? { "Retry-After": String(f.retry) } : {},
            });
          }
          if (state.delay && action.startsWith("toggle-"))
            await new Promise((done) => setTimeout(done, state.delay));
          if (options.slow && action === "list-posts")
            await new Promise((done) => setTimeout(done, 800));
          if (action === "viewer-state")
            return r.fulfill({ json: state.viewer });
          const reading = ["list-posts", "get-post", "list-comments"];
          if (!state.viewer.member)
            return r.fulfill({
              status: 403,
              json: {
                error: "Finish setting up your account.",
                code: "NOT_MEMBER",
              },
            });
          if (
            !state.viewer.canWrite &&
            !reading.includes(action) &&
            action !== "report"
          )
            return r.fulfill({
              status: 403,
              json: {
                error: "Your Community access is suspended.",
                code: "BANNED",
              },
            });
          let result = { ok: true };
          if (action === "list-posts") {
            let posts = state.posts.filter(
              (p) => p.status === "visible" || p.author.isMine,
            );
            if (data.scope === "saved")
              posts = posts.filter((p) => p.viewerSaved);
            if (data.scope === "mine")
              posts = posts.filter((p) => p.author.isMine);
            if (data.scope === "foryou")
              posts = posts.filter(
                (p) => !p.author.anonymous && p.author.viewerFollows,
              );
            if (data.topic) posts = posts.filter((p) => p.topic === data.topic);
            if (data.search)
              posts = posts.filter((p) =>
                (p.title + " " + p.body)
                  .toLowerCase()
                  .includes(data.search.toLowerCase()),
              );
            result = data.cursor
              ? {
                  posts: [makePost("second-page", "Second page discussion")],
                  nextCursor: null,
                }
              : {
                  posts: posts.filter((p) => !p.pinned),
                  nextCursor:
                    data.scope === "all" && !data.search && !data.topic
                      ? "page-two"
                      : null,
                  ...(data.scope === "all" && !data.topic && !data.search
                    ? { pinned: posts.filter((p) => p.pinned) }
                    : {}),
                };
          } else if (action === "get-post") {
            const post = state.posts.find(
              (p) =>
                p.id ===
                (data.postId === "legacy-post"
                  ? "canonical-post"
                  : data.postId),
            );
            if (!post)
              return r.fulfill({
                status: 404,
                json: { error: "Discussion not found.", code: "NOT_FOUND" },
              });
            result = {
              post,
              comments: state.comments.filter((c) => c.postId === post.id),
              nextCursor: post.id === "canonical-post" ? "comments-two" : null,
            };
          } else if (action === "list-comments")
            result = {
              comments: [
                {
                  id: "later-comment",
                  postId: data.postId,
                  parentId: null,
                  body: "A later paginated reply.",
                  author: named,
                  status: "visible",
                  edited: false,
                  createdAt: "2026-11-11T17:15:00Z",
                },
              ],
              nextCursor: null,
            };
          else if (action === "toggle-vote") {
            const p = state.posts.find((p) => p.id === data.postId);
            p.viewerVoted = !p.viewerVoted;
            p.upvoteCount += p.viewerVoted ? 1 : -1;
            result = { voted: p.viewerVoted };
          } else if (action === "toggle-save") {
            const p = state.posts.find((p) => p.id === data.postId);
            p.viewerSaved = !p.viewerSaved;
            result = { saved: p.viewerSaved };
          } else if (action === "toggle-follow") {
            for (const p of state.posts)
              if (p.author.id === data.targetId)
                p.author.viewerFollows = !p.author.viewerFollows;
            result = {
              following: state.posts.find((p) => p.author.id === data.targetId)
                .author.viewerFollows,
            };
          } else if (action === "create-post") {
            state.creates++;
            const p = makePost(
              "created-post",
              data.title,
              data.isAnonymous ? { ...anon, isMine: true } : own,
            );
            p.body = data.body;
            p.topic = data.topic;
            p.status = "held";
            p.media = (data.photos || []).map(() => ({
              url: "https://community-fixture.invalid/uploaded.png",
              width: 1,
              height: 1,
            }));
            state.posts.push(p);
            result = { id: p.id, piiWarning: true };
          } else if (action === "edit-post") {
            const p = state.posts.find((p) => p.id === data.postId);
            Object.assign(p, {
              title: data.title,
              body: data.body,
              topic: data.topic,
              edited: true,
            });
          } else if (action === "create-comment") {
            state.comments.push({
              id: "created-reply",
              postId: data.postId,
              parentId: data.parentId || null,
              body: data.body,
              author: data.isAnonymous ? { ...anon, isMine: true } : own,
              status: "held",
              edited: false,
              createdAt: "2026-11-11T17:16:00Z",
            });
            result = { id: "created-reply", piiWarning: true };
          } else if (action === "edit-comment") {
            const c = state.comments.find((c) => c.id === data.commentId);
            c.body = data.body;
            c.edited = true;
          } else if (action === "delete-post") {
            const p = state.posts.find((p) => p.id === data.postId);
            p.status = "author_deleted";
          } else if (action === "delete-comment") {
            state.comments.find((c) => c.id === data.commentId).status =
              "author_deleted";
          } else if (action === "report") {
            state.reports++;
            result = { ok: true, duplicate: state.reports > 1 };
          }
          return r.fulfill({ json: JSON.parse(JSON.stringify(result)) });
        },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      return { context, page, state, errors };
    }
    // Shared feed, filtering, safe optimistic updates, reports and canonical routing.
    {
      const { context, page, state, errors } = await setup({ width: 320 });
      await page.goto(base + "/community");
      await page
        .getByRole("button", {
          name: "Open discussion: Website-created discussion",
          exact: true,
        })
        .waitFor();
      check(
        await page.getByText("Ask questions. Share advice.").isVisible(),
        "Community heading and real wording",
      );
      check(
        await page
          .getByText("Shared from GraduateRoom", { exact: true })
          .isVisible(),
        "legacy attribution preserved",
      );
      check(
        await page.getByText("CleverIntern76", { exact: true }).isVisible(),
        "server anonymous nickname displayed",
      );
      check(
        await page.getByText("CI", { exact: true }).isVisible(),
        "anonymous initials avatar",
      );
      const card = page.getByTestId("community-post-canonical-post");
      await page.screenshot({
        path: shots + "/feed-320.png",
        fullPage: true,
      });
      state.delay = 450;
      await card
        .getByRole("button", { name: "Helpful · 3", exact: true })
        .click();
      await card
        .getByRole("button", { name: "Helpful · 4", exact: true })
        .waitFor();
      check(
        await card
          .getByRole("button", { name: "Helpful · 4", exact: true })
          .isDisabled(),
        "optimistic Helpful locks repeated taps",
      );
      await page.waitForTimeout(650);
      check(
        state.calls.filter((c) => c.action === "toggle-vote").length === 1,
        "one Helpful request",
      );
      state.fail = {
        action: "toggle-save",
        error: "Saving is temporarily unavailable.",
      };
      await card
        .getByRole("button", { name: "Save discussion", exact: true })
        .click();
      await card.getByText("Saving is temporarily unavailable.").waitFor();
      check(
        await card
          .getByRole("button", { name: "Save discussion", exact: true })
          .isVisible(),
        "failed optimistic Save rolls back",
      );
      await card
        .getByRole("button", { name: "Save discussion", exact: true })
        .click();
      await card
        .getByRole("button", { name: "Unsave discussion", exact: true })
        .waitFor();
      check(true, "Save confirmed");
      await page
        .getByRole("button", { name: "More feeds", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Saved", exact: true })
        .first()
        .click();
      await page.waitForTimeout(400);
      check(
        state.calls.some(
          (c) => c.action === "list-posts" && c.data.scope === "saved",
        ),
        "Saved scope uses shared service",
      );
      await page.getByRole("button", { name: "Saved", exact: true }).click();
      await page
        .getByRole("button", { name: "Following", exact: true })
        .click();
      await page
        .getByText("Follow members to see their discussions here.")
        .waitFor();
      check(true, "Following means followed members");
      await page.getByRole("button", { name: "New", exact: true }).click();
      await revealActions(card);
      await card.getByRole("button", { name: "Follow", exact: true }).click();
      await card
        .getByRole("button", { name: "Unfollow", exact: true })
        .waitFor();
      check(
        state.calls.some(
          (c) =>
            c.action === "toggle-follow" && c.data.targetId === "named-member",
        ),
        "Follow uses named returned ID",
      );
      check(
        (await page
          .getByTestId("community-post-anonymous-post")
          .getByRole("button", { name: /^(Follow|Unfollow)$/ })
          .count()) === 0,
        "no following anonymous authors",
      );
      await page
        .getByRole("button", { name: "Top this week", exact: true })
        .click();
      await page.waitForTimeout(250);
      check(
        state.calls.some(
          (c) =>
            c.action === "list-posts" &&
            c.data.scope === "top" &&
            c.data.limit === 50,
        ),
        "Top this week scope",
      );
      await page
        .getByRole("button", { name: "More feeds", exact: true })
        .click();
      await page.getByRole("button", { name: "My posts", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Open discussion: My editable discussion",
          exact: true,
        })
        .waitFor();
      check(true, "My posts scope");
      await page.getByRole("button", { name: "New", exact: true }).click();
      await page
        .getByRole("button", { name: "Filter by topic", exact: true })
        .click();
      await page
        .getByRole("button", { name: "CV review", exact: true })
        .click();
      await page.waitForTimeout(300);
      check(
        state.calls.some(
          (c) => c.action === "list-posts" && c.data.topic === "cv_review",
        ),
        "exact topic values",
      );
      await page
        .getByRole("button", { name: "All topics", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Search discussions", exact: true })
        .fill("no-matching-fixture");
      await page.getByText("No discussions match your filters.").waitFor();
      check(true, "filtered empty state explains missing results");
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .click();
      await card.waitFor();
      check(
        (await page
          .getByRole("textbox", { name: "Search discussions", exact: true })
          .inputValue()) === "",
        "reset clears search and restores feed",
      );
      const before = state.calls.length;
      await page
        .getByRole("textbox", { name: "Search discussions", exact: true })
        .fill("Website");
      await page.waitForTimeout(120);
      check(
        !state.calls.slice(before).some((c) => c.data.search === "Website"),
        "search waits for debounce",
      );
      await page.waitForTimeout(300);
      check(
        state.calls.some((c) => c.data.search === "Website"),
        "search sends after 300ms",
      );
      await page
        .getByRole("textbox", { name: "Search discussions", exact: true })
        .fill("");
      await page.waitForTimeout(450);
      await page
        .getByRole("button", { name: "Load more discussions", exact: true })
        .click();
      await page.getByText("Second page discussion", { exact: true }).waitFor();
      check(
        state.calls.some((c) => c.data.cursor === "page-two"),
        "feed cursor pagination",
      );
      await revealActions(card);
      await card
        .getByRole("button", { name: "Report discussion", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Scam or fake job", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Report details", exact: true })
        .fill("Fixture report");
      await page
        .getByRole("button", { name: "Send report", exact: true })
        .click();
      await page.getByText("Thanks — a moderator will review this.").waitFor();
      check(
        state.calls.some(
          (c) => c.action === "report" && c.data.reason === "scam",
        ),
        "report exact reason and friendly acknowledgement",
      );
      await page.goto(base + "/graduateroom/legacy-post");
      await page.waitForURL("**/community/canonical-post");
      await page.getByText("A helpful first reply.", { exact: true }).waitFor();
      check(true, "legacy IDs redirect to canonical Community discussion");
      check(
        (await page
          .getByRole("button", {
            name: "Reply to CleverIntern76",
            exact: true,
          })
          .count()) === 1,
        "second-level reply can receive a third level",
      );
      check(
        (await page
          .getByRole("button", { name: "Reply to Test C.", exact: true })
          .count()) === 0,
        "reply depth capped at three levels",
      );
      await page
        .getByRole("button", { name: "Reply to Thandi M.", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Add a helpful reply", exact: true })
        .fill("My useful reply with candidate@example.test");
      await page
        .getByRole("switch", { name: "Reply anonymously", exact: true })
        .click();
      state.fail = { action: "create-comment", network: true };
      await page.getByRole("button", { name: "Reply", exact: true }).click();
      await page.getByText(/We couldn't confirm the result/).waitFor();
      check(
        (await page
          .getByRole("textbox", { name: "Add a helpful reply", exact: true })
          .inputValue()) === "My useful reply with candidate@example.test",
        "reply retained after uncertain result",
      );
      await page.getByRole("button", { name: "Reply", exact: true }).click();
      await page.getByTestId("community-reply-created-reply").waitFor();
      check(
        state.calls.some(
          (c) =>
            c.action === "create-comment" &&
            c.data.parentId === "reply-one" &&
            c.data.isAnonymous,
        ),
        "thread reply context and anonymity",
      );
      check(
        await page
          .getByTestId("community-reply-created-reply")
          .getByText("Hidden while a moderator reviews it.", { exact: true })
          .isVisible(),
        "held reply status shown",
      );
      await page
        .getByRole("button", { name: "Load more replies", exact: true })
        .click();
      await page
        .getByText("A later paginated reply.", { exact: true })
        .waitFor();
      check(
        state.calls.some(
          (c) =>
            c.action === "list-comments" && c.data.cursor === "comments-two",
        ),
        "comment cursor pagination",
      );
      await page
        .getByTestId("community-reply-reply-three")
        .getByRole("button", { name: "Edit reply", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Edit reply details", exact: true })
        .fill("Updated third-level reply.");
      await page
        .getByRole("button", { name: "Save reply changes", exact: true })
        .click();
      await page
        .getByTestId("community-reply-reply-three")
        .getByText("Updated third-level reply.", { exact: true })
        .waitFor();
      check(true, "author reply editing");
      await page
        .getByTestId("community-reply-reply-three")
        .getByRole("button", { name: "Delete reply", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page
        .getByTestId("community-reply-reply-three")
        .getByText("This reply was removed.", { exact: true })
        .waitFor();
      check(true, "confirmed reply soft deletion");
      await page.screenshot({
        path: shots + "/discussion-320.png",
        fullPage: true,
      });
      check(errors.length === 0, "feed/detail have no runtime errors");
      await context.close();
    }
    // Composer, local draft restoration, media, safe failures, successful held status.
    {
      const { context, page, state, errors } = await setup();
      await page.goto(base + "/community/new");
      await page
        .getByRole("textbox", { name: "Discussion title", exact: true })
        .waitFor();
      await page
        .getByRole("textbox", { name: "Discussion title", exact: true })
        .fill("A useful question for the community");
      await page
        .getByRole("textbox", { name: "Discussion details", exact: true })
        .fill("Here is my question, with enough context for other members.");
      await page.waitForTimeout(550);
      await page.reload();
      await page.getByText("Your draft was restored on this device.").waitFor();
      check(
        (await page
          .getByRole("textbox", { name: "Discussion title", exact: true })
          .inputValue()) === "A useful question for the community",
        "per-user draft restores after reload",
      );
      await page
        .getByRole("button", { name: "Back to Community", exact: true })
        .click();
      await page
        .getByText("Discard unsaved discussion changes?", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      check(
        await page
          .getByRole("textbox", { name: "Discussion details", exact: true })
          .isVisible(),
        "discard confirmation preserves unsaved changes on cancel",
      );
      const chooser = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: "Add photos", exact: true })
        .click();
      await (
        await chooser
      ).setFiles({
        name: "fixture.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
      await page
        .getByRole("button", { name: "Remove photo 1", exact: true })
        .waitFor();
      check(true, "JPEG/PNG photo selected with existing document picker");
      await page
        .getByRole("switch", { name: "Post anonymously", exact: true })
        .click();
      state.fail = {
        action: "create-post",
        status: 409,
        code: "SPAM",
        error:
          "This looks like it may break our rules on scams or spam, so it wasn’t posted.",
      };
      await page
        .getByRole("button", { name: "Publish discussion", exact: true })
        .click();
      await page.getByText(/This looks like it may break our rules/).waitFor();
      check(
        (await page
          .getByRole("textbox", { name: "Discussion details", exact: true })
          .inputValue()) ===
          "Here is my question, with enough context for other members.",
        "post draft preserved on rejection",
      );
      check(state.creates === 0, "rejected post not represented as published");
      await page
        .getByRole("button", { name: "Publish discussion", exact: true })
        .click();
      await page.waitForURL("**/community/created-post?pii=true");
      await page
        .getByText("Hidden from others while a moderator reviews it.", {
          exact: true,
        })
        .waitFor();
      check(state.creates === 1, "one successful publication");
      check(
        state.calls.some(
          (c) =>
            c.action === "create-post" &&
            c.data.photos?.[0] &&
            Object.keys(c.data.photos[0]).join(",") === "data" &&
            c.data.isAnonymous,
        ),
        "strict photo payload and anonymous posting",
      );
      check(
        await page.getByText("CleverIntern76", { exact: true }).isVisible(),
        "new anonymous post uses server nickname",
      );
      check(
        await page.evaluate(
          () =>
            !Object.keys(localStorage).some((k) =>
              k.startsWith("fj-community-draft:"),
            ),
        ),
        "successful publication clears draft",
      );
      check(
        errors.length === 0,
        "composer and publication have no runtime errors",
      );
      await context.close();
    }
    // Editing/deletion and photo viewer exercise the full mobile surfaces.
    {
      const { context, page, state, errors } = await setup();
      await page.goto(base + "/community/own-post");
      await revealActions(page.getByTestId("community-post-own-post"));
      await page
        .getByRole("button", { name: "Edit discussion", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Discussion title", exact: true })
        .fill("My updated discussion title");
      await page
        .getByRole("button", { name: "Save discussion changes", exact: true })
        .click();
      await page.waitForURL("**/community/own-post");
      await page
        .getByTestId("community-post-own-post")
        .getByText("My updated discussion title", { exact: true })
        .waitFor();
      check(
        state.calls.some(
          (c) =>
            c.action === "edit-post" &&
            !("photos" in c.data) &&
            !("isAnonymous" in c.data),
        ),
        "post editing uses only documented fields",
      );
      await revealActions(page.getByTestId("community-post-own-post"));
      await page
        .getByRole("button", { name: "Delete discussion", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page
        .getByText("This discussion is no longer visible to others.", {
          exact: true,
        })
        .waitFor();
      check(true, "confirmed post soft deletion shows status");
      await page.goto(base + "/community/canonical-post");
      await page
        .getByRole("button", { name: "View discussion photo", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close photos", exact: true })
        .waitFor();
      check(
        await page
          .getByRole("button", { name: "Next photo", exact: true })
          .isDisabled(),
        "mobile photo viewer has bounded navigation",
      );
      await page
        .getByRole("button", { name: "Close photos", exact: true })
        .click();
      await page
        .getByTestId("community-reply-reply-one")
        .getByRole("button", { name: "Report reply", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Shares personal information",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Send report", exact: true })
        .click();
      await page.getByText("Thanks — a moderator will review this.").waitFor();
      check(
        state.calls.some(
          (c) =>
            c.action === "report" &&
            c.data.commentId === "reply-one" &&
            !("postId" in c.data),
        ),
        "reply reports specify exactly one target",
      );
      check(
        errors.length === 0,
        "post editing/deletion and viewer have no runtime errors",
      );
      await context.close();
    }
    // Drafts survive intentional save/close and clear through the actual SDK
    // sign-out notification path, even while Community is not mounted.
    {
      const { context, page } = await setup();
      await page.goto(base + "/community/new");
      await page
        .getByRole("textbox", { name: "Discussion title", exact: true })
        .fill("Keep my local discussion draft");
      await page
        .getByRole("button", { name: "Save draft and close", exact: true })
        .click();
      await page.waitForURL("**/community");
      await page
        .getByRole("button", { name: "Ask or share", exact: true })
        .click();
      await page.getByText("Your draft was restored on this device.").waitFor();
      check(
        (await page
          .getByRole("textbox", { name: "Discussion title", exact: true })
          .inputValue()) === "Keep my local discussion draft",
        "save-and-close retains local draft",
      );
      await page
        .getByRole("button", { name: "Save draft and close", exact: true })
        .click();
      await page.waitForURL("**/community");
      await page.goto(base + "/jobs");
      await page
        .locator('[data-testid="application-shell"]:not([inert])')
        .waitFor();
      await page.evaluate(() => {
        const key = "sb-ehwqqjqtevppsnmxximg-auth-token";
        localStorage.removeItem(key);
        const channel = new BroadcastChannel(key);
        channel.postMessage({ event: "SIGNED_OUT", session: null });
        setTimeout(() => channel.close(), 100);
      });
      await page.waitForFunction(
        () =>
          !Object.keys(localStorage).some((k) =>
            k.startsWith("fj-community-draft:"),
          ),
      );
      check(true, "SDK sign-out event clears drafts with Community unmounted");
      await page.getByRole("tab", { name: "Community", exact: true }).click();
      await page
        .getByText("Sign in to connect with other job seekers.")
        .waitFor();
      check(
        (await page
          .getByText("Website-created discussion", { exact: true })
          .count()) === 0,
        "sign-out removes private Community content",
      );
      await context.close();
    }
    {
      const { context, page } = await setup({
        owner: "00000000-0000-4000-8000-000000000002",
        draft: {
          owner: uid,
          value: {
            title: "Private first-account text",
            body: "A private local discussion draft",
            topic: "general",
            isAnonymous: false,
            photos: [],
          },
        },
      });
      await page.goto(base + "/community/new");
      await page
        .getByRole("textbox", { name: "Discussion title", exact: true })
        .waitFor();
      check(
        (await page
          .getByRole("textbox", { name: "Discussion title", exact: true })
          .inputValue()) === "",
        "second account never restores another owner draft",
      );
      await context.close();
    }
    {
      const { context, page, state } = await setup({ mediaFailure: true });
      await page.goto(base + "/community/canonical-post");
      await page
        .getByText("Photo unavailable. Refresh the discussion to try again.", {
          exact: true,
        })
        .waitFor();
      await page.waitForTimeout(700);
      check(
        state.calls.filter((c) => c.action === "get-post").length <= 2,
        "failed signed photo gets at most one automatic renewal",
      );
      check(
        state.mediaRequests <= 2,
        "failed photo cannot loop network retries",
      );
      await context.close();
    }
    for (const mode of ["guest", "incomplete", "banned", "newAccount"]) {
      const { context, page, state } = await setup({ [mode]: true });
      await page.goto(
        base + (mode === "newAccount" ? "/community/new" : "/community"),
      );
      if (mode === "guest") {
        await page
          .getByText("Sign in to connect with other job seekers.")
          .waitFor();
        check(!state.calls.length, "guests cannot read Community");
      }
      if (mode === "incomplete") {
        await page
          .getByRole("button", { name: "Complete my profile", exact: true })
          .waitFor();
        check(
          !state.calls.some((c) => c.action === "list-posts"),
          "incomplete members see documented setup invitation",
        );
      }
      if (mode === "banned") {
        await page
          .getByText(
            "Your Community access is currently suspended. You can still read discussions.",
          )
          .waitFor();
        await page
          .getByRole("button", {
            name: "Open discussion: Website-created discussion",
            exact: true,
          })
          .waitFor();
        check(
          (await page
            .getByRole("button", { name: "Ask or share", exact: true })
            .count()) === 0,
          "banned members have no new-post control",
        );
        check(
          (await page
            .getByRole("button", { name: "Save discussion", exact: true })
            .count()) === 0,
          "banned members have no Save control",
        );
        await revealActions(page.getByTestId("community-post-canonical-post"));
        check(
          (await page
            .getByRole("button", { name: "Report discussion", exact: true })
            .count()) > 0,
          "banned members can report",
        );
      }
      if (mode === "newAccount") {
        await page
          .getByRole("textbox", { name: "Discussion title", exact: true })
          .fill("How can I improve my job search?");
        await page
          .getByRole("textbox", { name: "Discussion details", exact: true })
          .fill(
            "Here is a useful reference https://example.test to my question.",
          );
        check(
          await page
            .getByRole("button", { name: "Publish discussion", exact: true })
            .isDisabled(),
          "new accounts cannot submit links",
        );
      }
      await context.close();
    }
    {
      const { context, page, state } = await setup();
      state.fail = {
        action: "viewer-state",
        status: 401,
        code: "AUTH_REQUIRED",
        error: "Please sign in again.",
      };
      await page.goto(base + "/community");
      await page
        .getByRole("button", {
          name: "Open discussion: Website-created discussion",
          exact: true,
        })
        .waitFor();
      check(state.refreshes === 1, "expired session refreshes once in browser");
      state.fail = { action: "list-posts", network: true };
      await page
        .getByRole("button", { name: "Top this week", exact: true })
        .click();
      await page
        .getByText("Couldn't connect. Check your connection and try again.", {
          exact: true,
        })
        .waitFor();
      check(
        (await page
          .getByText("No discussions yet.", { exact: true })
          .count()) === 0,
        "failed request is not an empty feed",
      );
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Open discussion: Website-created discussion",
          exact: true,
        })
        .waitFor();
      check(true, "offline feed recovers explicitly");
      await context.close();
    }
    // Presentation stress: real server-shaped content, no live traffic.
    for (const width of [360, 768]) {
      const { context, page, state } = await setup({ width, slow: true });
      state.posts[0].title =
        "How do I explain a long gap on my CV when applying for my first permanent job in South Africa?";
      state.posts[0].author.name = "A member with a very long display name";
      state.posts[0].upvoteCount = 123456;
      state.posts[0].commentCount = 0;
      state.posts[0].media = [];
      await page.goto(base + "/community");
      await page.getByLabel("Loading discussions", { exact: true }).waitFor();
      check(true, `lightweight initial loading state at ${width}px`);
      const card = page.getByTestId("community-post-canonical-post");
      await card.waitFor();
      check(
        (await page
          .getByRole("button", { name: "Ask or share", exact: true })
          .count()) === 1,
        `one posting action at ${width}px`,
      );
      check(
        await card
          .getByRole("button", { name: "0 replies", exact: true })
          .isVisible(),
        `honest zero replies at ${width}px`,
      );
      check(
        await card
          .getByRole("button", { name: "Helpful · 123456", exact: true })
          .isVisible(),
        `large counts at ${width}px`,
      );
      await page.addStyleTag({
        content:
          '[data-testid="community-feed"] [dir="auto"] {font-size: 24px !important; line-height: 1.5 !important;}',
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      check(
        !overflow,
        `large type and long content stay within ${width}px viewport`,
      );
      await page.screenshot({
        path: `${shots}/feed-large-text-${width}.png`,
        fullPage: true,
      });
      check(
        (await card
          .getByRole("button", { name: "Report discussion", exact: true })
          .count()) === 0,
        `secondary actions hidden until requested at ${width}px`,
      );
      await revealActions(card);
      check(
        await card
          .getByRole("button", { name: "Report discussion", exact: true })
          .isVisible(),
        `secondary actions accessible at ${width}px`,
      );
      if (width === 360) {
        const ownTitle = page.getByRole("button", {
          name: "Open discussion: My editable discussion",
          exact: true,
        });
        await ownTitle.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const offset = await page
          .getByTestId("community-feed")
          .evaluate((el) => el.scrollTop);
        await ownTitle.click();
        await page
          .getByRole("button", { name: "Back to Community", exact: true })
          .click();
        await page.getByTestId("community-feed").waitFor();
        await page.waitForTimeout(300);
        const returned = await page
          .getByTestId("community-feed")
          .evaluate((el) => el.scrollTop);
        check(
          Math.abs(offset - returned) < 2,
          `feed retains scroll position after discussion return (${offset} -> ${returned})`,
        );
      }
      await context.close();
    }
    console.log(
      `${checks} Community browser checks passed; all backend requests intercepted.`,
    );
  } catch (error) {
    for (const [index, context] of browser.contexts().entries())
      for (const page of context.pages())
        await page
          .screenshot({ path: `${shots}/failure-${index}.png`, fullPage: true })
          .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

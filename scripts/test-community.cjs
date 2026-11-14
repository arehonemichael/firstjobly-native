/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, mocks = {}) {
  const js = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", js)(mod, mod.exports, (n) => {
    if (n in mocks) return mocks[n];
    throw Error("Unexpected import " + n);
  });
  return mod.exports;
}
const contract = load("src/lib/community/contract.ts");
const { createCommunityTransport, CommunityError } = load(
  "src/lib/community/transport.ts",
);
const { createDraftStore } = load("src/lib/community/draft-store.ts");
const session = (id = "owner", token = "fixture.token.signature") => ({
  access_token: token,
  expires_at: 9999999999,
  user: { id },
});
const response = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
function authFixture() {
  let current = session(),
    refreshes = 0;
  return {
    get current() {
      return current;
    },
    set current(s) {
      current = s;
    },
    get refreshes() {
      return refreshes;
    },
    async getSession() {
      return { data: { session: current } };
    },
    async refreshSession() {
      refreshes++;
      current = session(current?.user.id, "new.fixture.token");
      return { data: { session: current } };
    },
  };
}
test("exact Community host, bearer header and documented action envelope", async () => {
  const a = authFixture();
  const send = async (url, init) => {
    assert.equal(url, "https://firstjobly.co.za/api/community");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, "Bearer fixture.token.signature");
    assert.deepEqual(JSON.parse(init.body), {
      action: "list-posts",
      data: { scope: "foryou", limit: 15 },
    });
    return response({ posts: [], nextCursor: null });
  };
  assert.deepEqual(
    await createCommunityTransport(a, send)("owner", "list-posts", {
      scope: "foryou",
      limit: 15,
    }),
    { posts: [], nextCursor: null },
  );
});
test("401 refreshes once and retries with the new session token", async () => {
  const a = authFixture();
  let calls = 0;
  const api = createCommunityTransport(a, async (_, init) => {
    calls++;
    if (calls === 1)
      return response(
        { error: "Please sign in again.", code: "AUTH_REQUIRED" },
        401,
      );
    assert.equal(init.headers.Authorization, "Bearer new.fixture.token");
    return response({ id: "new-post", piiWarning: false });
  });
  assert.equal(
    (
      await api("owner", "create-post", {
        title: "A title",
        body: "A useful question with enough details",
      })
    ).id,
    "new-post",
  );
  assert.equal(calls, 2);
  assert.equal(a.refreshes, 1);
});
test("repeated auth failure stops after one refresh", async () => {
  const a = authFixture();
  let calls = 0;
  const api = createCommunityTransport(a, async () => {
    calls++;
    return response(
      { error: "Please sign in again.", code: "AUTH_REQUIRED" },
      401,
    );
  });
  await assert.rejects(
    api("owner", "viewer-state"),
    (e) => e.code === "AUTH_REQUIRED",
  );
  assert.equal(a.refreshes, 1);
  assert.equal(calls, 2);
});
test("near-expiry sessions refresh before sending and refresh failures send nothing", async () => {
  const a = authFixture();
  a.current = { ...session(), expires_at: 1 };
  let calls = 0;
  await createCommunityTransport(a, async () => {
    calls++;
    return response({ member: true });
  })("owner", "viewer-state");
  assert.equal(a.refreshes, 1);
  assert.equal(calls, 1);
  a.current = { ...session(), expires_at: 1 };
  a.refreshSession = async () => {
    throw Error("private provider failure");
  };
  await assert.rejects(
    createCommunityTransport(a, async () => {
      throw Error("must not send");
    })("owner", "viewer-state"),
    (e) => e.code === "AUTH_REQUIRED",
  );
});
test("unknown creation outcomes are never automatically replayed", async () => {
  const a = authFixture();
  for (const failure of ["network", "bad-json", "500"]) {
    let calls = 0;
    const api = createCommunityTransport(a, async () => {
      calls++;
      if (failure === "network") throw Error("offline");
      if (failure === "bad-json") return new Response("broken");
      return response({ error: "Server unavailable", code: "UNKNOWN" }, 500);
    });
    await assert.rejects(api("owner", "create-post", { body: "preserve me" }));
    assert.equal(calls, 1);
    assert.equal(a.refreshes, 0);
  }
});
test("rate-limit Retry-After blocks subsequent attempts until its deadline", async () => {
  const a = authFixture();
  let now = 1000,
    calls = 0;
  const api = createCommunityTransport(
    a,
    async () => {
      calls++;
      return calls === 1
        ? response(
            { error: "Try again in about 2 minutes.", code: "RATE_LIMITED" },
            429,
            { "Retry-After": "120" },
          )
        : response({ ok: true });
    },
    () => now,
  );
  await assert.rejects(
    api("owner", "create-comment"),
    (e) => e.retryAt === 121000 && e.message.includes("2 minutes"),
  );
  await assert.rejects(
    api("owner", "create-comment"),
    (e) => e.code === "RATE_LIMITED",
  );
  assert.equal(calls, 1);
  now = 121001;
  await api("owner", "create-comment");
  assert.equal(calls, 2);
});
test("rejects wrong owner before request and late account-switch responses", async () => {
  const a = authFixture();
  let calls = 0;
  const api = createCommunityTransport(a, async () => {
    calls++;
    a.current = session("second");
    return response({ posts: ["private first owner"] });
  });
  await assert.rejects(
    api("second", "viewer-state"),
    (e) => e.code === "AUTH_REQUIRED",
  );
  assert.equal(calls, 0);
  await assert.rejects(
    api("owner", "list-posts"),
    (e) => e.code === "AUTH_REQUIRED",
  );
  assert.equal(calls, 1);
});
test("friendly server moderation and validation messages are retained", async () => {
  const a = authFixture();
  const api = createCommunityTransport(a, async () =>
    response(
      {
        error:
          "This looks like it may break our rules on scams or spam, so it wasn’t posted.",
        code: "SPAM",
      },
      409,
    ),
  );
  await assert.rejects(
    api("owner", "create-post"),
    (e) =>
      e instanceof CommunityError &&
      e.code === "SPAM" &&
      e.message.includes("scams"),
  );
});
test("contract topics, scopes and report reasons match the audited values", () => {
  assert.deepEqual(Object.keys(contract.TOPICS), [
    "general",
    "job_search_help",
    "cv_review",
    "interview_tips",
    "company_reviews",
    "success_stories",
    "career_advice",
    "off_topic",
  ]);
  assert.deepEqual(Object.keys(contract.SCOPES), [
    "all",
    "top",
    "foryou",
    "saved",
    "mine",
  ]);
  assert.deepEqual(Object.keys(contract.REPORT_REASONS), [
    "harassment",
    "hate",
    "spam",
    "scam",
    "personal_info",
    "sexual",
    "misinformation",
    "other",
  ]);
});
test("validation enforces counts, link limits and new-account rules", () => {
  const v = contract.validateText;
  assert.ok(v("short", true, false, "title"));
  assert.ok(v("x".repeat(5001), true, false, "title"));
  assert.ok(v("reply", false, false, "") === "");
  assert.ok(v("x", false, false));
  assert.ok(v("x".repeat(2001), false, false));
  assert.ok(
    v(
      "https://one.test details https://two.test https://three.test",
      true,
      false,
      "valid title",
    ).includes("2 links"),
  );
  assert.ok(
    v(
      "Useful question includes www.example.test",
      true,
      true,
      "valid title",
    ).includes("24 hours"),
  );
  assert.ok(
    v(
      "A sufficiently detailed question.",
      true,
      true,
      "Visit https://example.test",
    ).includes("24 hours"),
  );
  assert.equal(
    v("A sufficiently detailed question.", true, false, "Useful title"),
    "",
  );
});
test("personal-info warnings and anonymous initials never look up identities", () => {
  for (const text of [
    "Test 9001011234088",
    "Email candidate@example.test",
    "Call +27 82 123 4567",
  ])
    assert.ok(contract.hasPersonalInfo(text), text);
  assert.equal(contract.initials("CleverIntern76"), "CI");
  assert.equal(contract.initials("Thandi M."), "TM");
  assert.equal(contract.initials(""), "?");
  assert.equal(
    contract.authorName({
      anonymous: true,
      handle: "CleverIntern76",
      name: "Must never show",
      id: "must-not-show",
    }),
    "CleverIntern76",
  );
});
test("SAST dates, hidden statuses and threaded reply depth remain safe", () => {
  assert.match(contract.sastDate("2026-11-11T17:10:00Z"), /19:10/);
  assert.match(contract.statusMessage("held"), /Hidden from others/);
  assert.equal(
    contract.statusMessage("removed", true),
    "This reply was removed.",
  );
  const c = (id, parentId, date) => ({
    id,
    parentId,
    createdAt: date || "2026-01-01",
  });
  const tree = contract.threadComments([
    c("child", "root"),
    c("root", null),
    c("third", "child"),
    c("fourth", "third"),
    c("orphan", "missing"),
    c("a", "b"),
    c("b", "a"),
  ]);
  assert.equal(tree.length, 7);
  assert.deepEqual(
    tree.slice(0, 4).map((x) => [x.comment.id, x.depth]),
    [
      ["root", 0],
      ["child", 1],
      ["third", 2],
      ["fourth", 2],
    ],
  );
});
function storageFixture() {
  const values = new Map();
  return {
    values,
    async read(k) {
      return values.get(k) || null;
    },
    async write(k, v) {
      values.set(k, v);
    },
    async remove(k) {
      values.delete(k);
    },
    async clear() {
      values.clear();
    },
  };
}
test("draft restoration, publication cleanup and account isolation", async () => {
  const storage = storageFixture(),
    drafts = createDraftStore(storage);
  await drafts.setOwner("one");
  await drafts.save("one", { title: "Owner one" });
  assert.equal((await drafts.load("one")).title, "Owner one");
  await drafts.setOwner("two");
  assert.equal(await drafts.load("one"), null);
  assert.equal(await drafts.load("two"), null);
  assert.equal(storage.values.size, 0);
  await drafts.save("one", { title: "late old write" });
  assert.equal(storage.values.size, 0);
  await drafts.save("two", { title: "new" });
  await drafts.remove("two");
  assert.equal(await drafts.load("two"), null);
});
test("sign-out cleanup wins races against queued autosaves", async () => {
  const storage = storageFixture(),
    drafts = createDraftStore(storage);
  await drafts.setOwner("one");
  let release;
  storage.write = async (k, v) => {
    await new Promise((r) => (release = r));
    storage.values.set(k, v);
  };
  const pending = drafts.save("one", { title: "private" });
  await new Promise((r) => setImmediate(r));
  const signedOut = drafts.setOwner(null);
  release();
  await pending;
  await signedOut;
  await drafts.save("one", { title: "must not resurrect" });
  assert.equal(storage.values.size, 0);
  assert.equal(await drafts.load("one"), null);
});
test("restoration interrupted by account change cannot return private text", async () => {
  const storage = storageFixture(),
    drafts = createDraftStore(storage);
  await drafts.setOwner("one");
  let release;
  storage.read = () => new Promise((r) => (release = r));
  const read = drafts.load("one");
  await new Promise((r) => setImmediate(r));
  await drafts.setOwner("two");
  release('{"title":"private"}');
  assert.equal(await read, null);
});
test("cache is isolated, signed URLs expire, and invalidation retains safe content", () => {
  let authEvent;
  const { communityStore: store, MEDIA_REFRESH } = load(
    "src/lib/community/store.ts",
    {
      "../supabase": {
        supabase: {
          auth: {
            onAuthStateChange(fn) {
              authEvent = fn;
            },
          },
        },
      },
      "./contract": contract,
      "./draft-store": { createDraftStore },
      "./draft-storage": { draftStorage: storageFixture() },
    },
  );
  store.setOwner("one");
  const view = {
    scope: "foryou",
    topic: "cv_review",
    draft: "private search",
    offset: 620,
  };
  store.saveFeedView("one", view);
  assert.deepEqual(store.readFeedView("one"), view);
  assert.equal(store.readFeedView("two"), undefined);
  store.saveFeedView("two", { ...view, offset: 0 });
  assert.equal(store.readFeedView("one").offset, 620);
  const post = {
    id: "p",
    viewerSaved: true,
    author: { id: "named", viewerFollows: false },
    media: [{ url: "https://signed.example.test/private" }],
  };
  store.write("one", "feed", { posts: [post], nextCursor: null });
  store.invalidate();
  assert.equal(store.read("one", "feed").value.posts[0].viewerSaved, true);
  assert.equal(store.read("one", "feed").at, 0);
  store.patchPosts("one", (p) => ({ ...p, viewerSaved: false }));
  assert.equal(store.read("one", "feed").value.posts[0].viewerSaved, false);
  store.write("one", "old", { post }, Date.now() - MEDIA_REFRESH - 1);
  assert.equal(store.read("one", "old"), undefined);
  store.setOwner("two");
  assert.equal(store.read("two", "feed"), undefined);
  assert.equal(store.readFeedView("two"), undefined);
  store.write("one", "late", { post });
  assert.equal(store.read("two", "late"), undefined);
  store.saveFeedView("two", view);
  authEvent("SIGNED_OUT", null);
  assert.equal(store.owner, null);
  assert.equal(store.readFeedView("two"), undefined);
});
test("photo limits reject WebP, oversize and too-large dimensions", () => {
  const { validatePhoto } = load("src/lib/community/photos.ts", {
    "react-native": {},
    "expo-document-picker": {},
    "expo-file-system": {},
  });
  assert.equal(validatePhoto("iVBORw0KGgo", 100, 100), "");
  assert.equal(validatePhoto("/9j/abcd", 100, 100), "");
  assert.ok(validatePhoto("UklGRwebp", 100, 100).includes("WebP"));
  assert.ok(validatePhoto("iVBORw0KGgo", 4001, 100).includes("4000"));
  assert.ok(
    validatePhoto("/9j/" + "A".repeat(7 * 1024 * 1024), 100, 100).includes(
      "5 MB",
    ),
  );
});

test("notification links stay internal and preserve Community destinations", () => {
  const { communityDestination } = load("src/lib/community/links.ts");
  for (const link of ["/community", "/community/post-id", "/community/new"])
    assert.equal(communityDestination(link), link);
  for (const link of [
    "https://attacker.test/community",
    "//attacker.test",
    "/community/../auth",
    "/community/%2f",
    "/community/post?token=private",
    null,
  ])
    assert.equal(communityDestination(link), null);
});
test("optimistic toggle locks, rolls back affected fields and preserves concurrent state", async () => {
  const storage = storageFixture();
  const { communityStore: store, lockedMutation } = load(
    "src/lib/community/store.ts",
    {
      "../supabase": { supabase: { auth: { onAuthStateChange() {} } } },
      "./contract": contract,
      "./draft-store": { createDraftStore },
      "./draft-storage": { draftStorage: storage },
    },
  );
  store.setOwner("owner");
  const post = {
    id: "p",
    upvoteCount: 2,
    viewerVoted: false,
    viewerSaved: false,
    author: { id: "named", viewerFollows: false },
  };
  store.write("owner", "feed", { posts: [post] });
  let reject,
    calls = 0;
  const { togglePost } = load("src/lib/community/mutations.ts", {
    "./store": { communityStore: store, lockedMutation },
    "./api": {
      communityApi: () => {
        calls++;
        return new Promise((_, bad) => (reject = bad));
      },
    },
  });
  const pending = togglePost("owner", post, "vote");
  assert.equal(store.read("owner", "feed").value.posts[0].upvoteCount, 3);
  assert.equal(await togglePost("owner", post, "vote"), undefined);
  assert.equal(calls, 1);
  store.patchPosts("owner", (p) => ({ ...p, viewerSaved: true }));
  reject(new Error("server rejection"));
  await assert.rejects(pending);
  const current = store.read("owner", "feed").value.posts[0];
  assert.equal(current.viewerVoted, false);
  assert.equal(current.upvoteCount, 2);
  assert.equal(current.viewerSaved, true);
});
test("mutation versions fence reads and draft validation excludes corrupt photo URLs", () => {
  const { communityStore: store, validDraft } = load(
    "src/lib/community/store.ts",
    {
      "../supabase": { supabase: { auth: { onAuthStateChange() {} } } },
      "./contract": contract,
      "./draft-store": { createDraftStore },
      "./draft-storage": { draftStorage: storageFixture() },
    },
  );
  store.setOwner("owner");
  const before = store.version;
  store.write("owner", "feed", { posts: [] });
  assert.equal(store.version, before);
  store.invalidate();
  assert.ok(store.version > before);
  const draft = validDraft({
    title: "A draft",
    body: "Details",
    topic: "invented",
    isAnonymous: "yes",
    photos: [
      { data: "https://expired-signed.test/private", width: 10, height: 10 },
    ],
  });
  assert.equal(draft.topic, "general");
  assert.equal(draft.isAnonymous, false);
  assert.equal(draft.photos.length, 0);
});
test("notification listener routes audited links once, skips explicit job launch URLs and cleans up", async () => {
  for (const initialUrl of [null, "firstjobly://jobs/real-job"]) {
    const effects = [],
      pushed = [];
    let listener,
      removed = 0,
      cleared = 0,
      lastRead = 0;
    const sdk = {
      DEFAULT_ACTION_IDENTIFIER: "default",
      addNotificationResponseReceivedListener(fn) {
        listener = fn;
        return {
          remove() {
            removed++;
          },
        };
      },
      async getLastNotificationResponseAsync() {
        lastRead++;
        return {
          actionIdentifier: "default",
          notification: {
            request: {
              identifier: "first",
              content: { data: { link: "/community/post-id" } },
            },
          },
        };
      },
      async clearLastNotificationResponseAsync() {
        cleared++;
      },
    };
    const { communityDestination } = load("src/lib/community/links.ts");
    const { notificationDestination } = load("src/lib/circular/links.ts", {
      "../community/links": { communityDestination },
    });
    const { useCommunityNotifications: renderNotificationHook } = load(
      "src/hooks/use-community-notifications.ts",
      {
        react: {
          useEffect(fn) {
            effects.push(fn);
          },
        },
        "react-native": { Linking: { getInitialURL: async () => initialUrl } },
        "expo-router": {
          router: {
            push(href) {
              pushed.push(href);
            },
          },
          useRootNavigationState: () => ({ key: "root" }),
        },
        "../lib/runtime-environment": { isExpoGo: false },
        "../lib/circular/links": { notificationDestination },
        "../lib/user-interaction": { signalUserInteraction() {} },
        "../lib/resume/events": { prioritizeResumeDestination() {} },
        "expo-notifications": sdk,
      },
    );
    renderNotificationHook();
    const cleanup = effects[0]();
    await new Promise((r) => setImmediate(r));
    assert.equal(lastRead, initialUrl ? 0 : 1);
    assert.equal(pushed.length, initialUrl ? 0 : 1);
    listener({
      actionIdentifier: "default",
      notification: {
        request: {
          identifier: "tap",
          content: { data: { link: "/community" } },
        },
      },
    });
    listener({
      actionIdentifier: "default",
      notification: {
        request: {
          identifier: "tap",
          content: { data: { link: "/community" } },
        },
      },
    });
    listener({
      actionIdentifier: "default",
      notification: {
        request: {
          identifier: "bad",
          content: { data: { link: "https://attacker.test/community" } },
        },
      },
    });
    assert.equal(pushed.filter((href) => href === "/community").length, 1);
    assert.equal(cleared, initialUrl ? 1 : 2);
    cleanup();
    assert.equal(removed, 1);
  }
});
test("Expo Go never evaluates the native notification SDK", async () => {
  const effects = [];
  const { useCommunityNotifications: renderNotificationHook } = load(
    "src/hooks/use-community-notifications.ts",
    {
      react: {
        useEffect(fn) {
          effects.push(fn);
        },
      },
      "react-native": {},
      "expo-router": { useRootNavigationState: () => ({ key: "root" }) },
      "../lib/runtime-environment": { isExpoGo: true },
      "../lib/circular/links": {},
      "../lib/user-interaction": {},
      "../lib/resume/events": { prioritizeResumeDestination() {} },
    },
  );
  renderNotificationHook();
  assert.equal(effects[0](), undefined);
  await new Promise((r) => setImmediate(r));
});

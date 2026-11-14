/* global __dirname */
/* Isolated contracts only: never creates/deletes a live account. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./ads-load.cjs");
const { createAccountDeletion, DELETE_ACCOUNT_URL } = load(
  "src/lib/account/deletion.ts",
);
const { cleanupDeletedAccount } = load("src/lib/account/cleanup.ts");
const { withAuthMutation } = load("src/lib/auth-mutation.ts");
const session = {
  access_token: "fixture-session-jwt",
  user: { id: "a", email: "Member@Example.test" },
};
const response = (status, data, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const turn = () => new Promise((r) => setImmediate(r));
test("one exact apex POST; normalized confirmation; optional password preserved; only bearer auth", async () => {
  const calls = [];
  const api = createAccountDeletion(
    async () => session,
    async (url, options) => {
      calls.push({ url, options });
      return response(200, { deleted: true });
    },
  );
  assert.deepEqual(
    await api.delete("a", " MEMBER@example.test ", " pass with spaces "),
    { deleted: true, owner: "a" },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DELETE_ACCOUNT_URL);
  assert.equal(calls[0].url, "https://firstjobly.co.za/api/app/account/delete");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    confirmEmail: "member@example.test",
    password: " pass with spaces ",
  });
  assert.deepEqual(calls[0].options.headers, {
    Authorization: "Bearer fixture-session-jwt",
    "Content-Type": "application/json",
  });
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.cache, "no-store");
});
test("recent sign-in path omits password; fresh same-user Google proof goes only in Authorization", async () => {
  let opts;
  const api = createAccountDeletion(
    async () => session,
    async (_u, o) => {
      opts = o;
      return response(200, { deleted: true });
    },
  );
  await api.delete("a", "member@example.test", undefined, {
    userId: "a",
    accessToken: "fresh-google-fixture",
  });
  assert.equal(opts.headers.Authorization, "Bearer fresh-google-fixture");
  assert.deepEqual(JSON.parse(opts.body), {
    confirmEmail: "member@example.test",
  });
});
test("different current/proof owner and wrong email send no destructive request", async () => {
  let calls = 0;
  const api = createAccountDeletion(
    async () => session,
    async () => {
      calls++;
      return response(200, { deleted: true });
    },
  );
  for (const args of [
    ["b", "member@example.test"],
    ["a", "other@example.test"],
    [
      "a",
      "member@example.test",
      undefined,
      { userId: "b", accessToken: "other" },
    ],
  ])
    await assert.rejects(api.delete(...args));
  assert.equal(calls, 0);
});
for (const [status, code] of [
  [401, "auth_required"],
  [403, "reauth_required"],
  [403, "reauth_failed"],
  [403, "staff_protected"],
  [409, "manual_deletion_required"],
  [409, "deletion_in_progress"],
  [422, "confirmation_mismatch"],
  [500, "deletion_failed"],
])
  test(`${status} ${code}: no automatic replay or success`, async () => {
    let calls = 0;
    const api = createAccountDeletion(
      async () => session,
      async () => {
        calls++;
        return response(status, {
          error: "Friendly server message",
          code,
          methods: ["password"],
          retry_safe: true,
        });
      },
    );
    await assert.rejects(
      api.delete("a", "member@example.test"),
      (e) => e.code === code && e.message === "Friendly server message",
    );
    assert.equal(calls, 1);
  });
test("rate limit honors Retry-After locally and retries only after another explicit call", async () => {
  let time = 0,
    calls = 0;
  const api = createAccountDeletion(
    async () => session,
    async () =>
      ++calls === 1
        ? response(
            429,
            { error: "Wait", code: "rate_limited" },
            { "Retry-After": "30" },
          )
        : response(200, { deleted: true }),
    () => time,
  );
  await assert.rejects(
    api.delete("a", "member@example.test"),
    (e) => e.retryAt === 30000,
  );
  await assert.rejects(api.delete("a", "member@example.test"));
  assert.equal(calls, 1);
  time = 30000;
  assert.equal((await api.delete("a", "member@example.test")).deleted, true);
  assert.equal(calls, 2);
});
test("network loss/timeout/malformed success are unknown, never retried automatically", async () => {
  for (const send of [
    async () => {
      throw Error("offline");
    },
    async () => response(200, { deleted: false }),
    async () => new Response("not-json", { status: 200 }),
    async (_u, o) =>
      new Promise((_resolve, reject) =>
        o.signal.addEventListener("abort", () => reject(Error("abort"))),
      ),
  ]) {
    let calls = 0;
    const api = createAccountDeletion(
      async () => session,
      async (...args) => {
        calls++;
        return send(...args);
      },
      Date.now,
      10,
    );
    await assert.rejects(
      api.delete("a", "member@example.test"),
      (e) => e.code === "unknown_result",
    );
    assert.equal(calls, 1);
  }
});
test("rapid simultaneous deletion taps produce one request", async () => {
  const wait = deferred();
  let calls = 0;
  const api = createAccountDeletion(
    async () => session,
    async () => {
      calls++;
      await wait.promise;
      return response(200, { deleted: true });
    },
  );
  const first = api.delete("a", "member@example.test");
  await turn();
  await assert.rejects(
    api.delete("a", "member@example.test"),
    (e) => e.code === "busy",
  );
  wait.resolve();
  await first;
  assert.equal(calls, 1);
});
test("4KB cap prevents a too-large request before sending", async () => {
  let calls = 0;
  const api = createAccountDeletion(
    async () => session,
    async () => {
      calls++;
      return response(200, { deleted: true });
    },
  );
  await assert.rejects(
    api.delete("a", "member@example.test", "é".repeat(3000)),
    (e) => e.code === "invalid_request",
  );
  assert.equal(calls, 0);
});
function cleanupPorts(owner = "a") {
  const events = [];
  return {
    events,
    port: {
      currentOwner: async () => owner,
      clearOwned: async (id) => events.push("owned:" + id),
      clearDeviceDrafts: async () => events.push("drafts"),
      signOut: async () => events.push("signout"),
      disableReminders: async () => events.push("reminders"),
    },
  };
}
test("confirmed cleanup clears owned resources, shared drafts then only original local session", async () => {
  const f = cleanupPorts();
  assert.equal(
    (await cleanupDeletedAccount("a", false, f.port)).sharedCleaned,
    true,
  );
  assert.deepEqual(f.events, ["owned:a", "drafts", "signout"]);
});
test("newer account stays signed in and its drafts/reminder preference are untouched", async () => {
  const f = cleanupPorts("b");
  const r = await cleanupDeletedAccount("a", true, f.port);
  assert.equal(r.newerAccount, true);
  assert.deepEqual(f.events, ["owned:a"]);
});
test("account changes during cleanup prevent later shared/session actions", async () => {
  const f = cleanupPorts();
  let owner = "a";
  f.port.currentOwner = async () => owner;
  f.port.clearDeviceDrafts = async () => {
    f.events.push("drafts");
    owner = "b";
  };
  await cleanupDeletedAccount("a", true, f.port);
  assert.deepEqual(f.events, ["owned:a", "drafts"]);
});
test("no matching session is not reported as a newer signed-in account or full shared cleanup", async () => {
  const f = cleanupPorts(null);
  const r = await cleanupDeletedAccount("a", false, f.port);
  assert.equal(r.newerAccount, false);
  assert.equal(r.sharedCleaned, false);
  assert.deepEqual(f.events, ["owned:a"]);
});
test("owned-file cleanup failure still ends original session and reports incomplete local cleanup", async () => {
  const f = cleanupPorts();
  f.port.clearOwned = async () => {
    throw Error("file failure");
  };
  await assert.rejects(cleanupDeletedAccount("a", true, f.port));
  assert.deepEqual(f.events, ["drafts", "reminders", "signout"]);
});
test("normal sign-in/out waits for confirmed cleanup auth lease", async () => {
  const wait = deferred(),
    events = [];
  const cleanup = withAuthMutation(async () => {
    events.push("cleanup");
    await wait.promise;
    events.push("finished");
  });
  const signin = withAuthMutation(async () => {
    events.push("new-signin");
  });
  await turn();
  assert.deepEqual(events, ["cleanup"]);
  wait.resolve();
  await Promise.all([cleanup, signin]);
  assert.deepEqual(events, ["cleanup", "finished", "new-signin"]);
});
/* Narrow loaders for native boundaries: mock the platform/auth/filesystem ports. */
function moduleWith(file, deps, extra = {}) {
  const fs = require("node:fs"),
    path = require("node:path"),
    ts = require("typescript");
  const mod = { exports: {} };
  const js = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("module", "exports", "require", ...Object.keys(extra), js)(
    mod,
    mod.exports,
    (name) => {
      if (!(name in deps)) throw Error("Unexpected import " + name);
      return deps[name];
    },
    ...Object.values(extra),
  );
  return mod.exports;
}
for (const chosen of ["a", "b"])
  test(`Google PKCE ${chosen === "a" ? "accepts matching" : "refuses different"} account without replacing app session`, async () => {
    const crypto = require("node:crypto");
    const requests = [];
    let disposed = 0,
      appWrites = 0;
    const isolated = {
      auth: {
        signInWithOAuth: async (input) => {
          assert.equal(
            input.options.redirectTo,
            "firstjobly://account-delete-callback",
          );
          return {
            data: { url: "https://auth.example/authorize?provider=google" },
            error: null,
          };
        },
        setSession: async () => ({
          data: {
            session: {
              access_token: "fresh-verified-token",
              user: { id: chosen },
            },
          },
          error: null,
        }),
        signOut: async () => {
          disposed++;
          return { error: null };
        },
      },
    };
    const api = moduleWith(
      "src/lib/account/google-reauth.ts",
      {
        "@supabase/supabase-js": {
          createClient: (_url, _key, options) => {
            assert.equal(options.auth.persistSession, false);
            return isolated;
          },
        },
        "expo-crypto": {
          getRandomBytesAsync: async () => new Uint8Array(32).fill(7),
          digestStringAsync: async (_algorithm, text) =>
            crypto.createHash("sha256").update(text).digest("base64"),
          CryptoDigestAlgorithm: { SHA256: "SHA-256" },
          CryptoEncoding: { BASE64: "base64" },
        },
        "expo-web-browser": {
          openAuthSessionAsync: async (url) => {
            const parsed = new URL(url);
            assert.equal(
              parsed.searchParams.get("code_challenge_method"),
              "s256",
            );
            assert.equal(parsed.searchParams.get("code_challenge").length, 43);
            return {
              type: "success",
              url: "firstjobly://account-delete-callback?code=fixture-auth-code",
            };
          },
        },
        "react-native": { Platform: { OS: "ios" } },
        "../supabase": {
          supabase: {
            auth: {
              getSession: async () => ({ data: { session } }),
              setSession: async () => {
                appWrites++;
              },
            },
          },
        },
      },
      {
        process: {
          env: {
            EXPO_PUBLIC_SUPABASE_URL: "https://isolated.test",
            EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-fixture",
          },
        },
        fetch: async (url, options) => {
          requests.push({ url, options });
          return response(200, {
            access_token: "fresh-verified-token",
            refresh_token: "private-temporary-refresh",
          });
        },
      },
    );
    if (chosen === "a") {
      const proof = await api.reauthenticateGoogle("a", "member@example.test");
      assert.equal(proof.accessToken, "fresh-verified-token");
      await proof.dispose();
      assert.equal(api.activeGoogleVerification(), null);
    } else
      await assert.rejects(
        api.reauthenticateGoogle("a", "member@example.test"),
        /same Google account/,
      );
    assert.equal(appWrites, 0);
    assert.equal(disposed, 1);
    assert.equal(requests.length, 1);
    const body = JSON.parse(requests[0].options.body);
    assert.deepEqual(Object.keys(body).sort(), ["auth_code", "code_verifier"]);
    assert.equal(body.code_verifier.length, 64);
    assert.equal(
      requests[0].url,
      "https://isolated.test/auth/v1/token?grant_type=pkce",
    );
  });
test("owned PDF cleanup never deletes external exports, app roots, traversal paths or another owner ledger", async () => {
  const entries = new Map(),
    deleted = [];
  const api = moduleWith("src/lib/account/owned-files.ts", {
    "@react-native-async-storage/async-storage": {
      __esModule: true,
      default: {
        getItem: async (key) => entries.get(key) || null,
        setItem: async (k, v) => entries.set(k, v),
        removeItem: async (key) => entries.delete(key),
      },
    },
    "expo-file-system/legacy": {
      cacheDirectory: "file:///cache/",
      documentDirectory: "file:///documents/",
      deleteAsync: async (uri) => deleted.push(uri),
    },
  });
  await api.rememberGeneratedFile("a", "file:///cache/a.pdf");
  await api.rememberGeneratedFile(
    "b",
    "file:///documents/firstjobly-generated/b/b.pdf",
  );
  for (const uri of [
    "file:///cache/",
    "content://downloads/a.pdf",
    "file:///cache/../other.pdf",
    "file:///cache/%2e%2e/other.pdf",
  ])
    await api.rememberGeneratedFile("a", uri);
  await api.clearGeneratedFiles("a");
  assert.deepEqual(deleted, [
    "file:///cache/a.pdf",
    "file:///documents/firstjobly-generated/a/",
  ]);
  assert.ok(entries.has("firstjobly:generated-files:b"));
});
test("another account does not inherit a previous account rate-limit cache", async () => {
  let active = session,
    calls = 0;
  const api = createAccountDeletion(
    async () => active,
    async () =>
      ++calls === 1
        ? response(
            429,
            { code: "rate_limited", error: "Wait" },
            { "Retry-After": "60" },
          )
        : response(200, { deleted: true }),
  );
  await assert.rejects(api.delete("a", "member@example.test"));
  active = {
    access_token: "b-fixture",
    user: { id: "b", email: "other@example.test" },
  };
  assert.equal((await api.delete("b", "other@example.test")).deleted, true);
  assert.equal(calls, 2);
});
test("a late PDF generation cannot resurrect files after confirmed deletion", async () => {
  const entries = new Map(),
    deleted = [];
  const api = moduleWith("src/lib/account/owned-files.ts", {
    "@react-native-async-storage/async-storage": {
      __esModule: true,
      default: {
        getItem: async (key) => entries.get(key) || null,
        setItem: async (k, v) => entries.set(k, v),
        removeItem: async (key) => entries.delete(key),
      },
    },
    "expo-file-system/legacy": {
      cacheDirectory: "file:///cache/",
      documentDirectory: "file:///documents/",
      deleteAsync: async (uri) => deleted.push(uri),
    },
  });
  api.markGeneratedOwnerDeleted("a");
  await assert.rejects(
    api.rememberGeneratedFile("a", "file:///cache/late-a.pdf"),
  );
  assert.deepEqual(deleted, ["file:///cache/late-a.pdf"]);
  assert.equal(entries.size, 0);
  assert.throws(() => api.assertGeneratedOwnerActive("a"));
  assert.doesNotThrow(() => api.assertGeneratedOwnerActive("b"));
});

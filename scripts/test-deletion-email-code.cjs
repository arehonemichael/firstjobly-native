/* Isolated auth/API fixtures: no live emails or account deletion. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { load } = require("./ads-load.cjs");
const { createDeletionCodeSender, DELETE_CODE_URL } = load(
  "src/lib/account/email-code.ts",
);
const { createAccountDeletion } = load("src/lib/account/deletion.ts");
const { deletionSessionScope } = load("src/lib/account/session-scope.ts");
const sid = "00000000-0000-4000-8000-000000000001";
const session = (id = "alice", sessionId = sid, version = 1) => ({
  user: { id, email: id + "@example.test" },
  access_token:
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(
      JSON.stringify({ sub: id, session_id: sessionId, version }),
    ).toString("base64url") +
    ".fixture",
});
const response = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const payload = {
  sent: true,
  maskedEmail: "al****@example.test",
  expiresInSeconds: 600,
  expiresAt: "2099-01-01T00:00:00Z",
  retryAfterSeconds: 60,
};
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
test("send uses apex POST, empty body and only bearer; confirmed sent keeps deadline", async () => {
  let request;
  const api = createDeletionCodeSender(
    async () => session(),
    async (url, options) => {
      request = { url, options };
      return response(200, payload);
    },
    () => 1000,
  );
  const result = await api.send("alice");
  assert.equal(request.url, DELETE_CODE_URL);
  assert.equal(
    request.url,
    "https://firstjobly.co.za/api/app/account/delete-code",
  );
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body, "{}");
  assert.deepEqual(request.options.headers, {
    Authorization: "Bearer " + session().access_token,
    "Content-Type": "application/json",
  });
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.cache, "no-store");
  assert.equal(result.sent, true);
  assert.equal(result.retryAt, 61000);
  assert.equal(result.expiresAt, Date.parse(payload.expiresAt));
});
test("202 is uncertain, not confirmed sent; code remains usable and no automatic resend", async () => {
  let calls = 0;
  const api = createDeletionCodeSender(
    async () => session(),
    async () => {
      calls++;
      return response(202, {
        ...payload,
        sent: false,
        code: "send_uncertain",
        error: "Check inbox",
      });
    },
    () => 0,
  );
  assert.equal((await api.send("alice")).sent, false);
  await assert.rejects(
    api.send("alice"),
    (e) => e.code === "cooldown" && e.retryAt === 60000,
  );
  assert.equal(calls, 1);
});
for (const [status, code, wait] of [
  [502, "send_failed", 60],
  [503, "send_busy", 5],
  [429, "code_locked", 900],
  [429, "send_limit", 3600],
  [429, "rate_limited", 120],
])
  test(`${status} ${code} preserves server text and enforces retry deadline`, async () => {
    let now = 0,
      calls = 0;
    const api = createDeletionCodeSender(
      async () => session(),
      async () => {
        calls++;
        return response(
          status,
          { error: "Friendly server message", code, retry_after_seconds: wait },
          { "Retry-After": String(wait) },
        );
      },
      () => now,
    );
    await assert.rejects(
      api.send("alice"),
      (e) =>
        e.code === code &&
        e.message === "Friendly server message" &&
        e.retryAt === wait * 1000,
    );
    await assert.rejects(api.send("alice"));
    assert.equal(calls, 1);
    now = wait * 1000;
    await assert.rejects(api.send("alice"));
    assert.equal(calls, 2);
  });
for (const [status, code] of [
  [401, "auth_required"],
  [403, "staff_protected"],
  [403, "session_unsupported"],
  [409, "manual_deletion_required"],
  [503, "send_unavailable"],
])
  test(`send ${code} never becomes sent success`, async () => {
    let calls = 0;
    const api = createDeletionCodeSender(
      async () => session(),
      async () => {
        calls++;
        return response(status, { error: "Server refusal", code });
      },
    );
    await assert.rejects(
      api.send("alice"),
      (e) => e.code === code && e.status === status,
    );
    assert.equal(calls, 1);
  });
test("offline send is ambiguous and blocked for 60s without any automatic retry", async () => {
  let calls = 0;
  const api = createDeletionCodeSender(
    async () => session(),
    async () => {
      calls++;
      throw Error("offline");
    },
    () => 0,
  );
  await assert.rejects(
    api.send("alice"),
    (e) => e.code === "send_uncertain" && e.retryAt === 60000,
  );
  await assert.rejects(api.send("alice"));
  assert.equal(calls, 1);
});
test("malformed 2xx cannot claim a sent email or allow immediate resend", async () => {
  let calls = 0;
  const api = createDeletionCodeSender(
    async () => session(),
    async () => {
      calls++;
      return response(200, { sent: true });
    },
    () => 0,
  );
  await assert.rejects(
    api.send("alice"),
    (e) => e.code === "send_uncertain" && e.retryAt === 60000,
  );
  await assert.rejects(api.send("alice"));
  assert.equal(calls, 1);
});
test("send timeout covers reading JSON too and never replays", async () => {
  let calls = 0;
  const api = createDeletionCodeSender(
    async () => session(),
    async (_url, options) => {
      calls++;
      return {
        json: () =>
          new Promise((_r, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(Error("timeout")),
            ),
          ),
      };
    },
    () => 0,
    5,
  );
  await assert.rejects(api.send("alice"), (e) => e.code === "send_uncertain");
  assert.equal(calls, 1);
});
test("rapid taps send once; cooldown remains owner scoped", async () => {
  const pending = deferred();
  let calls = 0;
  const api = createDeletionCodeSender(
    async () => session(),
    async () => {
      calls++;
      await pending.promise;
      return response(200, payload);
    },
    () => 0,
  );
  const first = api.send("alice");
  await assert.rejects(api.send("alice"), (e) => e.code === "busy");
  pending.resolve();
  await first;
  assert.equal(calls, 1);
});
test("missing/changed owner is rejected before sending", async () => {
  for (const current of [null, session("bob")]) {
    let calls = 0;
    const api = createDeletionCodeSender(
      async () => current,
      async () => calls++,
    );
    await assert.rejects(api.send("alice"), (e) => e.code === "auth_required");
    assert.equal(calls, 0);
  }
});
test("send ignores results after owner/email/sign-in session changes", async () => {
  for (const next of [
    session("bob"),
    { ...session(), user: { id: "alice", email: "changed@example.test" } },
    session("alice", "00000000-0000-4000-8000-000000000002"),
  ]) {
    let current = session();
    const api = createDeletionCodeSender(
      async () => current,
      async () => {
        current = next;
        return response(200, payload);
      },
    );
    await assert.rejects(api.send("alice"), (e) => e.code === "auth_required");
  }
});
test("refresh preserves scope and pending code; re-login/account/email changes reset it", async () => {
  const a = session(),
    fresh = session("alice", sid, 2);
  const scope = (s) =>
    deletionSessionScope(s.access_token, s.user.id, s.user.email);
  assert.equal(scope(a), scope(fresh));
  assert.notEqual(scope(a), scope(session("bob")));
  assert.notEqual(
    scope(a),
    scope(session("alice", "00000000-0000-4000-8000-000000000002")),
  );
  let current = a;
  const api = createDeletionCodeSender(
    async () => current,
    async () => {
      current = fresh;
      return response(200, payload);
    },
  );
  assert.equal((await api.send("alice")).sent, true);
  assert.doesNotThrow(() => deletionSessionScope("malformed", "alice"));
});
test("delete code is a trimmed six-digit string, preserving leading zero; no password/proof sent", async () => {
  let request;
  const api = createAccountDeletion(
    async () => session(),
    async (_url, options) => {
      request = options;
      return response(200, { deleted: true });
    },
  );
  await api.delete(
    "alice",
    " ALICE@example.test ",
    undefined,
    undefined,
    " 012345 ",
  );
  assert.deepEqual(JSON.parse(request.body), {
    confirmEmail: "alice@example.test",
    emailCode: "012345",
  });
  assert.equal(
    request.headers.Authorization,
    "Bearer " + session().access_token,
  );
});
test("mixed proofs and malformed codes never send deletion", async () => {
  let calls = 0;
  const api = createAccountDeletion(
    async () => session(),
    async () => calls++,
  );
  for (const args of [
    ["pass", undefined, "123456"],
    [undefined, { userId: "alice", accessToken: "proof" }, "123456"],
    [undefined, undefined, "12345"],
    [undefined, undefined, "abcdef"],
    [undefined, undefined, "1234567"],
    [undefined, undefined, ""],
  ])
    await assert.rejects(
      api.delete("alice", "alice@example.test", ...args),
      (e) => e.code === "invalid_request",
    );
  assert.equal(calls, 0);
});
for (const code of [
  "code_wrong",
  "code_expired",
  "code_used",
  "code_missing",
  "code_session_mismatch",
  "code_email_changed",
  "session_unsupported",
  "deletion_failed",
  "auth_required",
])
  test(`delete ${code} never retries or falls back to recent login`, async () => {
    let calls = 0;
    const api = createAccountDeletion(
      async () => session(),
      async () => {
        calls++;
        return response(code === "deletion_failed" ? 500 : 403, {
          error: "Friendly " + code,
          code,
          attempts_left: 4,
          retry_safe: true,
        });
      },
    );
    await assert.rejects(
      api.delete("alice", "alice@example.test", undefined, undefined, "123456"),
      (e) =>
        e.code === code &&
        e.message === "Friendly " + code &&
        e.attemptsLeft === 4,
    );
    assert.equal(calls, 1);
  });

test("native scope decoding needs neither Buffer nor atob and tolerates Unicode JWT metadata", () => {
  const before = globalThis.atob;
  try {
    globalThis.atob = undefined;
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9." +
      Buffer.from(
        JSON.stringify({ session_id: sid, name: "Thandi 🌍 é" }),
      ).toString("base64url") +
      ".fixture";
    assert.equal(
      deletionSessionScope(jwt, "alice", "alice@example.test"),
      deletionSessionScope(
        session().access_token,
        "alice",
        "alice@example.test",
      ),
    );
    assert.doesNotThrow(() => deletionSessionScope("x.%%%%.x", "alice"));
    assert.doesNotThrow(() =>
      deletionSessionScope("x." + "a".repeat(32769) + ".x", "alice"),
    );
  } finally {
    globalThis.atob = before;
  }
});

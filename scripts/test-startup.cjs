/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const { setImmediate: flush } = require("node:timers/promises");
const moduleFixture = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/lib/auth-session-store.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)(moduleFixture, moduleFixture.exports);
const { createAuthSessionStore } = moduleFixture.exports;
const session = (id) => ({ user: { id }, access_token: `fixture-${id}` });
const result = (s) => ({ data: { session: s }, error: null });
function fixture(timeout = 1000) {
  let callback,
    reads = 0,
    subscriptions = 0,
    unsubscribes = 0,
    impl = () => Promise.resolve(result(null));
  const client = {
    auth: {
      getSession() {
        reads++;
        return impl();
      },
      onAuthStateChange(cb) {
        callback = cb;
        subscriptions++;
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribes++;
              },
            },
          },
        };
      },
    },
  };
  const store = createAuthSessionStore(client, timeout);
  return {
    store,
    setImpl(fn) {
      impl = fn;
    },
    emit(event, s) {
      callback(event, s);
    },
    counts() {
      return { reads, subscriptions, unsubscribes };
    },
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
test("fast anonymous restoration completes without a minimum launch wait", async () => {
  const f = fixture();
  const off = f.store.subscribe(() => {});
  await flush();
  assert.deepEqual(f.store.getSnapshot(), {
    session: null,
    loading: false,
    error: null,
  });
  assert.equal(f.counts().reads, 1);
  off();
  f.store.dispose();
});
test("all hook consumers share one restore and one app-scope auth subscription", async () => {
  const f = fixture(),
    a = f.store.subscribe(() => {}),
    b = f.store.subscribe(() => {});
  await flush();
  a();
  b();
  const c = f.store.subscribe(() => {});
  await flush();
  assert.deepEqual(f.counts(), { reads: 1, subscriptions: 1, unsubscribes: 0 });
  c();
  f.store.dispose();
  assert.equal(f.counts().unsubscribes, 1);
});
test("slow restoration remains unresolved until the actual session is available", async () => {
  const f = fixture(),
    d = deferred();
  f.setImpl(() => d.promise);
  f.store.subscribe(() => {});
  await flush();
  assert.equal(f.store.getSnapshot().loading, true);
  assert.equal(f.store.getSnapshot().session, null);
  d.resolve(result(session("alice")));
  await flush();
  assert.equal(f.store.getSnapshot().session.user.id, "alice");
  assert.equal(f.store.getSnapshot().error, null);
  f.store.dispose();
});
test("timeout shows a recoverable error and ignores late results or INITIAL_SESSION", async () => {
  const f = fixture(15),
    d = deferred();
  f.setImpl(() => d.promise);
  f.store.subscribe(() => {});
  await new Promise((r) => setTimeout(r, 30));
  const failed = f.store.getSnapshot();
  assert.equal(failed.loading, false);
  assert.ok(failed.error);
  assert.equal(failed.session, null);
  d.resolve(result(session("alice")));
  f.emit("INITIAL_SESSION", session("alice"));
  await flush();
  assert.equal(f.store.getSnapshot(), failed);
  f.store.dispose();
});
test("retry clears the error, deduplicates repeated taps, and permits a fresh result", async () => {
  const f = fixture();
  f.setImpl(() => Promise.reject(Error("offline")));
  f.store.subscribe(() => {});
  await flush();
  assert.ok(f.store.getSnapshot().error);
  const d = deferred();
  f.setImpl(() => d.promise);
  f.store.retry();
  f.store.retry();
  await flush();
  assert.equal(f.counts().reads, 2);
  assert.equal(f.store.getSnapshot().loading, true);
  d.resolve(result(null));
  await flush();
  assert.deepEqual(f.store.getSnapshot(), {
    session: null,
    loading: false,
    error: null,
  });
  f.store.dispose();
});
test("SDK error result cannot be bypassed by a concurrent signed-out event", async () => {
  const f = fixture(),
    d = deferred();
  f.setImpl(() => d.promise);
  f.store.subscribe(() => {});
  await flush();
  f.emit("SIGNED_OUT", null);
  d.resolve({ data: { session: null }, error: Error("refresh failed") });
  await flush();
  assert.ok(f.store.getSnapshot().error);
  f.store.dispose();
});
test("sign-in, sign-out and token refresh update subscribers without restarting initialization", async () => {
  const f = fixture();
  let notifications = 0;
  f.store.subscribe(() => notifications++);
  await flush();
  f.emit("SIGNED_IN", session("alice"));
  assert.equal(f.store.getSnapshot().session.user.id, "alice");
  f.emit("TOKEN_REFRESHED", session("alice"));
  f.emit("SIGNED_OUT", null);
  assert.equal(f.store.getSnapshot().loading, false);
  assert.equal(f.store.getSnapshot().session, null);
  assert.equal(f.counts().reads, 1);
  assert.ok(notifications >= 4);
  f.store.dispose();
});
test("a sign-out during restoration wins over an older session snapshot", async () => {
  const f = fixture(),
    d = deferred();
  f.setImpl(() => d.promise);
  f.store.subscribe(() => {});
  await flush();
  f.emit("SIGNED_OUT", null);
  d.resolve(result(session("alice")));
  await flush();
  assert.equal(f.store.getSnapshot().session, null);
  assert.equal(f.store.getSnapshot().error, null);
  f.store.dispose();
});
test("a timed-out old result cannot overwrite a successful retry for another account", async () => {
  const f = fixture(15),
    old = deferred();
  f.setImpl(() => old.promise);
  f.store.subscribe(() => {});
  await new Promise((r) => setTimeout(r, 30));
  f.setImpl(() => Promise.resolve(result(session("bob"))));
  f.store.retry();
  await flush();
  old.resolve(result(session("alice")));
  await flush();
  assert.equal(f.store.getSnapshot().session.user.id, "bob");
  f.store.dispose();
});
test("teardown removes callbacks/timers and suppresses pending notifications", async () => {
  const f = fixture(15),
    d = deferred();
  let n = 0;
  f.setImpl(() => d.promise);
  f.store.subscribe(() => n++);
  await flush();
  f.store.dispose();
  const before = n;
  d.resolve(result(session("alice")));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(n, before);
  assert.equal(f.counts().unsubscribes, 1);
});

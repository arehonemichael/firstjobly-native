const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./ads-load.cjs");
const { createSavedStore } = load("src/lib/saved/store.ts");
const { createCircularTransport } = load("src/lib/circular/transport.ts");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const turn = () => new Promise((r) => setImmediate(r));
test("saved reads coalesce, reuse 60s cache (including empty), explicit refresh bypasses freshness", async () => {
  let reads = 0,
    time = 0;
  const read = deferred();
  const store = createSavedStore(
    {
      read: async () => {
        reads++;
        return read.promise;
      },
      write: async () => {},
    },
    () => time,
  );
  store.setOwner("a");
  const first = store.load("a"),
    second = store.load("a");
  assert.equal(reads, 1);
  read.resolve([]);
  await Promise.all([first, second]);
  await store.load("a");
  assert.equal(reads, 1);
  await store.load("a", true);
  assert.equal(reads, 2);
  time = 60000;
  await store.load("a");
  assert.equal(reads, 3);
});
test("switching away and back cannot revive an earlier private saved read", async () => {
  const stale = deferred();
  let calls = 0;
  const store = createSavedStore({
    read: async () => (++calls === 1 ? stale.promise : ["fresh"]),
    write: async () => {},
  });
  store.setOwner("a");
  const old = store.load("a");
  store.setOwner("b");
  assert.deepEqual(store.getSnapshot().ids, []);
  store.setOwner("a");
  await store.load("a");
  stale.resolve(["private-old"]);
  await old;
  assert.deepEqual(store.getSnapshot().ids, ["fresh"]);
  store.setOwner(null);
  assert.deepEqual(store.getSnapshot().ids, []);
});
test("saved mutation locks duplicate taps, defers reads and broadcasts successful ids", async () => {
  const write = deferred();
  let writes = 0,
    reads = 0,
    updates = 0;
  const store = createSavedStore({
    read: async () => {
      reads++;
      return ["one"];
    },
    write: async () => {
      writes++;
      await write.promise;
    },
  });
  store.setOwner("a");
  await store.load("a");
  const off = store.subscribe(() => updates++);
  const pending = store.toggle("a", "two");
  assert.equal((await store.toggle("a", "two")).ok, false);
  await store.load("a", true);
  assert.equal(reads, 1);
  assert.equal(writes, 1);
  write.resolve();
  assert.equal((await pending).saved, true);
  assert.deepEqual(store.getSnapshot().ids, ["one", "two"]);
  assert.equal(updates, 1);
  off();
});
test("saved failures retain known ids and failed writes are not retried or published", async () => {
  let fail = false,
    writes = 0;
  const store = createSavedStore({
    read: async () => {
      if (fail) throw Error();
      return ["one"];
    },
    write: async () => {
      writes++;
      throw Error();
    },
  });
  store.setOwner("a");
  await store.load("a");
  assert.equal((await store.toggle("a", "one")).ok, false);
  assert.equal(writes, 1);
  fail = true;
  await store.load("a", true);
  assert.deepEqual(store.getSnapshot().ids, ["one"]);
  assert.ok(store.getSnapshot().error);
  assert.equal(store.getSnapshot().loading, false);
});
test("an old owner mutation completion cannot enter the new account snapshot", async () => {
  const write = deferred();
  const store = createSavedStore({
    read: async () => [],
    write: () => write.promise,
  });
  store.setOwner("a");
  await store.load("a");
  const task = store.toggle("a", "private");
  store.setOwner("b");
  await store.load("b");
  write.resolve();
  assert.equal((await task).ok, false);
  assert.deepEqual(store.getSnapshot().ids, []);
});
const auth = {
  getSession: async () => ({
    data: { session: { user: { id: "a" }, access_token: "fixture" } },
  }),
  refreshSession: async () => ({ data: { session: null } }),
};
const ok = (data) => new Response(JSON.stringify(data));
test("Gov identical simultaneous GETs coalesce, resolved requests are not permanent transport cache", async () => {
  const reply = deferred();
  let count = 0;
  const api = createCircularTransport(auth, async () => {
    count++;
    await reply.promise;
    return ok({ batch: null });
  });
  const one = api.request("a", "/circular-batches/latest"),
    two = api.request("a", "/circular-batches/latest");
  await turn();
  assert.equal(count, 1);
  reply.resolve();
  await Promise.all([one, two]);
  await api.request("a", "/circular-batches/latest");
  assert.equal(count, 2);
});
test("Gov owner identity and path are part of the coalescing key", async () => {
  let count = 0;
  const api = createCircularTransport(auth, async () => {
    count++;
    return ok({ batch: null });
  });
  await assert.rejects(
    api.request("b", "/circular-batches/latest"),
    /account changed/,
  );
  assert.equal(count, 0);
  await api.request("a", "/circular-batches/latest");
  assert.equal(count, 1);
});
test("Gov invalidation prevents an old in-flight read entering a cleared cache", async () => {
  const reply = deferred();
  let count = 0;
  const api = createCircularTransport(auth, async () => {
    count++;
    if (count === 1) await reply.promise;
    return ok({ batch: null });
  });
  const old = api.request("a", "/circular-batches/latest");
  await turn();
  api.invalidateReads();
  await api.request("a", "/circular-batches/latest");
  reply.resolve();
  await assert.rejects(old, /information changed/);
  assert.equal(count, 2);
});
test("Gov writes are never coalesced and success invalidates earlier reads", async () => {
  const reply = deferred();
  let writes = 0;
  const api = createCircularTransport(auth, async (_url, options) => {
    if (options.method === "GET") {
      await reply.promise;
      return ok({ batch: null });
    }
    writes++;
    return ok({ saved: true });
  });
  const old = api.request("a", "/circular-batches/latest");
  await turn();
  await Promise.all([
    api.request("a", "/circular-jobs/job-1/save", "POST"),
    api.request("a", "/circular-jobs/job-1/save", "POST"),
  ]);
  assert.equal(writes, 2);
  reply.resolve();
  await assert.rejects(old, /information changed/);
});

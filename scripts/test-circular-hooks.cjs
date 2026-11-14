const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load, hooks } = require("./resume-fixture.cjs");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const page = (ids, page = 1, more = false) => ({
  items: ids.map((id) => ({ id, post_title: id })),
  page,
  page_size: 20,
  total: 40,
  has_more: more,
});
function fixture() {
  let now = 0,
    owner = "alice",
    reply;
  const requests = [];
  const cache = load("src/lib/circular/state.ts", {}).createOwnerCache(
    () => now,
  );
  const h = hooks();
  const client = {
    circularCache: cache,
    circularAPI: {
      request: (user, path) => {
        requests.push([user, path]);
        return reply();
      },
    },
    invalidateCircular: () => cache.clear(),
    isWithdrawn: () => false,
  };
  const mod = load("src/hooks/use-circular.ts", {
    react: h.react,
    "expo-router": { useFocusEffect: h.focusEffect },
    "@react-native-async-storage/async-storage": {},
    "./use-auth": { useAuth: () => ({ userId: owner, loading: false }) },
    "../lib/circular/client": client,
    "../lib/circular/list": load("src/lib/circular/list.ts", {}),
    "../lib/circular/transport": { CircularError: Error },
    "../lib/circular/contract": {
      listPath: (filters, p = 1) =>
        "/circular-jobs?page=" +
        p +
        "&page_size=20" +
        (filters.search ? "&search=" + filters.search : ""),
    },
  });
  return {
    h,
    cache,
    requests,
    mod,
    advance: (ms) => (now += ms),
    owner: (id) => (owner = id),
    reply: (fn) => (reply = fn),
  };
}
test("stale first page stays visible during slow revalidation and errors", async () => {
  const f = fixture(),
    p = "/circular-jobs?page=1&page_size=20",
    old = page(["old"]);
  f.cache.set("alice", p, old);
  f.advance(300001);
  const waiting = deferred();
  f.reply(() => waiting.promise);
  const read = () => f.mod.useCircularQuery(p);
  f.h.render(read);
  f.h.focus();
  let state = f.h.render(read);
  assert.equal(state.data, old);
  assert.equal(state.loading, true);
  waiting.reject(Error("offline"));
  await tick();
  state = f.h.render(read);
  assert.equal(state.data, old);
  assert.match(state.error.message, /offline/);
  assert.equal(state.loading, false);
});
test("obsolete search response cannot overwrite the current filter", async () => {
  const f = fixture(),
    a = deferred(),
    b = deferred();
  let p = "/circular-jobs?page=1&search=old";
  f.reply(() => a.promise);
  const read = () => f.mod.useCircularQuery(p);
  f.h.render(read);
  const blur = f.h.focus();
  blur();
  p = "/circular-jobs?page=1&search=new";
  f.reply(() => b.promise);
  f.h.render(read);
  f.h.focus();
  b.resolve(page(["new"]));
  await tick();
  f.h.render(read);
  a.resolve(page(["old"]));
  await tick();
  assert.equal(f.h.render(read).data.items[0].id, "new");
});
test("new account never sees another account cached results", async () => {
  const f = fixture(),
    p = "/circular-jobs?page=1";
  f.cache.set("alice", p, page(["private"]));
  const read = () => f.mod.useCircularQuery(p);
  f.h.render(read);
  f.h.focus();
  assert.equal(f.h.render(read).data.items[0].id, "private");
  f.owner("bob");
  const waiting = deferred();
  f.reply(() => waiting.promise);
  f.h.render(read);
  f.h.focus();
  assert.equal(f.h.render(read).data, undefined);
  waiting.resolve(page(["bob"]));
  await tick();
  assert.equal(f.h.render(read).data.items[0].id, "bob");
});
test("loaded pages survive stale detail return; explicit refresh keeps rows until successful replacement", async () => {
  const f = fixture();
  f.reply(() => Promise.resolve(page(["one"], 1, true)));
  const read = () => f.mod.useCircularFeed({});
  f.h.render(read);
  let blur = f.h.focus();
  await tick();
  let state = f.h.render(read);
  f.reply(() => Promise.resolve(page(["two"], 2, true)));
  await state.next();
  state = f.h.render(read);
  assert.deepEqual(
    state.items.map((x) => x.id),
    ["one", "two"],
  );
  blur();
  f.advance(300001);
  f.h.render(read);
  blur = f.h.focus();
  await tick();
  state = f.h.render(read);
  assert.deepEqual(
    state.items.map((x) => x.id),
    ["one", "two"],
  );
  assert.equal(f.requests.length, 2);
  const waiting = deferred();
  f.reply(() => waiting.promise);
  const refresh = state.refresh();
  state = f.h.render(read);
  assert.deepEqual(
    state.items.map((x) => x.id),
    ["one", "two"],
  );
  assert.equal(state.loading, true);
  waiting.resolve(page(["replacement"]));
  await refresh;
  state = f.h.render(read);
  assert.deepEqual(
    state.items.map((x) => x.id),
    ["replacement"],
  );
  blur();
});
test("late page from old search cannot overwrite new pagination", async () => {
  const f = fixture();
  let filters = {};
  f.reply(() => Promise.resolve(page(["old"], 1, true)));
  const read = () => f.mod.useCircularFeed(filters);
  f.h.render(read);
  let blur = f.h.focus();
  await tick();
  let state = f.h.render(read);
  const waiting = deferred();
  f.reply(() => waiting.promise);
  const next = state.next();
  blur();
  filters = { search: "new" };
  f.reply(() => Promise.resolve(page(["new"], 1, true)));
  f.h.render(read);
  f.h.focus();
  await tick();
  state = f.h.render(read);
  waiting.resolve(page(["obsolete"], 2, true));
  await next;
  state = f.h.render(read);
  assert.deepEqual(
    state.items.map((x) => x.id),
    ["new"],
  );
  f.reply(() => Promise.resolve(page(["new2"], 2, false)));
  await state.next();
  assert.deepEqual(
    f.h.render(read).items.map((x) => x.id),
    ["new", "new2"],
  );
});

test("mutation invalidation takes precedence over preserving paginated rows", async () => {
  const f = fixture();
  f.reply(() => Promise.resolve(page(["one"], 1, true)));
  const read = () => f.mod.useCircularFeed({});
  f.h.render(read);
  let blur = f.h.focus();
  await tick();
  let state = f.h.render(read);
  f.reply(() => Promise.resolve(page(["two"], 2, false)));
  await state.next();
  f.h.render(read);
  blur();
  f.cache.clear();
  f.reply(() => Promise.resolve(page(["updated"], 1, false)));
  f.h.render(read);
  f.h.focus();
  await tick();
  assert.deepEqual(
    f.h.render(read).items.map((x) => x.id),
    ["updated"],
  );
});

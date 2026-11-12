/* global __dirname */
const { Buffer } = require("node:buffer");
/* Pure session/content tests; no backend, React runtime or device required. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} };
  cache.set(full, module);
  const js = ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = (name) =>
    name.startsWith(".")
      ? load(
          path.relative(root, path.resolve(path.dirname(full), name + ".ts")),
        )
      : require(name);
  new Function("module", "exports", "require", js)(
    module,
    module.exports,
    localRequire,
  );
  return module.exports;
}
const { chooseHomeHeroContent, createHomeHeroSessionStore } = load(
  "src/lib/home-hero-session.ts",
);
const { HOME_HERO_IMAGE_IDS, HOME_HERO_HEADLINES } = load(
  "src/constants/home-hero.ts",
);
const { JOB_MARKET_FACTS } = load("src/constants/job-market-facts.ts");

test("the seven bundled photos are byte-identical to the historical assets", () => {
  const hashes = [
    "391fb1888698af284d530161f5e0f50a291293b1",
    "de4cd1cf06ce29a7f46d1f3387e1ac84620aa321",
    "9247716a018715c1e9e771e4a7b86ffa295056d6",
    "23a2836228185c1021f5187a364d5016078bc943",
    "467e8adf72d2fc1f957e55766f677d4752697376",
    "aa9eec03e6a90313d7e9293e4d8739609218cb8f",
    "b023789b413f759b482ba7b588917722712ef0c1",
  ];
  assert.equal(HOME_HERO_IMAGE_IDS.length, hashes.length);
  HOME_HERO_IMAGE_IDS.forEach((id, index) => {
    const bytes = fs.readFileSync(
      path.join(root, "assets/images/hero", id + ".png"),
    );
    const hash = crypto
      .createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`))
      .update(bytes)
      .digest("hex");
    assert.equal(hash, hashes[index], id);
  });
});
test("all original headlines and the full fact bank are available", () => {
  assert.deepEqual(
    [...HOME_HERO_HEADLINES],
    [
      "Build experience that opens doors",
      "Skills can shape your next move",
      "Start where opportunity grows",
      "Your next chapter starts with one opportunity",
    ],
  );
  assert.equal(JOB_MARKET_FACTS.length, 24);
  assert.ok(JOB_MARKET_FACTS.every((fact) => fact.text.length > 0));
});
test("selection preserves the original independent draws as one immutable group", () => {
  for (let image = 0; image < 7; image++)
    for (let headline = 0; headline < 4; headline++) {
      const draws = [(image + 0.1) / 7, (headline + 0.1) / 4, (23 + 0.1) / 24];
      const content = chooseHomeHeroContent(() => draws.shift());
      assert.equal(content.imageId, HOME_HERO_IMAGE_IDS[image]);
      assert.equal(content.headline, HOME_HERO_HEADLINES[headline]);
      assert.equal(content.message, JOB_MARKET_FACTS[23].text);
      assert.ok(Object.isFrozen(content));
      assert.equal(draws.length, 0);
    }
});
test("first and last random values stay within the content bank", () => {
  assert.equal(chooseHomeHeroContent(() => 0).imageId, "hero-1");
  const last = chooseHomeHeroContent(() => 0.999999999);
  assert.equal(last.imageId, "hero-7");
  assert.equal(last.headline, HOME_HERO_HEADLINES[3]);
  assert.equal(last.message, JOB_MARKET_FACTS[23].text);
});
test("new and returning users get content only after session hydration", () => {
  for (const user of [null, "returning-user"]) {
    let calls = 0;
    const store = createHomeHeroSessionStore(() => {
      calls++;
      return chooseHomeHeroContent(() => 0);
    });
    assert.equal(store.getSnapshot(), null);
    assert.equal(calls, 0);
    store.updateUser(user);
    assert.ok(store.getSnapshot().content);
    assert.equal(calls, 1);
    assert.equal(store.getSnapshot().revision, 1);
  }
});
test("navigation/remounts, foregrounding and token refresh keep the complete group", () => {
  let calls = 0;
  const store = createHomeHeroSessionStore(() => {
    calls++;
    return chooseHomeHeroContent(() => 0.5);
  });
  store.updateUser("alice");
  const first = store.getSnapshot();
  for (let i = 0; i < 20; i++) {
    const unsubscribe = store.subscribe(() => {});
    store.updateUser("alice");
    assert.equal(store.getSnapshot(), first);
    unsubscribe();
    assert.equal(store.getSnapshot(), first);
  }
  assert.equal(calls, 1);
});
test("sign-in, sign-out and switching accounts establish a new selection", () => {
  let calls = 0;
  const store = createHomeHeroSessionStore(() => {
    calls++;
    return chooseHomeHeroContent(() => 0);
  });
  for (const owner of [null, "alice", null, "alice", "bob"]) {
    const old = store.getSnapshot();
    store.updateUser(owner);
    assert.notEqual(store.getSnapshot(), old);
    assert.equal(store.getSnapshot().revision, calls);
  }
  assert.equal(calls, 5);
});
test("repeats are allowed across sessions and fresh app stores choose again", () => {
  const pick = () => chooseHomeHeroContent(() => 0.25);
  const store = createHomeHeroSessionStore(pick);
  store.updateUser("alice");
  const first = store.getSnapshot();
  store.updateUser(null);
  const second = store.getSnapshot();
  assert.deepEqual(first.content, second.content);
  assert.notEqual(first.revision, second.revision);
  const fresh = createHomeHeroSessionStore(pick);
  assert.equal(fresh.getSnapshot(), null);
  fresh.updateUser("alice");
  assert.deepEqual(fresh.getSnapshot().content, first.content);
});
test("subscribers observe one atomic group and are cleaned up", () => {
  const store = createHomeHeroSessionStore(() =>
    chooseHomeHeroContent(() => 0),
  );
  const seen = [];
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));
  store.updateUser(null);
  store.updateUser(null);
  store.updateUser("alice");
  unsubscribe();
  store.updateUser("bob");
  assert.equal(seen.length, 2);
  assert.ok(
    seen.every(
      (s) => s.content.imageId && s.content.headline && s.content.message,
    ),
  );
});

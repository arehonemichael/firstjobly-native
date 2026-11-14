/* Component wiring checks; ad policy itself is covered by test-ads.cjs. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { load } = require("./resume-fixture.cjs");
const contract = load("src/lib/circular/contract.ts", {});
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
function cardFixture(busy = false) {
  const events = [];
  const mocks = {
    "react/jsx-runtime": runtime,
    "../../ads/useJobInterstitial": {
      useEarlyJobInterstitial: () => ({
        openJobWithEarlyInterstitial: (done) => {
          events.push("job-open");
          done();
        },
      }),
    },
    "react-native": { View: "View" },
    "lucide-react-native": { Heart: "Heart", MapPin: "MapPin" },
    "expo-router": { router: { push: (to) => events.push(to) } },
    "../ui/primitives": { AppText: "Text", AppPressable: "Pressable" },
    "../../constants/theme": { Colors: {} },
    "../../lib/circular/contract": contract,
    "./shared": { cs: { card: {}, row: {}, heading: {}, muted: {}, body: {} } },
  };
  const source = ts.transpileModule(
    fs.readFileSync("src/components/circular/card.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", source)(
    mod,
    mod.exports,
    (name) => {
      if (!(name in mocks)) throw Error(name);
      return mocks[name];
    },
  );
  const job = {
    id: "gov-job-1",
    post_title: "CLERK",
    department: "Health",
    centre: "Pretoria",
    province: "Gauteng",
    salary_text: "R216417 per annum",
    closing_date: "2026-12-01",
    closes_in_days: 17,
    saved: false,
  };
  const tree = mod.exports.CircularCard({
    job,
    busy,
    onSave: () => events.push("save"),
  });
  return { tree, events };
}
function texts(node) {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  return node?.props ? texts(node.props.children) : [];
}
test("Gov card's title, metadata, salary, closing date and padding belong to one tappable surface routed through the existing ad hook", () => {
  const { tree, events } = cardFixture();
  const [open, save] = tree.props.children;
  assert.equal(open.type, "Pressable");
  assert.equal(open.props.accessibilityLabel, "Open Clerk");
  const content = texts(open).join(" ");
  for (const text of [
    "Clerk",
    "Health",
    "Pretoria",
    "Gauteng",
    "216",
    "Closes",
  ])
    assert.ok(content.includes(text));
  open.props.onPress();
  assert.deepEqual(events, [
    "job-open",
    { pathname: "/circular-jobs/[id]", params: { id: "gov-job-1" } },
  ]);
  assert.equal(save.type, "Pressable");
});
test("Save is a separate 44dp sibling target, never a nested button or a job-open/ad event", () => {
  const { tree, events } = cardFixture();
  const [open, save] = tree.props.children;
  assert.equal(texts(open).includes(save), false);
  assert.equal(save.props.accessibilityLabel, "Save Clerk");
  assert.equal(save.props.style.width, 44);
  assert.equal(save.props.style.height, 44);
  save.props.onPress();
  assert.deepEqual(events, ["save"]);
  assert.equal(cardFixture(true).tree.props.children[1].props.disabled, true);
});
test("Gov feed inserts the shared native-ad component at the same configured indices as regular Jobs, outside the job tap surface", () => {
  const source = fs.readFileSync("src/components/circular/feed.tsx", "utf8");
  const ast = ts.createSourceFile(
    "feed.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let render;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "renderItem")
      render = node.initializer.expression;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(render);
  const predicate =
    require("./ads-load.cjs").load("src/ads/config.ts").shouldInsertNative;
  const expression = ts.transpileModule(
    `const render = ${render.getText(ast)};`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const renderItem = new Function(
    "exports",
    "View",
    "CircularCard",
    "NativeAdBlock",
    "shouldInsertNative",
    "saver",
    "setSaveError",
    "require",
    expression + ";return render;",
  )(
    {},
    "View",
    "Card",
    "Native",
    predicate,
    { busy: null },
    () => {},
    () => runtime,
  );
  const shown = [];
  for (let index = 0; index < 20; index++) {
    const tree = renderItem({ item: { id: `job-${index}` }, index });
    const [card, ad] = tree.props.children;
    assert.equal(card.type, "Card");
    if (ad) {
      assert.equal(ad.type, "Native");
      assert.equal(ad.props.variant, "feed");
      shown.push(index);
    }
  }
  assert.deepEqual(shown, [3, 9, 15]);
});

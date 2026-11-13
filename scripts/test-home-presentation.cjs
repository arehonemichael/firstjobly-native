/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file) {
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
  new Function("module", "exports", js)(mod, mod.exports);
  return mod.exports;
}
const { tabPresentation, categoryPresentation } = load(
  "src/lib/home-presentation.ts",
);
const { brandWordmarkSize } = load("src/lib/brand-layout.ts");
test("five tabs keep complete labels and 44dp targets on narrow screens", () => {
  for (const width of [320, 360, 390, 540]) {
    assert.equal(tabPresentation(width).showLabels, true);
    assert.equal(tabPresentation(width).iconSize, 24);
    assert.ok(width / 5 >= 44);
  }
  for (const width of [560, 768, 1120])
    assert.equal(tabPresentation(width).showLabels, true);
  assert.equal(tabPresentation(360).labelSize, 11);
});
test("category grid fits actual Home gutters with even gaps and accessible large-text rows", () => {
  for (const width of [360, 390, 768]) {
    const available = width - 48;
    const layout = categoryPresentation(available);
    assert.equal(layout.columns, 2);
    assert.equal(layout.width * 2 + layout.gap, available);
    const large = categoryPresentation(available, 3);
    assert.equal(large.columns, 1);
    assert.equal(large.width, available);
    assert.equal(large.labelHeight, 120);
  }
  assert.equal(categoryPresentation(272).columns, 1);
});
test("shared brand preserves normal Home size and supports larger auth display without overflow", () => {
  assert.equal(brandWordmarkSize(312), 22);
  assert.equal(brandWordmarkSize(312, 1, 32), 32);
  for (const width of [272, 312, 342, 432])
    for (const scale of [1, 1.3, 2, 3]) {
      const size = brandWordmarkSize(width, scale, 32);
      assert.ok(size * scale * 6.4 + 6 <= width + 0.01);
      assert.ok(size * scale >= 22);
    }
});

/* global __dirname */
// Controller tests never evaluate the native module. Expo boundary tests exercise
// the real SDK gate separately with a throwing fake native implementation.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (full.endsWith("/src/ads/sdk.ts")) return { mobileAdsSDK: null };
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} };
  cache.set(full, module);
  const js = ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const local = (name) =>
    name.startsWith(".")
      ? load(
          path.relative(root, path.resolve(path.dirname(full), name + ".ts")),
        )
      : require(name);
  new Function("module", "exports", "require", "__DEV__", js)(
    module,
    module.exports,
    local,
    false,
  );
  return module.exports;
}
module.exports = { load };

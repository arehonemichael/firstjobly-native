/* global __dirname */
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const modules = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (modules.has(full)) return modules.get(full).exports;
  const module = { exports: {} };
  modules.set(full, module);
  const source = fs.readFileSync(full, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const local = (name) =>
    name.startsWith(".")
      ? load(
          path.relative(
            root,
            path.resolve(
              path.dirname(full),
              /\.[cm]?[jt]s$/.test(name) ? name : name + ".ts",
            ),
          ),
        )
      : require(name);
  new Function("module", "exports", "require", js)(
    module,
    module.exports,
    local,
  );
  return module.exports;
}
module.exports = { load, root };

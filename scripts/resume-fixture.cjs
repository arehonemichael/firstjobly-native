/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, mocks, globals = {}) {
  const mod = { exports: {} };
  new Function(
    "module",
    "exports",
    "require",
    ...Object.keys(globals),
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  )(
    mod,
    mod.exports,
    (n) => {
      if (n in mocks) return mocks[n];
      throw Error(n);
    },
    ...Object.values(globals),
  );
  return mod.exports;
}
function hooks() {
  const slots = [];
  let index = 0,
    focus;
  const equal = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const result = {
    react: {
      useRef(value) {
        const i = index++;
        return (slots[i] ??= { current: value });
      },
      useState(initial) {
        const i = index++;
        if (!(i in slots))
          slots[i] = typeof initial === "function" ? initial() : initial;
        return [
          slots[i],
          (value) =>
            (slots[i] = typeof value === "function" ? value(slots[i]) : value),
        ];
      },
      useCallback(fn, deps) {
        const i = index++;
        if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { fn, deps };
        return slots[i].fn;
      },
      useEffect(fn, deps) {
        const i = index++;
        if (!slots[i] || !equal(slots[i].deps, deps)) {
          slots[i]?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        }
      },
      useSyncExternalStore() {
        throw Error("unused");
      },
    },
    focusEffect: (fn) => {
      focus = fn;
    },
    render(fn) {
      index = 0;
      return fn();
    },
    focus() {
      return focus();
    },
    dispose() {
      for (const item of slots) item?.cleanup?.();
    },
  };
  result.react.useLayoutEffect = result.react.useEffect;
  return result;
}

module.exports = { load, hooks };

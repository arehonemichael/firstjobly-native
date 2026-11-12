/* global __dirname */
const { Buffer } = require("node:buffer");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const current = path.resolve(__dirname, ".."),
  root = process.argv[2] ?? current;
const { createClient } = require("@supabase/supabase-js");
const { backend } = require(current + "/scripts/personalization/backend.cjs");
const { job, now } = require(current + "/scripts/personalization/fixtures.cjs");
function load(file, cache = new Map()) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const m = { exports: {} };
  cache.set(full, m);
  const js = ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("module", "exports", "require", js)(m, m.exports, (n) =>
    n.startsWith(".")
      ? load(
          path.relative(
            root,
            path.resolve(path.dirname(full), n.endsWith(".ts") ? n : n + ".ts"),
          ),
          cache,
        )
      : require(require.resolve(n, { paths: [current] })),
  );
  return m.exports;
}
(async () => {
  const { createRecommendationService } = load(
    "src/lib/recommendations/service.ts",
  );
  const samples = [];
  for (let t = 0; t < 6; t++) {
    const b = backend();
    b.tables.jobs = Array.from({ length: 300 }, (_, i) =>
      job(i + 1, {
        category: i % 2 ? "government" : "internship",
        description: "Detail body ".repeat(350),
        responsibilities: ["Task description ".repeat(50)],
        required_documents: ["cv"],
      }),
    );
    let bytes = 0,
      requests = 0;
    const client = createClient("https://isolated.supabase.test", "fixture", {
      global: {
        fetch: async (...args) => {
          requests++;
          await new Promise((r) => setTimeout(r, 40));
          const response = await b.fetch(...args);
          bytes += Buffer.byteLength(await response.clone().text());
          return response;
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    client.auth.getSession = b.client.auth.getSession;
    const service = createRecommendationService(client, b.storage, () => now);
    const start = performance.now();
    await service.feed();
    const cold = performance.now() - start;
    const count = requests;
    const warmStart = performance.now();
    await service.feed();
    samples.push({
      cold: Math.round(cold),
      warm: Math.round((performance.now() - warmStart) * 100) / 100,
      requests: count,
      warmRequests: requests - count,
      bytes,
    });
  }
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b),
      middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  console.log(
    JSON.stringify(
      {
        conditions:
          "6 cold trials, same 300 jobs, synthetic 40ms/HTTP request, same text bodies; warm feed immediately afterwards",
        root,
        medianColdMs: median(samples.map((s) => s.cold)),
        medianWarmMs: median(samples.map((s) => s.warm)),
        samples,
      },
      null,
      2,
    ),
  );
})();

/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const js = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("module", "exports", "require", js)(mod, mod.exports, (n) => {
    if (n in mocks) return mocks[n];
    throw Error("Unexpected import " + n);
  });
  return mod.exports;
}
const jobs = load("src/lib/jobs.ts");
const engine = load("src/lib/recommendations/engine.ts", {
  "./config": { RULES: {} },
  "./contracts": {},
  "../job-filters": {},
});
const { createHotJobsService, hotJobOpen, HOT_JOB_COLUMNS } = load(
  "src/lib/hot-jobs/service.ts",
  { "../jobs": jobs, "../recommendations/engine": engine },
);
const now = Date.parse("2026-11-13T10:00:00Z");
const rules = {
  enabled: true,
  minimumActivity: 10,
  maxJobs: 20,
  cacheMs: 300000,
  maximumAgeMs: 900000,
};
const job = (id, extra = {}) => ({
  id,
  title: "Real ranked job",
  is_active: true,
  approval_status: "approved",
  closing_date: null,
  ...extra,
});
const row = (id, rank = 1, count = 20, time = now) => ({
  job_id: id,
  rank,
  click_count: count,
  refreshed_at: new Date(time).toISOString(),
});
function fixture(rows, jobRows, opts = {}) {
  let calls = 0,
    jobCalls = 0,
    clock = now;
  const service = createHotJobsService(
    {
      async cache() {
        calls++;
        return { data: rows, error: opts.cacheError || null };
      },
      async jobs(ids) {
        jobCalls++;
        assert.ok(ids.length <= 20);
        return { data: jobRows, error: opts.jobsError || null };
      },
    },
    { ...rules, ...opts.rules },
    () => clock,
  );
  return {
    service,
    get calls() {
      return calls;
    },
    get jobCalls() {
      return jobCalls;
    },
    set clock(v) {
      clock = v;
    },
  };
}
test("disabled verification gate makes no popularity requests", async () => {
  const f = fixture([row("a")], [job("a")], { rules: { enabled: false } });
  await f.service.load();
  assert.equal(f.calls, 0);
  assert.deepEqual(f.service.getSnapshot().jobs, []);
});
test("keeps server rank order while dropping closed, unavailable and low-activity jobs", async () => {
  const f = fixture(
    [
      row("b", 2),
      row("a", 1),
      row("closed", 3),
      row("inactive", 4),
      row("pending", 5),
      row("low", 6, 9),
    ],
    [
      job("b"),
      job("a"),
      job("closed", { closing_date: "2026-11-12" }),
      job("inactive", { is_active: false }),
      job("pending", { approval_status: "pending" }),
      job("low"),
    ],
  );
  await f.service.load();
  assert.deepEqual(
    f.service.getSnapshot().jobs.map((j) => j.id),
    ["a", "b"],
  );
  assert.equal(f.calls, 1);
  assert.equal(f.jobCalls, 1);
});
test("SAST date boundary includes closing today and excludes yesterday", () => {
  const clock = Date.parse("2026-11-12T22:01:00Z");
  assert.equal(
    hotJobOpen(job("a", { closing_date: "2026-11-13" }), clock),
    true,
  );
  assert.equal(
    hotJobOpen(job("a", { closing_date: "2026-11-12" }), clock),
    false,
  );
  assert.equal(
    hotJobOpen(job("a", { approval_status: undefined }), clock),
    false,
  );
});
test("rejects stale/future cache rows, invalid ranks and malformed dates", async () => {
  const f = fixture(
    [
      row("stale", 1, 20, now - 900001),
      row("future", 2, 20, now + 120000),
      row("bad", 0),
      row("out", 21),
      { ...row("date", 3), refreshed_at: "invalid" },
    ],
    [job("stale"), job("future")],
  );
  await f.service.load();
  assert.equal(f.service.getSnapshot().jobs.length, 0);
  assert.equal(f.jobCalls, 0);
});
test("coalesces concurrent reads and reuses the five-minute public snapshot", async () => {
  let release,
    calls = 0;
  const service = createHotJobsService(
    {
      cache: () => {
        calls++;
        return new Promise((r) => (release = r));
      },
      jobs: async () => ({ data: [job("a")], error: null }),
    },
    rules,
    () => now,
  );
  const a = service.load(),
    b = service.load();
  release({ data: [row("a")], error: null });
  await Promise.all([a, b]);
  await service.load();
  assert.equal(calls, 1);
});
test("empty/error responses never invent jobs or application totals", async () => {
  const empty = fixture([], []);
  await empty.service.load();
  assert.deepEqual(empty.service.getSnapshot().jobs, []);
  assert.equal(empty.service.getSnapshot().error, null);
  const error = fixture(null, [], { cacheError: new Error("offline") });
  await error.service.load();
  assert.ok(error.service.getSnapshot().error);
  assert.equal(error.service.getSnapshot().loading, false);
  assert.deepEqual(error.service.getSnapshot().jobs, []);
});
test("cache expiry refilters jobs across midnight even if the backend fails", async () => {
  let clock = Date.parse("2026-11-13T21:59:59Z"),
    fail = false;
  const service = createHotJobsService(
    {
      cache: async () => ({
        data: [row("a", 1, 20, clock)],
        error: fail ? true : null,
      }),
      jobs: async () => ({
        data: [job("a", { closing_date: "2026-11-13" })],
        error: null,
      }),
    },
    rules,
    () => clock,
  );
  await service.load();
  assert.equal(service.getSnapshot().jobs.length, 1);
  clock += 2000;
  fail = true;
  await service.load();
  assert.equal(service.getSnapshot().jobs.length, 0);
  assert.ok(service.getSnapshot().error);
});
test("query columns omit heavy descriptions and include explicit approval", () => {
  assert.ok(HOT_JOB_COLUMNS.includes("approval_status"));
  assert.ok(!HOT_JOB_COLUMNS.split(",").includes("description"));
});
const { createApplyClickRecorder } = load("src/lib/hot-jobs/click-service.ts");
test("Apply tracking uses a stable device ID, owner payload and minimal columns", async () => {
  let stored = null,
    sent = [],
    clock = 100000;
  const recorder = createApplyClickRecorder(
    {
      readId: async () => stored,
      saveId: async (id) => {
        stored = id;
      },
      owner: async () => "owner",
      newId: () => "stable-device-identifier",
      insert: async (row) => sent.push(row),
    },
    () => clock,
  );
  await recorder("job-a");
  await recorder("job-a");
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]).sort(), [
    "anonymous_id",
    "job_id",
    "user_id",
  ]);
  clock += 60001;
  await recorder("job-a");
  await recorder("job-b");
  assert.equal(sent[2].anonymous_id, sent[0].anonymous_id);
});
test("signed-out tracking omits user_id and storage/network failures do not block Apply", async () => {
  let sent = [];
  const recorder = createApplyClickRecorder(
    {
      readId: async () => "stable-device-identifier",
      saveId: async () => {},
      owner: async () => null,
      newId: () => "unused",
      insert: async (row) => {
        sent.push(row);
        throw Error("uncertain");
      },
    },
    () => now,
  );
  await recorder("a");
  assert.ok(!("user_id" in sent[0]));
  await recorder("a");
  assert.equal(sent.length, 1);
  const broken = createApplyClickRecorder(
    {
      readId: async () => {
        throw Error("storage unavailable");
      },
      saveId: async () => {},
      owner: async () => null,
      newId: () => "unused",
      insert: async () => {
        throw Error("must not write");
      },
    },
    () => now,
  );
  await assert.doesNotReject(broken("a"));
});
const { brandWordmarkSize } = load("src/lib/brand-layout.ts");
const { radialLayout } = load("src/lib/radial-layout.ts");
test("brand stays large and fits its width budget at up to 3x system text", () => {
  for (const width of [248, 288, 358, 736])
    for (const scale of [1, 1.3, 2, 3]) {
      const size = brandWordmarkSize(width, scale);
      assert.ok(size * scale * 6.4 + 6 <= width + 0.01);
      assert.ok(size * scale >= 22);
    }
});
test("navigation uses whole single-line labels or a consistent accessible icon mode", () => {
  assert.equal(radialLayout(320, 1).iconOnly, false);
  assert.equal(radialLayout(320, 2).iconOnly, true);
  assert.equal(radialLayout(390, 3).iconOnly, true);
  for (const width of [240, 280, 320, 390, 768])
    for (const scale of [1, 1.3, 2, 3]) {
      const layout = radialLayout(width, scale);
      assert.ok(layout.iconOnly || 13 * 8 * scale + 16 <= layout.nodeWidth);
      assert.ok(layout.nodeHeight >= 48);
    }
});
test("review-only migration preserves contracts and models distinct-person ranking", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../supabase/migrations/20261113010000_deduplicate_hot_job_activity.sql",
    ),
    "utf8",
  );
  assert.match(
    sql,
    /count\(DISTINCT coalesce\(c.user_id::text, c.anonymous_id\)\)/,
  );
  assert.match(sql, /minimum_unique_activity CONSTANT integer := 10/);
  assert.match(sql, /Africa\/Johannesburg/);
  assert.match(sql, /LIMIT 20/);
  assert.doesNotMatch(
    sql,
    /\bDROP\b|cron\.|SELECT public\.refresh_hot_job_cache\(/i,
  );
  assert.match(sql, /FROM anon, authenticated/);
  const events = [
    { job: "a", user: "u", device: "d1" },
    { job: "a", user: "u", device: "d2" },
    { job: "a", user: "u", device: "d1" },
    { job: "a", user: null, device: "d1" },
  ];
  assert.equal(
    new Set(events.map((e) => e.job + ":" + (e.user || e.device))).size,
    2,
  ); /* model only; no SQL executed */
});
test("actual navigation renders complete labels or no visible label text at 3x scale", () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      "../src/components/navigation/circular-navigation.tsx",
    ),
    "utf8",
  );
  for (const scale of [1, 3]) {
    let stateCall = 0;
    const jsx = (type, props) => ({ type, props });
    const theme = load("src/constants/theme.ts", {
      "react-native": { Platform: { OS: "android" } },
    });
    const mocks = {
      react: {
        useEffect() {},
        useState(initial) {
          const index = stateCall++;
          return [
            index === 0
              ? true
              : typeof initial === "function"
                ? initial()
                : initial,
            () => {},
          ];
        },
      },
      "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
      "react-native": {
        Animated: {
          Value: class {
            interpolate() {
              return 0;
            }
          },
          View: "AnimatedView",
        },
        Dimensions: {},
        Keyboard: {},
        Modal: "Modal",
        Platform: { OS: "android" },
        ScrollView: "ScrollView",
        StyleSheet: { create: (v) => v, hairlineWidth: 1, absoluteFill: {} },
        View: "View",
        useWindowDimensions: () => ({ width: 320, fontScale: scale }),
      },
      "lucide-react-native": new Proxy({}, { get: (_, name) => String(name) }),
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 24, bottom: 24 }),
      },
      "../ui/primitives": { AppText: "Text", AppPressable: "Pressable" },
      "../../constants/theme": theme,
      "../../hooks/use-reduced-motion": { useReducedMotion: () => true },
      "../../lib/radial-layout": { radialLayout },
      "expo-router": { Tabs: "Tabs" },
    };
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const mod = { exports: {} };
    new Function("module", "exports", "require", js)(mod, mod.exports, (n) => {
      assert.ok(n in mocks, n);
      return mocks[n];
    });
    const tree = mod.exports.CircularNavigation({
      state: {
        index: 0,
        routes: [
          "index",
          "jobs",
          "saved",
          "applications",
          "tools",
          "community",
          "profile",
        ].map((name) => ({ name, key: name })),
      },
      navigation: {},
    });
    const labels = [],
      visible = [];
    let selectedChecks = 0;
    function walk(node) {
      if (typeof node === "string") {
        visible.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (!node?.props) return;
      if (node.type === "Check") selectedChecks++;
      if (node.props.accessibilityLabel)
        labels.push(node.props.accessibilityLabel);
      walk(node.props.children);
    }
    walk(tree);
    for (const label of [
      "Home",
      "Applications",
      "Career tools",
      "Community",
      "Profile",
    ])
      assert.ok(labels.includes(label));
    assert.equal(
      selectedChecks,
      2,
      "Home has a shape indicator in dock and expanded menu",
    );
    if (scale === 3) assert.deepEqual(visible, []);
    else
      for (const label of [
        "Home",
        "Menu",
        "Applications",
        "Career tools",
        "Community",
      ])
        assert.ok(visible.includes(label));
  }
});

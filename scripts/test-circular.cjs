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
    throw Error("Unexpected dependency " + n);
  });
  return mod.exports;
}
const { createCircularTransport, CircularError } = load(
  "src/lib/circular/transport.ts",
);
const { createOwnerCache, createApplications } = load(
  "src/lib/circular/state.ts",
);
const contract = load("src/lib/circular/contract.ts");
const { notificationDestination } = load("src/lib/circular/links.ts", {
  "../community/links": load("src/lib/community/links.ts"),
});
const session = (id = "alice", access_token = "fixture-token") => ({
  user: { id },
  access_token,
});
const ok = (value) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const fail = (status, error) =>
  new Response(JSON.stringify({ error }), { status });
function fixture(responses) {
  let current = session(),
    calls = [],
    refreshes = 0,
    time = 100000;
  const auth = {
    getSession: async () => ({ data: { session: current } }),
    refreshSession: async () => {
      refreshes++;
      current = session("alice", "refreshed-token");
      return { data: { session: current } };
    },
  };
  const client = createCircularTransport(
    auth,
    async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return typeof response === "function" ? response() : response;
    },
    () => time,
  );
  return {
    client,
    calls,
    auth,
    set current(v) {
      current = v;
    },
    get refreshes() {
      return refreshes;
    },
    advance(ms) {
      time += ms;
    },
  };
}
test("circular reads use apex API, both token headers and reject redirects", async () => {
  const f = fixture([ok({ items: [] })]);
  await f.client.request("alice", "/circular-jobs?page=1&page_size=20");
  assert.equal(
    f.calls[0].url,
    "https://firstjobly.co.za/api/app/circular-jobs?page=1&page_size=20",
  );
  assert.equal(
    f.calls[0].options.headers.Authorization,
    "Bearer fixture-token",
  );
  assert.equal(f.calls[0].options.headers["x-fj-token"], "fixture-token");
  assert.equal(f.calls[0].options.redirect, "error");
  assert.ok(!f.calls[0].url.includes("token"));
});
test("401 refreshes once and retries with both fresh headers", async () => {
  const f = fixture([
    fail(401, "Please sign in again."),
    ok({ enabled: true }),
  ]);
  assert.deepEqual(await f.client.request("alice", "/circular-alerts"), {
    enabled: true,
  });
  assert.equal(f.refreshes, 1);
  assert.equal(f.calls[1].options.headers["x-fj-token"], "refreshed-token");
});
test("second 401 returns sign-in error without refresh loops", async () => {
  const f = fixture([
    fail(401, "Please sign in again."),
    fail(401, "Please sign in again."),
  ]);
  await assert.rejects(
    f.client.request("alice", "/circular-alerts"),
    (e) => e.status === 401,
  );
  assert.equal(f.refreshes, 1);
  assert.equal(f.calls.length, 2);
});
test("refresh failure and missing session never send a publishable key", async () => {
  const f = fixture([]);
  f.current = null;
  await assert.rejects(
    f.client.request("alice", "/circular-jobs"),
    (e) => e.status === 401,
  );
  assert.equal(f.calls.length, 0);
});
test("account mismatch before request never sends another account token", async () => {
  const f = fixture([]);
  f.current = session("bob");
  await assert.rejects(
    f.client.request("alice", "/circular-jobs"),
    (e) => e.status === 401,
  );
  assert.equal(f.calls.length, 0);
});
test("account switch during request discards response", async () => {
  const f = fixture([
    () => {
      f.current = session("bob");
      return ok({ items: [{ id: "private" }] });
    },
  ]);
  await assert.rejects(
    f.client.request("alice", "/circular-jobs"),
    (e) => e.status === 401,
  );
});
test("429 blocks more requests for exactly 60 seconds", async () => {
  const f = fixture([fail(429, "Please slow down."), ok({ enabled: true })]);
  await assert.rejects(
    f.client.request("alice", "/circular-alerts"),
    (e) => e.status === 429 && e.retryAt === 160000,
  );
  f.advance(59999);
  await assert.rejects(
    f.client.request("alice", "/circular-alerts"),
    (e) => e.status === 429,
  );
  assert.equal(f.calls.length, 1);
  f.advance(1);
  await f.client.request("alice", "/circular-alerts");
  assert.equal(f.calls.length, 2);
});
test("rate limits are scoped to owner", async () => {
  const f = fixture([fail(429, "Wait"), ok({ items: [] })]);
  await assert.rejects(f.client.request("alice", "/circular-jobs"));
  f.current = session("bob");
  await f.client.request("bob", "/circular-jobs");
  assert.equal(f.calls.length, 2);
});
test("network errors do not replay writes with unknown result", async () => {
  const f = fixture([Error("offline")]);
  await assert.rejects(
    f.client.request("alice", "/circular-jobs/job/apply-intent", "POST", {
      stage: "started",
      method: "email",
    }),
    /Could not connect/,
  );
  assert.equal(f.calls.length, 1);
});
test("stage sent requires an explicit separate request; opening or starting is not sending", async () => {
  const f = fixture([ok({ ok: true })]);
  await f.client.request("alice", "/circular-jobs/job/apply-intent", "POST", {
    stage: "started",
    method: "online",
  });
  assert.deepEqual(JSON.parse(f.calls[0].options.body), {
    stage: "started",
    method: "online",
  });
  assert.ok(!f.calls.some((c) => JSON.parse(c.options.body).stage === "sent"));
});
test("404 keeps friendly server error and is not retried", async () => {
  const f = fixture([fail(404, "This job was withdrawn")]);
  await assert.rejects(
    f.client.request("alice", "/circular-jobs/gone"),
    (e) =>
      e instanceof CircularError &&
      e.status === 404 &&
      e.message === "This job was withdrawn",
  );
  assert.equal(f.calls.length, 1);
});
test("transport rejects arbitrary URLs and uncontracted resources", async () => {
  const f = fixture([]);
  for (const value of [
    "https://evil.test/circular-jobs",
    "/circular_jobs",
    "/circular-jobs/x/../../auth",
    "/jobs",
  ])
    await assert.rejects(f.client.request("alice", value));
  assert.equal(f.calls.length, 0);
});
test("cache expires at five minutes and never crosses accounts", () => {
  let now = 0;
  const cache = createOwnerCache(() => now);
  cache.set("alice", "list", { saved: true });
  assert.deepEqual(cache.get("alice", "list"), { saved: true });
  assert.equal(cache.get("bob", "list"), undefined);
  now = 299999;
  assert.ok(cache.get("alice", "list"));
  now++;
  assert.equal(cache.get("alice", "list"), undefined);
  cache.set("alice", "list", 1);
  cache.clear();
  assert.equal(cache.get("alice", "list"), undefined);
});
test("application files are owner scoped, replaced safely and cleaned on finish/sign-out", () => {
  const deleted = [];
  const store = createApplications((uri) => deleted.push(uri));
  const key = store.create("alice", { job: { id: "job" } }, "email");
  assert.equal(store.get("bob", key), undefined);
  store.setFile("alice", key, "z83", "cache:z83");
  store.setFile("alice", key, "cv", "cache:cv1");
  store.setFile("alice", key, "cv", "cache:cv2");
  assert.deepEqual(deleted, ["cache:cv1"]);
  store.clear();
  assert.equal(store.get("alice", key), undefined);
  assert.deepEqual(deleted, ["cache:cv1", "cache:z83", "cache:cv2"]);
  assert.equal(store.setFile("alice", key, "z83", "cache:late"), false);
  assert.equal(deleted.at(-1), "cache:late");
});
test("prefill accepts audited fields and strips Section B/signature and arbitrary data", () => {
  const input = {
    position: "Clerk",
    department: "Health",
    reference: "ABC",
    surnameAndNames: "Fixture",
    dateOfBirth: "2000-01-01",
    jobs: [],
    idNumber: "sensitive",
    race: "african",
    signature: "sensitive",
    criminalDetail: "private",
    unknown: "x",
  };
  const safe = contract.safePrefill(input);
  assert.equal(safe.position, "Clerk");
  assert.equal(safe.dateOfBirth, "2000-01-01");
  for (const field of [
    "idNumber",
    "race",
    "signature",
    "criminalDetail",
    "unknown",
  ])
    assert.ok(!(field in safe));
});
test("South African dates and salary wording use supplied data", () => {
  assert.equal(contract.saDate("2026-11-29T23:00:00Z"), "30 Nov");
  assert.equal(contract.saDate("2026-11-30"), "30 Nov");
  assert.equal(contract.salary("R487 197 per annum"), "R487 197 per year");
  assert.equal(contract.salary("R487,197 per annum"), "R487 197 per year");
  assert.equal(contract.saDate(null), "Date not provided");
});
test("entry-level guard rejects senior titles and experience above three years", () => {
  assert.ok(
    contract.entryLevel({
      post_title: "ADMINISTRATION CLERK",
      min_experience_years: 0,
    }),
  );
  assert.ok(
    contract.entryLevel({
      post_title: "Graduate trainee",
      min_experience_years: 3,
    }),
  );
  for (const post_title of [
    "Senior clerk",
    "Assistant director",
    "Chief officer",
    "Deputy manager",
  ])
    assert.equal(contract.entryLevel({ post_title }), false);
  assert.equal(
    contract.entryLevel({ post_title: "Clerk", min_experience_years: 4 }),
    false,
  );
});
test("only safe external HTTPS URLs can be opened", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///private",
    "http://example.test",
    "https://user:pass@example.test",
  ])
    assert.equal(contract.externalURL(url), null);
  assert.equal(
    contract.externalURL("https://www.dpsa.gov.za/file.pdf"),
    "https://www.dpsa.gov.za/file.pdf",
  );
});
test("notification routing supports Gov jobs and preserves Community/legacy-safe links", () => {
  assert.equal(
    notificationDestination({ kind: "new_circular", batchId: "batch-41" }),
    "/circular-jobs?batch=batch-41",
  );
  assert.equal(
    notificationDestination({ kind: "circular_closing", jobId: "job-1" }),
    "/circular-jobs/job-1",
  );
  assert.equal(
    notificationDestination({ link: "/community/post-1" }),
    "/community/post-1",
  );
  assert.equal(
    notificationDestination({ link: "https://evil.test/community/post" }),
    null,
  );
  assert.equal(
    notificationDestination({ kind: "circular_closing", jobId: "../auth" }),
    null,
  );
  assert.equal(
    notificationDestination({ kind: "unrelated", link: "/jobs" }),
    null,
  );
});
test("download filename preserves server name and rejects path traversal", () => {
  const b = { circular_number: 41, circular_year: 2026 };
  assert.equal(
    contract.pdfFilename(b, 'attachment; filename="Circular 41.pdf"'),
    "Circular 41.pdf",
  );
  assert.equal(
    contract.pdfFilename(b, "attachment; filename*=UTF-8''Circular%2041.pdf"),
    "Circular 41.pdf",
  );
  assert.equal(
    contract.pdfFilename(b, 'attachment; filename="../../secret.pdf"'),
    "public-service-vacancy-circular-41-of-2026.pdf",
  );
});
test("cleared search/filter values are omitted; no unsupported job_type query is sent", () => {
  const url = new URL(
    "https://fixture.test" +
      contract.listPath({
        sort: "closing",
        search: undefined,
        province: undefined,
        qualification: "",
        job_type: "internship",
      }),
  );
  assert.equal(url.searchParams.get("search"), null);
  assert.equal(url.searchParams.get("province"), null);
  assert.equal(url.searchParams.get("qualification"), null);
  assert.equal(url.searchParams.get("job_type"), null);
  assert.equal(url.searchParams.get("sort"), "closing");
  assert.equal(url.searchParams.get("page_size"), "20");
  assert.equal(
    new URL(
      "https://fixture.test" + contract.listPath({ search: "clerk" }, 2),
    ).searchParams.get("page"),
    "2",
  );
});
function screenAction(name, deps) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/app/circular-jobs/apply.tsx"),
    "utf8",
  );
  const tree = ts.createSourceFile(
    "apply.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name)
      found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found);
  const js = ts.transpileModule(found.getText(tree), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return new Function(...Object.keys(deps), js + ";return " + name)(
    ...Object.values(deps),
  );
}
function applyPorts(method = "email") {
  const events = [];
  return {
    events,
    deps: {
      session: {
        key: "opaque-key",
        owner: "alice",
        method,
        z83: "cache:z83",
        cv: "cache:cv",
        detail: {
          job: { id: "job" },
          apply: {
            emails: ["recruitment@example.test"],
            email_subject: "REF — Clerk",
            urls: ["https://employer.example.test/apply"],
          },
        },
      },
      locked: { current: false },
      handoff: { current: false },
      setBusy: (v) => events.push(["busy", v]),
      setError: (e) => {
        if (e) events.push(["error", e.message]);
      },
      setConfirm: (v) => events.push(["confirm", v]),
      setSent: (v) => events.push(["sent", v]),
      query: { userId: "alice" },
      compose: async (...args) => events.push(["compose", ...args]),
      openURL: async (url) => events.push(["open", url]),
      circularAPI: {
        request: async (...args) => events.push(["request", ...args]),
      },
      applications: { remove: (key) => events.push(["remove", key]) },
      circularChanged: () => events.push(["invalidate"]),
    },
  };
}
test("actual email handoff attaches both PDFs and asks for confirmation, never records sent automatically", async () => {
  const f = applyPorts();
  await screenAction("perform", f.deps)();
  assert.deepEqual(
    f.events.find((e) => e[0] === "compose"),
    [
      "compose",
      "recruitment@example.test",
      "REF — Clerk",
      "cache:z83",
      "cache:cv",
    ],
  );
  assert.deepEqual(
    f.events.find((e) => e[0] === "confirm"),
    ["confirm", true],
  );
  assert.ok(!f.events.some((e) => e[0] === "request" || e[0] === "sent"));
});
test("actual online handoff cannot automatically mark an application sent", async () => {
  const f = applyPorts("online");
  await screenAction("perform", f.deps)();
  assert.deepEqual(
    f.events.find((e) => e[0] === "open"),
    ["open", "https://employer.example.test/apply"],
  );
  assert.ok(!f.events.some((e) => e[0] === "request" || e[0] === "sent"));
});
test("actual explicit send confirmation records sent and cleans temporary documents", async () => {
  const f = applyPorts();
  await screenAction("markSent", f.deps)();
  assert.deepEqual(
    f.events.find((e) => e[0] === "request"),
    [
      "request",
      "alice",
      "/circular-jobs/job/apply-intent",
      "POST",
      { stage: "sent", method: "email" },
    ],
  );
  assert.deepEqual(
    f.events.find((e) => e[0] === "remove"),
    ["remove", "opaque-key"],
  );
  assert.deepEqual(
    f.events.find((e) => e[0] === "sent"),
    ["sent", true],
  );
  assert.equal(f.deps.locked.current, false);
});
test("failed send confirmation keeps documents and never shows Applied", async () => {
  const f = applyPorts();
  f.deps.circularAPI.request = async () => {
    throw Error("Offline");
  };
  await screenAction("markSent", f.deps)();
  assert.ok(f.events.some((e) => e[0] === "error"));
  assert.ok(!f.events.some((e) => e[0] === "sent" || e[0] === "remove"));
  assert.equal(f.deps.locked.current, false);
});
test("missing CV cannot silently open an incomplete email", async () => {
  const f = applyPorts();
  f.deps.session.cv = null;
  await screenAction("perform", f.deps)();
  assert.ok(f.events.some((e) => e[0] === "error"));
  assert.ok(!f.events.some((e) => e[0] === "compose" || e[0] === "confirm"));
});
test("application snapshots change identity and notify subscribers when files become ready", () => {
  const store = createApplications(() => {});
  const key = store.create("alice", { job: { id: "job" } }, "email");
  const before = store.get("alice", key);
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  store.setFile("alice", key, "z83", "cache:z83");
  const after = store.get("alice", key);
  assert.notEqual(after, before);
  assert.equal(before.z83, null);
  assert.equal(after.z83, "cache:z83");
  assert.equal(changes, 1);
  unsubscribe();
  store.remove(key);
  assert.equal(changes, 1);
});
function nativeIO({ viewerFails = false, downloadStatus = 200 } = {}) {
  const events = [];
  const io = load("src/lib/circular/io.ts", {
    "react-native": { Platform: { OS: "android" }, Linking: {} },
    "expo-file-system/legacy": {
      cacheDirectory: "file:///cache/",
      downloadAsync: async (url, target) => {
        events.push(["download", url, target]);
        return {
          uri: target,
          status: downloadStatus,
          headers: {
            "content-disposition": 'attachment; filename="Circular 41.pdf"',
          },
        };
      },
      deleteAsync: async (uri) => events.push(["delete", uri]),
    },
    "expo-intent-launcher": {
      startActivityAsync: async (...args) => {
        events.push(["viewer", ...args]);
        if (viewerFails) throw Error("No viewer");
      },
    },
    "expo-mail-composer": {},
    "expo-document-picker": {},
    "expo-clipboard": {},
    "expo-sharing": {},
    "../save-pdf": {
      savePdfToDownloads: async (uri, name) => {
        events.push(["save", uri, name]);
        return "content://downloads/circular-41";
      },
    },
    "./contract": contract,
  });
  return { io, events };
}
test("native PDF download preserves server filename, saves through SAF and opens PDF viewer with URI permission", async () => {
  const f = nativeIO();
  await f.io.downloadBatch({
    circular_number: 41,
    circular_year: 2026,
    pdf_download_url: "https://fixture.example.test/fresh-signed.pdf",
  });
  assert.equal(f.events.find((e) => e[0] === "save")[2], "Circular 41.pdf");
  assert.deepEqual(
    f.events.find((e) => e[0] === "viewer"),
    [
      "viewer",
      "android.intent.action.VIEW",
      {
        data: "content://downloads/circular-41",
        flags: 1,
        type: "application/pdf",
      },
    ],
  );
  assert.ok(f.events.some((e) => e[0] === "delete"));
});
test("missing PDF viewer keeps saved file and returns a recoverable Downloads instruction", async () => {
  const f = nativeIO({ viewerFails: true });
  await assert.rejects(
    f.io.downloadBatch({
      circular_number: 41,
      circular_year: 2026,
      pdf_download_url: "https://fixture.example.test/fresh.pdf",
    }),
    /PDF saved/,
  );
  assert.ok(f.events.some((e) => e[0] === "save"));
  assert.ok(f.events.some((e) => e[0] === "delete"));
});
test("failed circular download cannot save or open an error response as a PDF", async () => {
  const f = nativeIO({ downloadStatus: 403 });
  await assert.rejects(
    f.io.downloadBatch({
      circular_number: 41,
      circular_year: 2026,
      pdf_download_url: "https://fixture.example.test/expired.pdf",
    }),
    /Could not download/,
  );
  assert.ok(!f.events.some((e) => e[0] === "save" || e[0] === "viewer"));
  assert.ok(f.events.some((e) => e[0] === "delete"));
});

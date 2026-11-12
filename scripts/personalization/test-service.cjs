const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { load } = require("./load.cjs"),
  { backend } = require("./backend.cjs"),
  { uid, job, now } = require("./fixtures.cjs");
const { createRecommendationService } = load(
  "src/lib/recommendations/service.ts",
);
const setup = () => {
  const b = backend();
  let time = now;
  return {
    b,
    s: createRecommendationService(b.client, b.storage, () => time),
    advance(ms) {
      time += ms;
    },
  };
};
test("real query client reads existing contracts; profile differences change feed order", async () => {
  const { b, s } = setup();
  const a = await s.feed();
  assert.equal(a.items[0].job.category, "internship");
  assert.equal(a.candidateLimit, 300);
  b.setOwner(uid.bob);
  const c = await s.feed();
  assert.equal(c.items[0].job.category, "government");
  assert.ok(b.calls.every((c) => c.url.pathname.startsWith("/rest/v1/")));
  assert.ok(
    b.calls
      .filter((c) => c.table === "profiles")
      .every((c) => c.url.searchParams.get("id") === `eq.${c.owner}`),
  );
});
test("anonymous feed uses only approved open jobs and never reads private tables", async () => {
  const { b, s } = setup();
  b.setOwner(null);
  b.tables.jobs.push(
    job(90, { is_active: false }),
    job(91, { approval_status: "pending" }),
    job(92, { closing_date: "2020-01-01" }),
  );
  const page = await s.feed();
  assert.equal(page.personalized, false);
  assert.equal(page.label, "Latest opportunities");
  assert.ok(b.calls.every((c) => c.table === "jobs"));
  assert.ok(
    page.items.every(
      (r) => r.job.is_active && r.job.approval_status === "approved",
    ),
  );
  await assert.rejects(s.getPreferences(), /SIGN_IN_REQUIRED/);
});
test("confirmed applications are excluded even outside recent history; drafts remain", async () => {
  const { b, s } = setup();
  b.tables.applications = Array.from({ length: 300 }, (_, i) => ({
    user_id: uid.alice,
    job_id: job(i + 200).id,
    status: "submitted",
    is_draft: false,
    applied_at: "2026-11-12",
  }));
  b.tables.applications.push(
    {
      user_id: uid.alice,
      job_id: job(1).id,
      status: "submitted",
      is_draft: false,
      applied_at: "2020-01-01",
    },
    {
      user_id: uid.alice,
      job_id: job(3).id,
      status: "submitted",
      is_draft: true,
      applied_at: "2026-11-12",
    },
  );
  const page = await s.feed();
  assert.ok(!page.items.some((r) => r.job.id === job(1).id));
  assert.ok(page.items.some((r) => r.job.id === job(3).id));
});
test("bounded snapshots cache for three minutes and cursors are user/filter/revision isolated", async () => {
  const { b, s, advance } = setup();
  const first = await s.feed();
  assert.ok(first.nextCursor);
  const count = b.calls.length;
  assert.deepEqual(await s.feed(), first);
  assert.equal(b.calls.length, count);
  const next = await s.feed({}, first.nextCursor);
  assert.equal(
    new Set([...first.items, ...next.items].map((r) => r.job.id)).size,
    40,
  );
  b.setOwner(uid.bob);
  await assert.rejects(s.feed({}, first.nextCursor), /REFRESH_REQUIRED/);
  b.setOwner(uid.alice);
  await assert.rejects(
    s.feed({ category: "government" }, first.nextCursor),
    /REFRESH_REQUIRED/,
  );
  advance(180001);
  await assert.rejects(s.feed({}, first.nextCursor), /REFRESH_REQUIRED/);
  await s.feed();
  assert.ok(b.calls.length > count);
});
test("dismiss, undo and more-like feedback persist locally across service instances without remote writes", async () => {
  const { b, s } = setup();
  const original = await s.feed(),
    id = original.items[0].job.id;
  await s.feedback(id, "dismissed", "location");
  let page = await s.feed();
  assert.ok(!page.items.some((r) => r.job.id === id));
  const again = createRecommendationService(b.client, b.storage, () => now);
  assert.ok(!(await again.feed()).items.some((r) => r.job.id === id));
  await again.feedback(id, "undo");
  assert.ok((await again.feed()).items.some((r) => r.job.id === id));
  await again.feedback(id, "more_like_this");
  assert.ok(
    (await again.feed()).items.some((r) =>
      r.ranking.contributions.some((c) => c.code === "more_like"),
    ),
  );
  assert.ok(b.calls.every((c) => c.method === "GET"));
  b.setOwner(uid.bob);
  assert.ok(
    (await again.feed()).items.some((r) => r.job.category === "government"),
  );
});
test("profile preferences sync through owner RLS; extra controls stay on device and maintenance is visible", async () => {
  const { b, s } = setup();
  const { preferences } = await s.getPreferences();
  await s.savePreferences({
    ...preferences,
    categories: ["government"],
    remoteOnly: true,
  });
  assert.deepEqual(b.tables.profiles[0].preferred_categories, ["government"]);
  assert.equal(b.tables.profiles[0].remoteOnly, undefined);
  assert.equal((await s.getPreferences()).preferences.remoteOnly, true);
  const write = b.calls.find((c) => c.method === "PATCH");
  assert.equal(write.url.searchParams.get("id"), `eq.${uid.alice}`);
  b.setMaintenance(true);
  await assert.rejects(s.savePreferences(preferences), (e) =>
    e.message.includes("read-only maintenance"),
  );
});
test("learning deduplicates opens, opt-out stops recording, reset retains explicit state and suppresses old saves", async () => {
  const { b, s } = setup();
  b.tables.saved_jobs = [
    { user_id: uid.alice, job_id: job(1).id, created_at: "2026-11-01" },
  ];
  await Promise.all([
    s.activity(job(1).id, "opened"),
    s.activity(job(1).id, "opened"),
  ]);
  let local = JSON.parse([...b.stored.values()][0]);
  assert.equal(local.events.length, 1);
  await s.feedback(job(2).id, "dismissed");
  await s.feedback(job(3).id, "more_like_this");
  await s.resetLearning();
  local = JSON.parse([...b.stored.values()][0]);
  assert.equal(local.events.length, 0);
  assert.equal(local.feedback.length, 1);
  assert.equal(local.feedback[0].kind, "dismissed");
  assert.equal(b.tables.saved_jobs.length, 1);
  const page = await s.feed();
  assert.ok(
    page.items.every((r) =>
      r.ranking.contributions.every(
        (c) => !["saved", "more_like"].includes(c.code),
      ),
    ),
  );
  const { preferences } = await s.getPreferences();
  await s.savePreferences({ ...preferences, learningEnabled: false });
  await s.activity(job(1).id, "opened");
  local = JSON.parse([...b.stored.values()][0]);
  assert.equal(local.events.length, 0);
  s.invalidate();
  b.calls.length = 0;
  await s.feed();
  assert.ok(
    !b.calls.some((c) => ["saved_jobs", "job_views"].includes(c.table)),
  );
});
test("account change during network loading rejects instead of returning another account feed", async () => {
  const { b, s } = setup();
  let release;
  b.delayJobs(new Promise((r) => (release = r)));
  const pending = s.feed();
  await new Promise((r) => setImmediate(r));
  b.setOwner(uid.bob);
  release();
  await assert.rejects(pending, /ACCOUNT_CHANGED/);
});
test("safe latest fallback retains dismissals and confirmed-application exclusions", async () => {
  const { b, s } = setup();
  await s.feedback(job(1).id, "dismissed");
  b.tables.applications = [
    {
      user_id: uid.alice,
      job_id: job(2).id,
      status: "submitted",
      is_draft: false,
      applied_at: "2026-11-12",
    },
  ];
  const page = await s.feed({}, null, true);
  assert.equal(page.label, "Latest opportunities");
  assert.ok(
    page.items.every((r) => ![job(1).id, job(2).id].includes(r.job.id)),
  );
});
test("new user without a profile/history still gets honest latest jobs in date order", async () => {
  const { b, s } = setup();
  b.tables.profiles = [];
  b.tables.jobs = [
    job(1, { posted_at: "2026-11-09", company_name: "", province: "" }),
    job(2, { posted_at: "2026-11-10", company_name: "", province: "" }),
    job(3, { posted_at: "2026-11-08" }),
  ];
  const page = await s.feed();
  assert.equal(page.personalized, false);
  assert.equal(page.label, "Latest opportunities");
  assert.deepEqual(
    page.items.map((r) => r.job.id),
    [job(2).id, job(1).id, job(3).id],
  );
});

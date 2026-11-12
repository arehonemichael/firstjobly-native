const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { load } = require("./load.cjs");
const { job, signals, now } = require("./fixtures.cjs");
const { rankJobs, assessRequirements, latestSafeJobs } = load(
  "src/lib/recommendations/engine.ts",
);
const { RULES } = load("src/lib/recommendations/config.ts");
function withPrefs(p) {
  const s = signals();
  s.preferences = { ...s.preferences, ...p };
  return s;
}
test("different actual preferences yield different ordering and evidence", () => {
  const jobs = [
    job(1, { category: "government" }),
    job(2, { category: "internship" }),
  ];
  const a = rankJobs(jobs, withPrefs({ categories: ["government"] }), now),
    b = rankJobs(jobs, withPrefs({ categories: ["internship"] }), now);
  assert.equal(a[0].job.id, jobs[0].id);
  assert.equal(b[0].job.id, jobs[1].id);
  assert.deepEqual(a[0].ranking.reasons[0], {
    code: "interest",
    value: "government",
  });
});
test("explicit interests outweigh even saturated weak behaviour", () => {
  const jobs = [job(1, { category: "government" }), job(2)];
  const s = withPrefs({ categories: ["government"], provinces: ["Gauteng"] });
  s.activity = Array.from({ length: 1000 }, () => ({
    job: jobs[1],
    kind: "opened",
    occurredAt: new Date(now).toISOString(),
  }));
  s.feedback = Array.from({ length: 1000 }, () => ({
    job: jobs[1],
    kind: "more_like_this",
    occurredAt: new Date(now).toISOString(),
  }));
  const rows = rankJobs(jobs, s, now);
  assert.equal(rows[0].job.id, jobs[0].id);
  const behavioural = rows[1].ranking.contributions
    .filter((c) =>
      ["views", "saved", "applications", "more_like"].includes(c.code),
    )
    .reduce((n, c) => n + c.points, 0);
  assert.ok(behavioural <= RULES.behaviour.cap);
});
test("missing education/experience remain unknown, not ineligible", () => {
  const j = job(1, {
    education_level: "Degree",
    requirements: [
      "Mandatory qualification: Degree",
      "Minimum experience: 2 years",
    ],
  });
  const assessment = assessRequirements(j, signals(), now);
  assert.equal(assessment.excluded, false);
  assert.ok(assessment.evidence.every((e) => e.state === "unknown"));
  assert.equal(rankJobs([j], signals(), now).length, 1);
});
test("a preferred education mismatch does not hide jobs; explicit mandatory mismatch does", () => {
  const s = signals({ profile: { highest_qualification: "Matric" } }),
    j = job(1, { education_level: "Degree" });
  assert.equal(rankJobs([j], s, now).length, 1);
  assert.equal(assessRequirements(j, s, now).evidence[0].mandatory, false);
  assert.equal(
    rankJobs(
      [{ ...j, requirements: ["Mandatory qualification: Degree"] }],
      s,
      now,
    ).length,
    0,
  );
  assert.equal(
    rankJobs([{ ...j, requirements: ["Degree preferred"] }], s, now).length,
    1,
  );
});
test("overlapping work intervals are not counted twice; incomplete dates are unknown", () => {
  const j = job(1, { requirements: ["Minimum experience: 2 years"] });
  const row = {
    start_date: "2025-11-12",
    end_date: "2026-11-12",
    currently_working: false,
  };
  assert.equal(
    assessRequirements(j, signals({ experience: [row, row] }), now).excluded,
    true,
  );
  assert.equal(
    assessRequirements(
      j,
      signals({ experience: [{ ...row, end_date: null }] }),
      now,
    ).excluded,
    false,
  );
});
test("closed, removed, unapproved, dismissed and confirmed-applied opportunities are excluded", () => {
  const jobs = [
    job(1, { closing_date: "2020-01-01" }),
    job(2, { is_active: false }),
    job(3, { approval_status: "pending" }),
    job(4),
    job(5),
    job(6),
  ];
  const s = signals({
    dismissedIds: new Set([jobs[3].id]),
    submittedIds: new Set([jobs[4].id]),
  });
  assert.deepEqual(
    rankJobs(jobs, s, now).map((r) => r.job.id),
    [jobs[5].id],
  );
});
test("Johannesburg closing day stays open until local midnight", () => {
  const j = job(1, { closing_date: "2026-11-12" });
  assert.equal(
    rankJobs([j], signals(), Date.parse("2026-11-12T21:59:00Z")).length,
    1,
  );
  assert.equal(
    rankJobs([j], signals(), Date.parse("2026-11-12T22:00:00Z")).length,
    0,
  );
});
test("duplicate imported roles collapse deterministically", () => {
  const a = job(1),
    b = job(2, {
      title: a.title,
      company_name: a.company_name,
      posted_at: "2026-11-11",
    });
  assert.deepEqual(
    rankJobs([a, b], signals(), now).map((r) => r.job.id),
    [b.id],
  );
});
test("discovery is a relevant minority and never crosses explicit or mandatory exclusions", () => {
  const jobs = Array.from({ length: 60 }, (_, i) =>
    job(i + 1, {
      category: i < 40 ? "internship" : "government",
      company_name: `Employer ${i % 10}`,
    }),
  );
  const s = withPrefs({ categories: ["internship"], provinces: ["Gauteng"] });
  const first = rankJobs(jobs, s, now).slice(0, 20);
  assert.equal(first.filter((r) => r.ranking.discovery).length, 4);
  for (const name of new Set(first.map((r) => r.job.company_name)))
    assert.ok(first.filter((r) => r.job.company_name === name).length <= 6);
  s.preferences.excludedCategories = ["government"];
  assert.ok(
    rankJobs(jobs, s, now).every((r) => r.job.category !== "government"),
  );
});
test("deterministic order can be sliced into stable pages without repeated IDs", () => {
  const jobs = Array.from({ length: 90 }, (_, i) => job(i + 1));
  const first = rankJobs(jobs, signals(), now),
    again = rankJobs([...jobs].reverse(), signals(), now);
  assert.deepEqual(
    first.map((r) => r.job.id),
    again.map((r) => r.job.id),
  );
  const pages = [
    first.slice(0, 20),
    first.slice(20, 40),
    first.slice(40, 60),
  ].flat();
  assert.equal(new Set(pages.map((r) => r.job.id)).size, 60);
});
test("old activity decays and resets prevent immediate relearning from preserved saves", () => {
  const j = job(1);
  const s = signals({ saved: [{ job: j, occurredAt: "2026-07-01" }] });
  assert.ok(
    rankJobs([j], s, now)[0].ranking.contributions.every(
      (c) => c.code !== "saved",
    ),
  );
  s.saved = [{ job: j, occurredAt: null }];
  s.preferences.learnedResetAt = "2026-11-12";
  assert.ok(
    rankJobs([j], s, now)[0].ranking.contributions.every(
      (c) => c.code !== "saved",
    ),
  );
});
test("names, photos, home addresses, age and protected fields do not affect ordering", () => {
  const jobs = [job(1), job(2)];
  const a = signals({
      profile: {
        first_name: "A",
        date_of_birth: "1980-01-01",
        address: "One street",
        photo: "a",
      },
    }),
    b = signals({
      profile: {
        first_name: "B",
        date_of_birth: "2005-01-01",
        address: "Another street",
        photo: "b",
      },
    });
  assert.deepEqual(rankJobs(jobs, a, now), rankJobs(jobs, b, now));
});
test("unsaving is not a negative category signal, and disabled learning has no activity points", () => {
  const j = job(1),
    s = signals({
      activity: [
        { job: j, kind: "unsaved", occurredAt: new Date(now).toISOString() },
      ],
    });
  assert.deepEqual(rankJobs([j], s, now), rankJobs([j], signals(), now));
  s.preferences.learningEnabled = false;
  s.saved = [{ job: j, occurredAt: new Date(now).toISOString() }];
  assert.ok(
    rankJobs([j], s, now)[0].ranking.contributions.every(
      (c) => c.code !== "saved",
    ),
  );
});
test("safe latest fallback still respects dismissals and mandatory exclusions", () => {
  const jobs = [
    job(1),
    job(2, { requirements: ["Mandatory qualification: Degree"] }),
  ];
  const s = signals({
    profile: { highest_qualification: "Matric" },
    dismissedIds: new Set([jobs[0].id]),
  });
  assert.equal(latestSafeJobs(jobs, s, now).length, 0);
});
test("live preferred_categories and legacy plural job types are reused", () => {
  const jobs = [
    job(1, { category: "government" }),
    job(2, {
      category: "internship",
      job_type: "Fixed-term internship (12 months)",
    }),
  ];
  const s = signals({
    profile: {
      preferred_categories: ["internship"],
      preferred_job_types: ["Internships"],
      preferred_province: "Gauteng",
    },
  });
  assert.equal(rankJobs(jobs, s, now)[0].job.id, jobs[1].id);
  assert.ok(
    rankJobs(jobs, s, now)[0].ranking.contributions.some(
      (c) => c.code === "employment",
    ),
  );
});
test("email geography falls back to profile province, but stated province wins", () => {
  const jobs = [job(1), job(2, { province: "Western Cape" })];
  assert.deepEqual(
    rankJobs(jobs, signals({ profile: { province: "Western Cape" } }), now).map(
      (r) => r.job.id,
    ),
    [jobs[1].id],
  );
  assert.deepEqual(
    rankJobs(
      jobs,
      signals({
        profile: { province: "Western Cape", preferred_province: "Gauteng" },
      }),
      now,
    ).map((r) => r.job.id),
    [jobs[0].id],
  );
});
test("notified saved searches require every keyword and filter, and rank ahead of preference matches", () => {
  const a = job(1, {
    title: "Office clerk",
    company_name: "Acme",
    province: "Western Cape",
    category: "government",
    salary_max: 15000,
  });
  const b = job(2, {
    title: "Office engineer",
    province: "Western Cape",
    category: "government",
    salary_max: 15000,
  });
  const s = signals({
    profile: {
      preferred_categories: ["internship"],
      preferred_province: "Gauteng",
    },
    savedSearches: [
      {
        keyword: "office clerk",
        notify: true,
        filters: {
          province: "Western Cape",
          category: "government",
          minSalary: 12000,
        },
      },
    ],
  });
  const rows = rankJobs([a, b, job(3)], s, now);
  assert.equal(rows[0].job.id, a.id);
  assert.ok(rows[0].ranking.reasons.some((r) => r.code === "saved_search"));
  assert.ok(!rows.some((r) => r.job.id === b.id));
  s.savedSearches[0].filters.minSalary = 20000;
  assert.ok(!rankJobs([a], s, now).length);
});
test("free text aliases normalise without guessing unknown qualifications", () => {
  const s = signals({ profile: { highest_qualification: "Matric" } });
  assert.equal(
    assessRequirements(job(1, { education_level: "Grade 12 / Matric" }), s, now)
      .evidence[0].state,
    "match",
  );
  assert.equal(
    assessRequirements(job(1, { education_level: "N6" }), s, now).evidence[0]
      .state,
    "unknown",
  );
});
test("free-text skills with regex punctuation are literal and do not crash matching", () => {
  for (const skill of ["C++", "Data (entry)", "[Excel]"]) {
    const rows = rankJobs(
      [job(1, { title: `${skill} role` })],
      signals({ profile: { skills: [skill] } }),
      now,
    );
    assert.ok(rows[0].ranking.contributions.some((c) => c.code === "skills"));
  }
});

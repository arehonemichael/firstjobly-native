// An isolated PostgREST fixture for testing the real Supabase query client.
// It does not claim to test production RLS; the owner supplied the live RLS audit.
const { createClient } = require("@supabase/supabase-js");
const { job, uid, now } = require("./fixtures.cjs");
function backend() {
  let current = uid.alice,
    maintenance = false,
    delay = null;
  const calls = [],
    stored = new Map();
  const tables = {
    jobs: Array.from({ length: 80 }, (_, i) =>
      job(i + 1, { category: i % 2 ? "government" : "internship" }),
    ),
    profiles: [
      {
        id: uid.alice,
        preferred_categories: ["internship"],
        preferred_province: "Gauteng",
        skills: [],
      },
      {
        id: uid.bob,
        preferred_categories: ["government"],
        preferred_province: "Gauteng",
        skills: [],
      },
    ],
    saved_jobs: [],
    applications: [],
    saved_searches: [],
    work_experience: [],
    job_views: [],
  };
  const fetch = async (input, init = {}) => {
    const url = new URL(
        typeof input === "string" ? input : (input.url ?? String(input)),
      ),
      headers = new Headers(init.headers),
      method = init.method ?? "GET";
    const table = url.pathname.split("/").pop();
    if (!url.pathname.startsWith("/rest/v1/") || !(table in tables))
      throw Error(`Unknown backend contract: ${url.pathname}`);
    const auth = headers.get("authorization"),
      owner = auth?.startsWith("Bearer token:")
        ? auth.slice("Bearer token:".length)
        : null;
    calls.push({ table, url, method, owner });
    if (delay && table === "jobs") {
      const wait = delay;
      delay = null;
      await wait;
    }
    let rows = tables[table].filter((r) =>
      table === "jobs"
        ? r.approval_status === "approved"
        : table === "profiles"
          ? r.id === owner
          : r.user_id === owner,
    );
    for (const [key, val] of url.searchParams) {
      if (["select", "limit", "order", "or", "offset"].includes(key)) continue;
      if (val.startsWith("eq."))
        rows = rows.filter((r) => String(r[key]) === val.slice(3));
      else if (val.startsWith("in.(")) {
        const ids = val.slice(4, -1).split(",");
        rows = rows.filter((r) => ids.includes(r[key]));
      } else throw Error(`Unsupported fixture filter ${key}=${val}`);
    }
    if (url.searchParams.has("or"))
      rows = rows.filter(
        (r) => !r.closing_date || r.closing_date >= "2026-11-12",
      );
    const order = url.searchParams.get("order");
    if (order) {
      const sorts = order.split(",").map((p) => p.split("."));
      rows = [...rows].sort((a, b) => {
        for (const [k, dir] of sorts) {
          const c = String(a[k] ?? "").localeCompare(String(b[k] ?? ""));
          if (c) return dir === "desc" ? -c : c;
        }
        return 0;
      });
    }
    rows = rows.slice(0, Number(url.searchParams.get("limit") ?? 1000));
    if (method === "PATCH") {
      if (table !== "profiles") throw Error("Unexpected remote write");
      if (maintenance)
        return new Response(
          JSON.stringify({
            code: "25006",
            message:
              "FirstJobly is in read-only maintenance mode. Please try again shortly.",
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      const patch = JSON.parse(init.body);
      for (const row of rows) Object.assign(row, patch);
    } else if (method !== "GET" && method !== "HEAD")
      throw Error(`Unexpected method ${method}`);
    const cols = url.searchParams.get("select");
    if (cols && cols !== "*")
      rows = rows.map((r) =>
        Object.fromEntries(cols.split(",").map((k) => [k, r[k]])),
      );
    const single = headers.get("accept")?.includes("vnd.pgrst.object");
    return new Response(JSON.stringify(single ? (rows[0] ?? null) : rows), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createClient(
    "https://isolated.supabase.test",
    "public-fixture-key",
    {
      global: { fetch },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  client.auth.getSession = async () => ({
    data: {
      session: current
        ? { access_token: `token:${current}`, user: { id: current } }
        : null,
    },
    error: null,
  });
  const storage = {
    async getItem(key) {
      return stored.get(key) ?? null;
    },
    async setItem(key, val) {
      stored.set(key, val);
    },
  };
  return {
    fetch,
    client,
    storage,
    tables,
    calls,
    stored,
    setOwner(v) {
      current = v;
    },
    setMaintenance(v) {
      maintenance = v;
    },
    delayJobs(p) {
      delay = p;
    },
    now,
  };
}
module.exports = { backend };

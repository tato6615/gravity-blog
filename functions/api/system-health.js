// functions/api/system-health.js
//
// One endpoint that checks every piece of the GRAVITY OS pipeline and
// reports status back as JSON, grouped the same way as your
// PROJECT-STATUS.md phases (Tracking → Conversion → Analytics → Growth →
// Automation), plus the separate "af" Worker.
//
// GET /api/system-health  →  { generatedAt, overall, checks: [...] }

const CONFIG = {
  D1_BINDING: "DB",
  AF_WORKER_URL: "https://af.pakpiromjajaj.workers.dev",
  GITHUB_REPO: "tato6615/gravity-blog",
  GITHUB_WORKFLOWS: [
    "check-product-links.yml",
    "sync-analytics-to-grist.yml",
  ],
};

function check(id, label, phase) {
  return { id, label, phase, status: "unknown", detail: "", checkedAt: new Date().toISOString() };
}

async function withTimeout(promise, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promise(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function checkD1Tables(env) {
  const c = check("d1_tables", "D1 Database (clicks / conversions / email_subscribers)", "tracking");
  try {
    const db = env[CONFIG.D1_BINDING];
    if (!db) {
      c.status = "error";
      c.detail = `D1 binding "${CONFIG.D1_BINDING}" not found on env — check wrangler.toml binding name.`;
      return c;
    }
    const tables = ["clicks", "conversions", "email_subscribers"];
    const results = {};
    for (const t of tables) {
      try {
        const row = await db.prepare(`SELECT COUNT(*) as n, MAX(id) as lastId FROM ${t}`).first();
        results[t] = { count: row?.n ?? 0, lastId: row?.lastId ?? null };
      } catch (e) {
        results[t] = { error: e.message };
      }
    }
    const anyError = Object.values(results).some(r => r.error);
    c.status = anyError ? "warn" : "ok";
    c.detail = JSON.stringify(results);
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkGoRedirect(env) {
  const c = check("go_redirect", "/go/[id] redirect route", "tracking");
  try {
    const url = new URL("/go/1", "https://gravity-blog.pages.dev");
    const res = await withTimeout(
      (signal) => fetch(url.toString(), { method: "GET", redirect: "manual", signal }),
      6000
    );
    if (res.status >= 300 && res.status < 400) {
      c.status = "ok";
      c.detail = `HTTP ${res.status} redirect — working`;
    } else {
      c.status = "warn";
      c.detail = `Expected 3xx redirect, got HTTP ${res.status}`;
    }
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkGrist(env) {
  const c = check("grist_api", "Grist API connection", "conversion");
  if (!env.GRIST_API_KEY || !env.GRIST_DOC_ID) {
    c.status = "error";
    c.detail = "GRIST_API_KEY or GRIST_DOC_ID not set in Cloudflare secrets.";
    return c;
  }
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`https://docs.getgrist.com/api/docs/${env.GRIST_DOC_ID}/tables`, {
          headers: { Authorization: `Bearer ${env.GRIST_API_KEY}` },
          signal,
        }),
      6000
    );
    if (res.ok) {
      const data = await res.json();
      c.status = "ok";
      c.detail = `Reachable — ${data.tables?.length ?? "?"} tables found`;
    } else {
      c.status = "error";
      c.detail = `Grist responded HTTP ${res.status} (key may be revoked/expired)`;
    }
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkGA4Config(env) {
  const c = check("ga4_config", "GA4 Measurement Protocol config", "analytics");
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    c.status = "error";
    c.detail = "GA4_MEASUREMENT_ID or GA4_API_SECRET not set.";
    return c;
  }
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(
          `https://www.google-analytics.com/debug/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
          {
            method: "POST",
            signal,
            body: JSON.stringify({
              client_id: "healthcheck.system",
              events: [{ name: "system_health_check", params: {} }],
            }),
          }
        ),
      6000
    );
    const data = await res.json();
    const problems = data.validationMessages || [];
    if (problems.length === 0) {
      c.status = "ok";
      c.detail = "Measurement ID + API Secret valid";
    } else {
      c.status = "warn";
      c.detail = JSON.stringify(problems);
    }
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkMailchimpConfig(env) {
  const c = check("mailchimp_config", "Mailchimp (Growth / email)", "growth");
  if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_SERVER || !env.MAILCHIMP_LIST_ID) {
    c.status = "error";
    c.detail = "One or more of MAILCHIMP_API_KEY / MAILCHIMP_SERVER / MAILCHIMP_LIST_ID not set yet.";
    return c;
  }
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`https://${env.MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_LIST_ID}`, {
          headers: { Authorization: `Basic ${btoa("anystring:" + env.MAILCHIMP_API_KEY)}` },
          signal,
        }),
      6000
    );
    if (res.ok) {
      const data = await res.json();
      c.status = "ok";
      c.detail = `List "${data.name}" reachable — ${data.stats?.member_count ?? "?"} subscribers`;
    } else {
      c.status = "error";
      c.detail = `Mailchimp responded HTTP ${res.status} (check key/server/list id)`;
    }
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkAfWorker(env) {
  const c = check("af_worker", 'Separate "af" Worker (AI Product Engine)', "automation");
  if (!CONFIG.AF_WORKER_URL) {
    c.status = "unknown";
    c.detail = "AF_WORKER_URL not configured in system-health.js";
    return c;
  }
  try {
    const res = await withTimeout((signal) => fetch(CONFIG.AF_WORKER_URL, { signal }), 6000);
    c.status = res.ok ? "ok" : "warn";
    c.detail = `HTTP ${res.status}`;
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkGitHubActions(env) {
  const c = check("github_actions", "GitHub Actions (automation workflows)", "automation");
  if (!CONFIG.GITHUB_REPO) {
    c.status = "unknown";
    c.detail = "GITHUB_REPO not set in system-health.js CONFIG.";
    return c;
  }
  try {
    const headers = { "User-Agent": "gravity-os-health-check" };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const results = {};
    for (const wf of CONFIG.GITHUB_WORKFLOWS) {
      const res = await withTimeout(
        (signal) =>
          fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/actions/workflows/${wf}/runs?per_page=1`,
            { headers, signal }
          ),
        6000
      );
      if (res.ok) {
        const data = await res.json();
        const run = data.workflow_runs?.[0];
        results[wf] = run
          ? { status: run.status, conclusion: run.conclusion, ranAt: run.run_started_at }
          : { status: "no runs found" };
      } else {
        results[wf] = { error: `HTTP ${res.status}` };
      }
    }
    const anyFail = Object.values(results).some((r) => r.conclusion === "failure" || r.error);
    c.status = anyFail ? "warn" : "ok";
    c.detail = JSON.stringify(results);
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

async function checkStatsEndpoint(env) {
  const c = check("stats_endpoint", "/api/stats (dashboard data source)", "analytics");
  try {
    const res = await withTimeout(
      (signal) => fetch("https://gravity-blog.pages.dev/api/stats", { signal }),
      6000
    );
    c.status = res.ok ? "ok" : "warn";
    c.detail = `HTTP ${res.status}`;
  } catch (e) {
    c.status = "error";
    c.detail = e.message;
  }
  return c;
}

export async function onRequestGet({ env }) {
  const checks = await Promise.all([
    checkD1Tables(env),
    checkGoRedirect(env),
    checkStatsEndpoint(env),
    checkGrist(env),
    checkGA4Config(env),
    checkMailchimpConfig(env),
    checkAfWorker(env),
    checkGitHubActions(env),
  ]);

  const overall = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warn" || c.status === "unknown")
    ? "warn"
    : "ok";

  return new Response(
    JSON.stringify({ generatedAt: new Date().toISOString(), overall, checks }, null, 2),
    { headers: { "content-type": "application/json" } }
  );
}

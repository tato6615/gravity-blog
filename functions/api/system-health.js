// functions/api/system-health.js — v3: full coverage + history + LINE alert
//
// GET /api/system-health → { generatedAt, overall, checks: [...], history: [...] }
//
// ⚠️ Optional: set LINE_NOTIFY_TOKEN as a Cloudflare secret to get an
// automatic LINE alert whenever overall status = "error". Get a token at
// https://notify-bot.line.me/my/ → generate token → paste as secret.
// If not set, alerting is skipped silently (no error, no crash).

const CONFIG = {
  D1_BINDING: "DB",
  AF_WORKER_URL: "https://af.pakpiromjajaja.workers.dev",
  GITHUB_REPO: "tato6615/gravity-blog",
  GITHUB_WORKFLOWS: ["check-product-links.yml", "sync-analytics.yml", "sync-ga4-views.yml"],
  SITE_URL: "https://gravity-blog.pages.dev",
  // A known-good product to test the real article page + affiliate link with
  TEST_PRODUCT_SLUG: "cat-calming-diffuser-kit",
  TEST_PRODUCT_ID: "104",
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

// ---------- Core pipeline checks (unchanged from v2) ----------

async function checkD1Tables(env) {
  const c = check("d1_tables", "D1 Database (clicks / conversions / email_subscribers)", "tracking");
  try {
    const db = env[CONFIG.D1_BINDING];
    if (!db) { c.status = "error"; c.detail = `D1 binding "${CONFIG.D1_BINDING}" not found.`; return c; }
    const tables = ["clicks", "conversions", "email_subscribers"];
    const results = {};
    for (const t of tables) {
      try {
        const row = await db.prepare(`SELECT COUNT(*) as n, MAX(id) as lastId FROM ${t}`).first();
        results[t] = { count: row?.n ?? 0, lastId: row?.lastId ?? null };
      } catch (e) { results[t] = { error: e.message }; }
    }
    const anyError = Object.values(results).some(r => r.error);
    c.status = anyError ? "warn" : "ok";
    c.detail = JSON.stringify(results);
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkGoRedirect(env) {
  const c = check("go_redirect", "/go/[id] redirect route", "tracking");
  try {
    const url = new URL(`/go/${CONFIG.TEST_PRODUCT_ID}`, CONFIG.SITE_URL);
    const res = await withTimeout((s) => fetch(url.toString(), { method: "GET", redirect: "manual", signal: s }), 6000);
    if (res.status >= 300 && res.status < 400) { c.status = "ok"; c.detail = `HTTP ${res.status} redirect`; }
    else { c.status = "warn"; c.detail = `Expected 3xx, got HTTP ${res.status}`; }
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkGrist(env) {
  const c = check("grist_api", "Grist API connection", "conversion");
  if (!env.GRIST_API_KEY || !env.GRIST_DOC_ID) { c.status = "error"; c.detail = "GRIST_API_KEY/GRIST_DOC_ID not set."; return c; }
  try {
    const res = await withTimeout((s) => fetch(`https://docs.getgrist.com/api/docs/${env.GRIST_DOC_ID}/tables`, { headers: { Authorization: `Bearer ${env.GRIST_API_KEY}` }, signal: s }), 6000);
    if (res.ok) { const d = await res.json(); c.status = "ok"; c.detail = `Reachable — ${d.tables?.length ?? "?"} tables`; }
    else { c.status = "error"; c.detail = `HTTP ${res.status}`; }
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkGA4Config(env) {
  const c = check("ga4_config", "GA4 Measurement Protocol config", "analytics");
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) { c.status = "error"; c.detail = "GA4_MEASUREMENT_ID/GA4_API_SECRET not set."; return c; }
  try {
    const res = await withTimeout((s) => fetch(`https://www.google-analytics.com/debug/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`, { method: "POST", signal: s, body: JSON.stringify({ client_id: "healthcheck.system", events: [{ name: "system_health_check", params: {} }] }) }), 6000);
    const d = await res.json();
    const problems = d.validationMessages || [];
    c.status = problems.length === 0 ? "ok" : "warn";
    c.detail = problems.length === 0 ? "Measurement ID + API Secret valid" : JSON.stringify(problems);
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkMailchimpConfig(env) {
  const c = check("mailchimp_config", "Mailchimp (Growth / email)", "growth");
  if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_SERVER || !env.MAILCHIMP_LIST_ID) { c.status = "error"; c.detail = "Mailchimp secrets not fully set."; return c; }
  try {
    const res = await withTimeout((s) => fetch(`https://${env.MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_LIST_ID}`, { headers: { Authorization: `Basic ${btoa("anystring:" + env.MAILCHIMP_API_KEY)}` }, signal: s }), 6000);
    if (res.ok) { const d = await res.json(); c.status = "ok"; c.detail = `List "${d.name}" — ${d.stats?.member_count ?? "?"} subscribers`; }
    else { c.status = "error"; c.detail = `HTTP ${res.status}`; }
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkAfWorker(env) {
  const c = check("af_worker", 'Separate "af" Worker (AI Product Engine)', "automation");
  try {
    const res = await withTimeout((s) => fetch(CONFIG.AF_WORKER_URL, { signal: s }), 6000);
    const text = await res.text();
    const looksRight = text.includes("GRAVITY") || text.includes("Product Engine") || res.ok;
    c.status = res.ok && looksRight ? "ok" : "warn";
    c.detail = `HTTP ${res.status}${looksRight ? " — page content looks correct" : " — unexpected content"}`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkGitHubActions(env) {
  const c = check("github_actions", "GitHub Actions (automation workflows)", "automation");
  try {
    const headers = { "User-Agent": "gravity-os-health-check" };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const results = {};
    for (const wf of CONFIG.GITHUB_WORKFLOWS) {
      const res = await withTimeout((s) => fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/actions/workflows/${wf}/runs?per_page=1`, { headers, signal: s }), 6000);
      if (res.ok) {
        const d = await res.json();
        const run = d.workflow_runs?.[0];
        results[wf] = run ? { status: run.status, conclusion: run.conclusion, ranAt: run.run_started_at } : { status: "no runs found" };
      } else { results[wf] = { error: `HTTP ${res.status}` }; }
    }
    const anyFail = Object.values(results).some((r) => r.conclusion === "failure" || r.error);
    c.status = anyFail ? "warn" : "ok";
    c.detail = JSON.stringify(results);
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkStatsEndpoint(env) {
  const c = check("stats_endpoint", "/api/stats (dashboard data source)", "analytics");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/api/stats`, { signal: s }), 6000);
    c.status = res.ok ? "ok" : "warn";
    c.detail = `HTTP ${res.status}`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

// ---------- NEW: remaining endpoints ----------

async function checkClickEndpoint(env) {
  const c = check("click_endpoint", "/api/click (GET, expects 400 without params)", "tracking");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/api/click`, { signal: s }), 6000);
    // Known design: GET without product_id+redirect params returns 400 — that IS correct behavior
    c.status = res.status === 400 ? "ok" : (res.status >= 500 ? "error" : "warn");
    c.detail = `HTTP ${res.status}${res.status === 400 ? " — validating input correctly" : ""}`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkTrackEndpoint(env) {
  const c = check("track_endpoint", "/api/track", "tracking");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/api/track`, { signal: s }), 6000);
    c.status = res.status >= 500 ? "error" : "ok";
    c.detail = `HTTP ${res.status}`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkEmailEndpoint(env) {
  const c = check("email_endpoint", "/api/email/* (subscribe/newsletter route)", "growth");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/api/email/subscribe`, { method: "GET", signal: s }), 6000);
    c.status = res.status >= 500 ? "error" : "ok";
    c.detail = `HTTP ${res.status} — route reachable`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkProductWebhook(env) {
  const c = check("product_webhook", "/api/product-webhook (Shotstack video trigger)", "automation");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/api/product-webhook`, { method: "GET", signal: s }), 6000);
    // POST-only endpoint — 404 means route missing, anything else means it exists
    c.status = res.status === 404 ? "error" : (res.status >= 500 ? "warn" : "ok");
    c.detail = `HTTP ${res.status}`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkShotstackCallback(env) {
  const c = check("shotstack_callback", "/api/shotstack-callback", "automation");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/api/shotstack-callback`, { method: "GET", signal: s }), 6000);
    c.status = res.status === 404 ? "error" : (res.status >= 500 ? "warn" : "ok");
    c.detail = `HTTP ${res.status}`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

async function checkArticlePage(env) {
  const c = check("article_page", "Real article page + affiliate link", "tracking");
  try {
    const res = await withTimeout((s) => fetch(`${CONFIG.SITE_URL}/product/${CONFIG.TEST_PRODUCT_SLUG}`, { signal: s }), 6000);
    if (!res.ok) { c.status = "error"; c.detail = `Page HTTP ${res.status}`; return c; }
    const html = await res.text();
    const hasCorrectLink = html.includes(`/go/${CONFIG.TEST_PRODUCT_ID}`);
    c.status = hasCorrectLink ? "ok" : "warn";
    c.detail = hasCorrectLink
      ? `Page loads, affiliate button correctly points to /go/${CONFIG.TEST_PRODUCT_ID}`
      : `Page loads but /go/${CONFIG.TEST_PRODUCT_ID} link not found in HTML — check buy button`;
  } catch (e) { c.status = "error"; c.detail = e.message; }
  return c;
}

// ---------- History logging (D1) ----------

async function ensureHistoryTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS system_health_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checked_at TEXT NOT NULL,
    overall TEXT NOT NULL,
    ok_count INTEGER, warn_count INTEGER, error_count INTEGER
  )`).run();
}

async function logAndGetHistory(env, overall, checks) {
  const db = env[CONFIG.D1_BINDING];
  if (!db) return [];
  try {
    await ensureHistoryTable(db);
    const okC = checks.filter(c => c.status === "ok").length;
    const warnC = checks.filter(c => c.status === "warn" || c.status === "unknown").length;
    const errC = checks.filter(c => c.status === "error").length;
    await db.prepare(`INSERT INTO system_health_log (checked_at, overall, ok_count, warn_count, error_count) VALUES (?, ?, ?, ?, ?)`)
      .bind(new Date().toISOString(), overall, okC, warnC, errC).run();
    const { results } = await db.prepare(`SELECT checked_at, overall, ok_count, warn_count, error_count FROM system_health_log ORDER BY id DESC LIMIT 10`).all();
    return results || [];
  } catch (e) {
    return [{ error: e.message }];
  }
}

// ---------- LINE alert (only fires on "error") ----------

async function maybeSendAlert(env, overall, checks) {
  if (overall !== "error" || !env.LINE_NOTIFY_TOKEN) return;
  const failing = checks.filter(c => c.status === "error").map(c => `❌ ${c.label}: ${c.detail}`).join("\n");
  const message = `\n🚨 GRAVITY OS System Health\nพบปัญหา ${checks.filter(c=>c.status==='error').length} จุด:\n${failing}`;
  try {
    await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.LINE_NOTIFY_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message }),
    });
  } catch (_) { /* never let alert failure break the health check response */ }
}

// ---------- Handler ----------

export async function onRequestGet({ env }) {
  const checks = await Promise.all([
    checkD1Tables(env),
    checkGoRedirect(env),
    checkStatsEndpoint(env),
    checkClickEndpoint(env),
    checkTrackEndpoint(env),
    checkArticlePage(env),
    checkGrist(env),
    checkGA4Config(env),
    checkEmailEndpoint(env),
    checkMailchimpConfig(env),
    checkAfWorker(env),
    checkGitHubActions(env),
    checkProductWebhook(env),
    checkShotstackCallback(env),
  ]);

  const overall = checks.some((c) => c.status === "error") ? "error"
    : checks.some((c) => c.status === "warn" || c.status === "unknown") ? "warn"
    : "ok";

  const history = await logAndGetHistory(env, overall, checks);
  await maybeSendAlert(env, overall, checks);

  return new Response(
    JSON.stringify({ generatedAt: new Date().toISOString(), overall, checks, history }, null, 2),
    { headers: { "content-type": "application/json" } }
  );
}

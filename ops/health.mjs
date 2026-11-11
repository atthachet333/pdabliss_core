// CORE health monitor (EP43). Checks — each with a timeout and retries:
//   frontend      GET <frontendUrl>                       200 = ok
//   backend-live  GET <backendUrl>/health                 the process answers (liveness)
//   backend-ready GET <backendUrl>/health/ready           it may serve: database + schema (readiness)
//   database      SELECT 1 through the monitor connection (optional, read-only role)
//   storage       the storage monitor's volumes
//   backup        the newest verified backup of each watched profile is younger than N hours
// A dead check is critical, a degraded one (alive but not ready, stale backup) a warning. Alerts
// are deduplicated (raise / escalate / recover). The monitor never restarts anything — it
// reports; people (or an approved supervisor) act.
import fs from "node:fs";
import path from "node:path";
import { alertState, envValue, withClient } from "./lib.mjs";
import { latestBackup } from "./backup.mjs";
import { checkStorage } from "./storage.mjs";

async function http(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "manual",
      headers: { "user-agent": "pdabliss-core-monitor" },
    });
    let body = null;
    try {
      body = await r.json();
    } catch {
      /* not JSON */
    }
    return { status: r.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function retry(fn, retries, delayMs) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fn();
      if (r.level === "ok" || i === retries) return { ...r, attempts: i + 1 };
      last = r;
    } catch (e) {
      last = {
        level: "critical",
        detail: e.name === "AbortError" ? "timeout" : (e.code ?? e.message),
      };
      if (i === retries) return { ...last, attempts: i + 1 };
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}

export async function runChecks(cfg, { now = new Date(), fetchImpl } = {}) {
  const h = cfg.health ?? {};
  const timeoutMs = h.timeoutMs ?? 5000;
  const retries = h.retries ?? 2;
  const delay = h.retryDelayMs ?? 1000;
  const get = fetchImpl ?? http;
  const results = [];
  const push = (name, r) => results.push({ name, ...r });

  if (h.frontendUrl)
    push(
      "frontend",
      await retry(
        async () => {
          const r = await get(h.frontendUrl, timeoutMs);
          return r.status === 200
            ? { level: "ok" }
            : { level: "critical", detail: `HTTP ${r.status}` };
        },
        retries,
        delay,
      ),
    );
  if (h.backendUrl) {
    push(
      "backend-live",
      await retry(
        async () => {
          const r = await get(`${h.backendUrl}/health`, timeoutMs);
          return r.status === 200 && r.body?.status === "ok"
            ? { level: "ok" }
            : { level: "critical", detail: `HTTP ${r.status}` };
        },
        retries,
        delay,
      ),
    );
    push(
      "backend-ready",
      await retry(
        async () => {
          const r = await get(`${h.backendUrl}/health/ready`, timeoutMs);
          if (r.status === 200 && r.body?.status === "ready")
            return { level: "ok" };
          const checks = r.body?.checks
            ? `database ${r.body.checks.database}, schema ${r.body.checks.schema}`
            : `HTTP ${r.status}`;
          // Alive but not ready is degraded (warning) unless the process itself is gone.
          const live =
            results.find((x) => x.name === "backend-live")?.level === "ok";
          return { level: live ? "warning" : "critical", detail: checks };
        },
        retries,
        delay,
      ),
    );
  }
  if (h.database?.envFile) {
    push(
      "database",
      await retry(
        async () => {
          const url = new URL(
            envValue(
              h.database.envFile,
              h.database.envKey ?? "CORE_MONITOR_DATABASE_URL",
            ),
          );
          await withClient(
            url,
            (c) => c.query("SELECT 1"),
            "pdabliss-core-monitor",
          );
          return { level: "ok" };
        },
        retries,
        delay,
      ),
    );
  }
  for (const b of h.backups ?? []) {
    const latest = latestBackup(b.dir, b.profile);
    const verifiedAt = latest?.manifest?.verified?.ok
      ? new Date(latest.manifest.verified.at)
      : null;
    const ageH = verifiedAt ? (now - verifiedAt) / 3600000 : Infinity;
    push(`backup:${b.profile}`, {
      level:
        ageH <= (b.maxAgeHours ?? 26)
          ? "ok"
          : ageH <= (b.criticalAgeHours ?? 50)
            ? "warning"
            : "critical",
      detail: verifiedAt
        ? `newest verified backup ${ageH.toFixed(1)} h old`
        : "no verified backup",
      attempts: 1,
    });
  }
  return results;
}

/** One monitoring cycle: checks + storage, deduplicated alerts, a status file for operators. */
export async function cycle(
  cfg,
  { log, alert, stateFile, mockStorage, fetchImpl, now = new Date() },
) {
  const state = alertState(stateFile);
  const checks = await runChecks(cfg, { now, fetchImpl });
  for (const r of checks) {
    const tr = state.transition(`health:${r.name}`, r.level);
    if (tr)
      await alert({
        level: tr === "recover" ? "ok" : r.level,
        kind: tr,
        title:
          tr === "recover"
            ? `${r.name} recovered`
            : `${r.name} ${r.level.toUpperCase()}: ${r.detail ?? ""}`.trim(),
        check: r.name,
        detail: r.detail,
        at: now.toISOString(),
      });
  }
  const storage = await checkStorage(cfg, {
    mock: mockStorage,
    state,
    alert,
    now,
  });
  state.save();
  const worst = [...checks, ...storage].reduce(
    (w, r) => (rank(r.level) > rank(w) ? r.level : w),
    "ok",
  );
  const status = { at: now.toISOString(), overall: worst, checks, storage };
  if (cfg.health?.statusFile) {
    fs.mkdirSync(path.dirname(cfg.health.statusFile), { recursive: true });
    fs.writeFileSync(cfg.health.statusFile, JSON.stringify(status, null, 1));
  }
  log.info(`health cycle: ${worst}`, {
    checks: checks.map((c) => `${c.name}=${c.level}`),
    storage: storage.map((s) => `${s.name}=${s.level}`),
  });
  return status;
}
const rank = (l) => ({ ok: 0, observe: 1, warning: 2, critical: 3 })[l] ?? 3;

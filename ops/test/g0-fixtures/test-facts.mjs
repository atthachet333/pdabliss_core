// EP48.5 G0 incident amendment — TEST-ONLY facts provider for g0-supervisor.mjs (its `--facts-module` test hook; the
// runner never uses it). Real processes come from /proc on Linux and from g0-facts.ps1 on Windows, but every real
// production-like process (PM2 daemons, PostgreSQL, MariaDB, cloudflared) and every real listener is FILTERED OUT:
// the tests see only their own processes plus the synthetic production snapshot in G0_TEST_FACTS_EXTRA, so a unit
// test can never probe, plan against or stop the host's production.
import fs from "node:fs";
import { collectFactsWindows } from "../../ep48_5/g0-supervisor.mjs";

const TICKS_PER_SECOND = 100;
const PRODUCTION_NAME = /^(postgres|pg_ctl|mysqld|mariadbd|cloudflared)(\.exe)?$/i;
const PM2_DAEMON = /pm2[\\/]lib[\\/]daemon\.js/i;

function procProcesses() {
  const boot = Number(/btime (\d+)/.exec(fs.readFileSync("/proc/stat", "utf8"))[1]) * 1000;
  const out = [];
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
      const close = stat.lastIndexOf(")");
      const fields = stat.slice(close + 2).split(" ");
      if (fields[0] === "Z") continue; // a zombie has ended; only its parent's bookkeeping is left
      const cmd = fs.readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").filter(Boolean).join(" ");
      out.push({ pid: Number(entry), parent: Number(fields[1]), name: stat.slice(stat.indexOf("(") + 1, close), cmd, created: new Date(boot + (Number(fields[19]) * 1000) / TICKS_PER_SECOND).toISOString() });
    } catch {
      // the process ended while being read
    }
  }
  return out;
}
export function realProcesses() {
  const list = process.platform === "win32" ? [].concat(collectFactsWindows().processes ?? []) : procProcesses();
  return list.filter((p) => !PRODUCTION_NAME.test(String(p.name)) && !PM2_DAEMON.test(String(p.cmd)));
}
export const createdOf = (pid) => realProcesses().find((p) => Number(p.pid) === pid)?.created;

export async function collectFacts() {
  const extra = process.env.G0_TEST_FACTS_EXTRA ? JSON.parse(fs.readFileSync(process.env.G0_TEST_FACTS_EXTRA, "utf8")) : {};
  return { at: new Date().toISOString(), processes: [...realProcesses(), ...(extra.processes ?? [])], listeners: extra.listeners ?? [], to5432: extra.to5432 ?? [], cpuPct: 1, freeRamGB: 30, freeDiskDGB: 500 };
}

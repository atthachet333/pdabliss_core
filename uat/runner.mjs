// UAT process runner (EP42.2) — started detached by `node uat/uat.mjs start`, never by hand.
// `node uat/runner.mjs <backend|frontend> --pdabliss-uat-runner`
// Runs one UAT server with explicit development settings, logs to %UAT_HOME%\logs, and exits
// with it. `uat.mjs stop` ends this process tree only after checking its command line.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  BACKEND,
  BACKEND_URL,
  DIRS,
  FRONTEND,
  FRONTEND_URL,
  RUNNER_MARK,
  UAT,
  ensureDirs,
  pidFile,
  timestamp,
  urlFor,
} from './lib.mjs';

const role = process.argv[2];
if (!process.argv.includes(RUNNER_MARK) || !['backend', 'frontend'].includes(role)) {
  console.error('This runner is started by `node uat/uat.mjs start`.');
  process.exit(2);
}
ensureDirs();
const log = fs.createWriteStream(path.join(DIRS.logs, `${role}.log`), { flags: 'a' });
log.write(`\n===== ${timestamp()} UAT ${role} starting =====\n`);

let child;
if (role === 'backend') {
  const env = {
    ...process.env,
    // Explicit UAT settings win over backend/.env (process.loadEnvFile never overrides).
    NODE_ENV: 'development',
    ENABLE_DEMO_ROUTES: 'true',
    DATABASE_URL: urlFor(UAT.db, UAT.appName),
    HOST: UAT.host,
    PORT: String(UAT.backendPort),
    CORS_ORIGINS: FRONTEND_URL,
    PUBLIC_APP_URL: FRONTEND_URL,
    MAIL_TRANSPORT: 'dev',
    DEV_MAIL_DIR: DIRS.mail,
  };
  child = spawn(
    process.execPath,
    [path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs'), 'src/server.ts'],
    { cwd: BACKEND, env, windowsHide: true },
  );
} else {
  const env = { ...process.env, VITE_API_URL: BACKEND_URL };
  child = spawn(
    process.execPath,
    [
      path.join(FRONTEND, 'node_modules/vite/bin/vite.js'),
      '--host',
      UAT.host,
      '--port',
      String(UAT.frontendPort),
      '--strictPort',
    ],
    { cwd: FRONTEND, env, windowsHide: true },
  );
}
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
fs.writeFileSync(
  pidFile(role),
  JSON.stringify({
    role,
    runnerPid: process.pid,
    childPid: child.pid,
    startedAt: new Date().toISOString(),
  }),
);
const done = (code) => {
  log.write(`===== ${timestamp()} UAT ${role} exited (${code}) =====\n`);
  try {
    const cur = JSON.parse(fs.readFileSync(pidFile(role), 'utf8'));
    if (cur.runnerPid === process.pid) fs.rmSync(pidFile(role));
  } catch {
    /* already gone */
  }
  log.end(() => process.exit(code ?? 0));
};
child.on('exit', done);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());

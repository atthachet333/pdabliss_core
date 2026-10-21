import { buildApp } from './app.js';
import { EnvValidationError, loadEnv } from './config/env.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp(env);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down gracefully');

    const forceExit = setTimeout(() => {
      app.log.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    app.close().then(
      () => process.exit(0),
      (err: unknown) => {
        app.log.error({ err }, 'Error during shutdown');
        process.exit(1);
      },
    );
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    // Never silently move to another port — the frontend and docs depend on 1112.
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      app.log.fatal(
        `Port ${env.PORT} is already in use. Stop the other process; the port will not be changed automatically.`,
      );
    } else {
      app.log.fatal({ err }, 'Failed to start server');
    }
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  if (err instanceof EnvValidationError) {
    process.stderr.write(`${err.message}\n`);
  } else {
    process.stderr.write(`Fatal startup error: ${String(err)}\n`);
  }
  process.exit(1);
});

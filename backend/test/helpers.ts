import { buildApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

export function testEnv(overrides: Record<string, string> = {}) {
  return parseEnv({ NODE_ENV: 'test', ...overrides });
}

export async function buildTestApp(overrides: Record<string, string> = {}) {
  const app = await buildApp(testEnv(overrides));
  await app.ready();
  return app;
}

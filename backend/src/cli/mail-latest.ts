import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * `npm run mail:latest [count]` — development only: prints the newest messages
 * in the local mail sink (DEV_MAIL_DIR, default .mail/) so verification links
 * and sign-in codes can be read without a mailbox. The sink exists only when
 * MAIL_TRANSPORT=dev, which production refuses.
 */

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production') {
  process.stderr.write('The development mail sink is not available in production.\n');
  process.exit(1);
}
const dir = process.env.DEV_MAIL_DIR || '.mail';
const count = Math.max(1, Number(process.argv[2]) || 1);
const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .slice(-count)
  : [];
if (files.length === 0) {
  process.stdout.write(`No mail in ${dir} yet.\n`);
  process.exit(0);
}
for (const file of files) {
  const mail = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
    to: string;
    subject: string;
    text: string;
    sentAt: string;
  };
  process.stdout.write(`\n── ${mail.sentAt} → ${mail.to}\n${mail.subject}\n\n${mail.text}\n`);
}

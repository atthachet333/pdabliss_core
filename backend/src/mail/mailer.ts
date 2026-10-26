import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import type { Env } from '../config/env.js';

/*
 * Outbound mail (EP23). Sender identity: MAIL_FROM (notify@pdabliss.com).
 *
 * Transports:
 * - smtp    real delivery; credentials only from the environment.
 * - dev     local mail sink: each message is written to DEV_MAIL_DIR as .eml +
 *           .json so a developer can read verification links and codes without
 *           a mailbox (`npm run mail:latest`). Never allowed in production.
 * - memory  automated tests: messages stay in an array.
 *
 * A failed send is reported as a failure — never as success.
 */

export type MailPurpose =
  | 'verify_email'
  | 'login_otp'
  | 'step_up_otp'
  | 'password_reset'
  | 'password_changed'
  | 'existing_account'
  | 'invitation';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  purpose: MailPurpose;
}

export interface SentMail extends MailMessage {
  from: string;
  sentAt: Date;
}

export interface Mailer {
  readonly kind: 'smtp' | 'dev' | 'memory';
  send(message: MailMessage): Promise<void>;
}

export class MailDeliveryError extends Error {
  constructor(public readonly purpose: MailPurpose) {
    super(`Mail delivery failed (${purpose})`);
    this.name = 'MailDeliveryError';
  }
}

export class MemoryMailer implements Mailer {
  readonly kind = 'memory';
  readonly sent: SentMail[] = [];
  constructor(private readonly from: string) {}
  send(message: MailMessage): Promise<void> {
    this.sent.push({ ...message, from: this.from, sentAt: new Date() });
    return Promise.resolve();
  }
  /** Most recent message to an address (optionally of one purpose). */
  last(to: string, purpose?: MailPurpose): SentMail | undefined {
    return [...this.sent]
      .reverse()
      .find((m) => m.to.toLowerCase() === to.toLowerCase() && (!purpose || m.purpose === purpose));
  }
  clear() {
    this.sent.length = 0;
  }
}

class DevSinkMailer implements Mailer {
  readonly kind = 'dev';
  constructor(
    private readonly from: string,
    private readonly dir: string,
  ) {}
  async send(message: MailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = join(this.dir, `${stamp}-${message.purpose}`);
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const info = await transport.sendMail({ from: this.from, ...message });
    await writeFile(`${base}.eml`, info.message as Buffer);
    await writeFile(
      `${base}.json`,
      JSON.stringify({ from: this.from, ...message, sentAt: new Date().toISOString() }, null, 2),
    );
  }
}

class SmtpMailer implements Mailer {
  readonly kind = 'smtp';
  private readonly transport;
  constructor(
    private readonly from: string,
    env: Env,
  ) {
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      // Without implicit TLS, insist on STARTTLS — never send codes in clear text.
      requireTLS: !env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  async send(message: MailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch {
      // The transport error can echo server replies; it is not logged verbatim.
      throw new MailDeliveryError(message.purpose);
    }
  }
}

export function createMailer(env: Env): Mailer {
  if (env.MAIL_TRANSPORT === 'smtp') return new SmtpMailer(env.MAIL_FROM, env);
  return new DevSinkMailer(env.MAIL_FROM, env.DEV_MAIL_DIR);
}

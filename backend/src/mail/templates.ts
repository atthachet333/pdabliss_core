import type { MailMessage } from './mailer.js';

/*
 * Transactional email templates (EP23; layout polished in EP24). Thai first, with English and
 * Simplified Chinese; the recipient's saved locale picks the language
 * (fallback Thai). Plain, light HTML — no remote images, no tracking — plus a
 * text part. Links come from PUBLIC_APP_URL; secrets travel in the URL
 * fragment (#token=…), which browsers never send to a server or in a Referer.
 */

export type MailLocale = 'th' | 'en' | 'zh-CN';

const LANG_PARAM: Record<MailLocale, string> = { th: 'th', en: 'en', 'zh-CN': 'zh' };

export function appLink(baseUrl: string, path: string, locale: MailLocale, token?: string) {
  const url = `${baseUrl}${path}?lang=${LANG_PARAM[locale]}`;
  return token ? `${url}#token=${token}` : url;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** What kind of message this is — a small tag in the CORE band (EP24.1). */
type Kind = 'security' | 'verification' | 'account' | 'invitation';

const KIND: Record<Kind, Record<MailLocale, string>> = {
  security: { th: 'ความปลอดภัย', en: 'Security', 'zh-CN': '安全' },
  verification: { th: 'ยืนยันอีเมล', en: 'Email verification', 'zh-CN': '邮箱验证' },
  account: { th: 'บัญชี', en: 'Account', 'zh-CN': '账户' },
  invitation: { th: 'คำเชิญ', en: 'Invitation', 'zh-CN': '邀请' },
};

const FACTS_TITLE: Record<MailLocale, string> = {
  th: 'สิ่งที่ควรรู้',
  en: 'Good to know',
  'zh-CN': '须知',
};

/** The sender line under every message. */
const SIGNATURE = 'PDA BLISS CORE · PDA BLISS COMPANY LIMITED';

interface Body {
  kind: Kind;
  subject: string;
  /** Inbox preview line (hidden in the message). */
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Short, factual points (validity, single use, what happens next). */
  facts?: string[];
  action?: { label: string; url: string };
  code?: { label: string; value: string };
  footer: string;
}

const FOOTER: Record<MailLocale, string> = {
  th: 'อีเมลนี้ส่งจาก PDA BLISS CORE โดยอัตโนมัติ กรุณาอย่าตอบกลับ หากคุณไม่ได้ทำรายการนี้ ไม่ต้องดำเนินการใด ๆ',
  en: 'This email was sent automatically by PDA BLISS CORE. Please do not reply. If you did not request this, you can ignore it.',
  'zh-CN': '本邮件由 PDA BLISS CORE 自动发送，请勿回复。如果这不是您本人的操作，请忽略本邮件。',
};

/** Shown above the footer when there is a button: the same link, as plain text. */
const FALLBACK: Record<MailLocale, string> = {
  th: 'ถ้าปุ่มด้านบนใช้ไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:',
  en: 'If the button does not work, copy this link into your browser:',
  'zh-CN': '如果上方按钮无法使用，请将此链接复制到浏览器中打开：',
};

/*
 * The CORE email layout (EP24 polish). Conservative on purpose: tables, inline
 * styles, system fonts, no images, no web fonts, no scripts. A dark CORE band
 * over a light reading card (survives clients that invert or strip styles).
 * The button is a real link with readable text; the same link appears once
 * more, small, only as a fallback above the footer. The text part carries
 * everything for clients that show no HTML.
 */
const COLORS = {
  page: '#eef2f3',
  band: '#06121b',
  bandText: '#e9f5f1',
  accent: '#3ef0c0',
  card: '#ffffff',
  heading: '#0b1a24',
  body: '#33454f',
  muted: '#5c6d75',
  rule: '#e1e8ea',
  /** The facts panel. */
  panel: '#f4f8f7',
  bandMuted: '#8fb3a8',
  /** White on this green is 5.2:1 (AA). */
  button: '#0b7a61',
  codeBg: '#eef7f4',
  codeText: '#06121b',
};
const FONT = "'Segoe UI','Helvetica Neue',Arial,'Noto Sans Thai','Noto Sans SC',sans-serif";

function render(body: Body, locale: MailLocale): Pick<MailMessage, 'subject' | 'text' | 'html'> {
  const lang = locale === 'zh-CN' ? 'zh-CN' : locale;
  const text = [
    body.heading,
    '',
    ...body.paragraphs.flatMap((p) => [p, '']),
    ...(body.code ? [`${body.code.label}: ${body.code.value}`, ''] : []),
    ...(body.facts?.length ? [FACTS_TITLE[locale], ...body.facts.map((f) => `• ${f}`), ''] : []),
    ...(body.action ? [`${body.action.label}:`, body.action.url, ''] : []),
    '—',
    body.footer,
    SIGNATURE,
  ].join('\n');

  const c = COLORS;
  const row = (content: string, style = '') =>
    `<tr><td style="padding:0 32px;${style}">${content}</td></tr>`;
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escape(body.subject)}</title></head>
<body style="margin:0;padding:0;background:${c.page};font-family:${FONT};color:${c.heading};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(body.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${c.card};border-radius:16px;overflow:hidden;border:1px solid ${c.rule}">
<tr><td style="background:${c.band};padding:20px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;font-weight:700;letter-spacing:.16em;color:${c.bandText}">PDA BLISS <span style="color:${c.accent}">CORE</span></td><td align="right" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${c.bandMuted}">${escape(KIND[body.kind][locale])}</td></tr></table></td></tr>
${row(`<h1 style="margin:0;font-size:24px;line-height:1.35;font-weight:600;letter-spacing:-.01em;color:${c.heading}">${escape(body.heading)}</h1>`, 'padding-top:28px')}
${body.paragraphs.map((p) => row(`<p style="margin:0;font-size:15px;line-height:1.7;color:${c.body}">${escape(p)}</p>`, 'padding-top:12px')).join('\n')}
${
  body.code
    ? row(
        `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted}">${escape(body.code.label)}</p><div style="display:inline-block;font-family:Consolas,'Courier New',monospace;font-size:32px;line-height:1;letter-spacing:.32em;font-weight:700;color:${c.codeText};background:${c.codeBg};border-radius:12px;padding:16px 20px 16px 26px">${escape(body.code.value)}</div>`,
        'padding-top:22px',
      )
    : ''
}
${
  body.action
    ? row(
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${c.button}"><a href="${escape(body.action.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px">${escape(body.action.label)}</a></td></tr></table>`,
        'padding-top:24px',
      )
    : ''
}
${
  body.facts?.length
    ? row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.panel};border-radius:12px"><tr><td colspan="2" style="padding:14px 16px 0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${c.muted}">${escape(FACTS_TITLE[locale])}</td></tr>${body.facts
          .map(
            (f) =>
              `<tr><td width="34" valign="top" style="padding:8px 0 0 16px;font-size:14px;line-height:1.6;color:${c.button}">•</td><td style="padding:8px 16px 0 0;font-size:14px;line-height:1.6;color:${c.body}">${escape(f)}</td></tr>`,
          )
          .join('')}<tr><td colspan="2" style="padding:0 0 14px"></td></tr></table>`,
        'padding-top:24px',
      )
    : ''
}
${
  body.action
    ? row(
        `<p style="margin:0;font-size:12px;line-height:1.6;color:${c.muted}">${escape(FALLBACK[locale])}<br><a href="${escape(body.action.url)}" style="color:${c.muted};word-break:break-all">${escape(body.action.url)}</a></p>`,
        'padding-top:22px',
      )
    : ''
}
${row(`<p style="margin:0;padding-top:16px;border-top:1px solid ${c.rule};font-size:12px;line-height:1.6;color:${c.muted}">${escape(body.footer)}</p><p style="margin:8px 0 0;font-size:11px;letter-spacing:.04em;color:${c.muted}">${SIGNATURE}</p>`, 'padding-top:22px;padding-bottom:28px')}
</table></td></tr></table></body></html>`;

  return { subject: body.subject, text, html };
}

type Rendered = Pick<MailMessage, 'subject' | 'text' | 'html'>;

export function verifyEmailMail(locale: MailLocale, url: string): Rendered {
  const copy = {
    th: {
      subject: 'ยืนยันอีเมลของคุณ — PDA BLISS CORE',
      heading: 'ยืนยันอีเมลเพื่อเปิดใช้บัญชี',
      preheader: 'ยืนยันอีเมลเพื่อเริ่มใช้ PDA BLISS CORE — ลิงก์ใช้ได้ 24 ชั่วโมง',
      paragraphs: ['กดปุ่มด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ แล้วเข้าสู่ระบบเพื่อไปต่อ'],
      facts: [
        'ลิงก์ใช้ได้ครั้งเดียว และหมดอายุใน 24 ชั่วโมง',
        'หากคุณไม่ได้สมัคร PDA BLISS CORE ไม่ต้องดำเนินการใด ๆ',
      ],
      label: 'ยืนยันอีเมล',
    },
    en: {
      subject: 'Verify your email — PDA BLISS CORE',
      heading: 'Verify your email to activate your account',
      preheader: 'Verify your email to start with PDA BLISS CORE — the link is valid for 24 hours',
      paragraphs: ['Confirm that this address is yours, then sign in to continue.'],
      facts: [
        'The link works once and expires in 24 hours.',
        'If you did not sign up for PDA BLISS CORE, no action is needed.',
      ],
      label: 'Verify email',
    },
    'zh-CN': {
      subject: '验证您的邮箱 — PDA BLISS CORE',
      heading: '验证邮箱以启用账户',
      preheader: '验证邮箱以开始使用 PDA BLISS CORE — 链接 24 小时内有效',
      paragraphs: ['请确认此邮箱属于您，然后登录继续。'],
      facts: ['链接仅可使用一次，24 小时后失效。', '如果您没有注册 PDA BLISS CORE，无需任何操作。'],
      label: '验证邮箱',
    },
  }[locale];
  return render(
    { ...copy, kind: 'verification', action: { label: copy.label, url }, footer: FOOTER[locale] },
    locale,
  );
}

export function otpMail(locale: MailLocale, code: string, purpose: 'login' | 'step_up'): Rendered {
  const copy = {
    th: {
      subject: `${code} คือรหัสยืนยันของคุณ — PDA BLISS CORE`,
      heading: purpose === 'login' ? 'รหัสยืนยันการเข้าสู่ระบบ' : 'รหัสยืนยันรายการสำคัญ',
      preheader:
        purpose === 'login'
          ? 'รหัสสำหรับเข้าสู่ระบบ PDA BLISS CORE — ใช้ได้ 10 นาที'
          : 'รหัสยืนยันรายการสำคัญ — ใช้ได้ 10 นาที',
      paragraphs: [
        purpose === 'login'
          ? 'กรอกรหัสนี้ในหน้าเข้าสู่ระบบเพื่อยืนยันว่าเป็นคุณ'
          : 'กรอกรหัสนี้เพื่อยืนยันรายการสำคัญในศูนย์ควบคุม',
      ],
      codeLabel: 'รหัสยืนยัน',
      facts: [
        'รหัสหมดอายุใน 10 นาที และใช้ได้ครั้งเดียว',
        'อย่าบอกรหัสนี้กับใคร — ทีม PDA BLISS จะไม่ขอรหัสนี้จากคุณ',
        purpose === 'login'
          ? 'หากคุณไม่ได้พยายามเข้าสู่ระบบ ให้เปลี่ยนรหัสผ่านของคุณ'
          : 'หากคุณไม่ได้ทำรายการนี้ ให้เปลี่ยนรหัสผ่านของคุณ',
      ],
    },
    en: {
      subject: `${code} is your verification code — PDA BLISS CORE`,
      heading: purpose === 'login' ? 'Your sign-in code' : 'Your code for a sensitive action',
      preheader:
        purpose === 'login'
          ? 'Your PDA BLISS CORE sign-in code — valid for 10 minutes'
          : 'Your code for a sensitive action — valid for 10 minutes',
      paragraphs: [
        purpose === 'login'
          ? 'Enter this code on the sign-in page to confirm it is you.'
          : 'Enter this code to confirm a sensitive action in the control center.',
      ],
      codeLabel: 'Verification code',
      facts: [
        'The code expires in 10 minutes and works once.',
        'Do not share it — the PDA BLISS team will never ask you for it.',
        purpose === 'login'
          ? 'If you were not trying to sign in, change your password.'
          : 'If you did not start this action, change your password.',
      ],
    },
    'zh-CN': {
      subject: `${code} 是您的验证码 — PDA BLISS CORE`,
      heading: purpose === 'login' ? '登录验证码' : '重要操作验证码',
      preheader:
        purpose === 'login'
          ? 'PDA BLISS CORE 登录验证码 — 10 分钟内有效'
          : '重要操作验证码 — 10 分钟内有效',
      paragraphs: [
        purpose === 'login'
          ? '请在登录页面输入此验证码，确认是您本人。'
          : '请输入此验证码以确认控制中心的重要操作。',
      ],
      codeLabel: '验证码',
      facts: [
        '验证码 10 分钟后失效，且仅可使用一次。',
        '请勿告诉任何人——PDA BLISS 团队绝不会向您索取验证码。',
        purpose === 'login'
          ? '如果您没有尝试登录，请修改密码。'
          : '如果这不是您本人发起的操作，请修改密码。',
      ],
    },
  }[locale];
  return render(
    {
      ...copy,
      kind: 'security',
      code: { label: copy.codeLabel, value: code },
      footer: FOOTER[locale],
    },
    locale,
  );
}

export function passwordResetMail(locale: MailLocale, url: string): Rendered {
  const copy = {
    th: {
      subject: 'ตั้งรหัสผ่านใหม่ — PDA BLISS CORE',
      heading: 'คำขอตั้งรหัสผ่านใหม่',
      preheader: 'ลิงก์ตั้งรหัสผ่านใหม่สำหรับ PDA BLISS CORE — ใช้ได้ 30 นาที',
      paragraphs: ['มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อเลือกรหัสผ่านใหม่'],
      facts: [
        'ลิงก์ใช้ได้ครั้งเดียว และหมดอายุใน 30 นาที',
        'เมื่อตั้งรหัสผ่านใหม่แล้ว ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ',
        'หากคุณไม่ได้ขอ ไม่ต้องทำอะไร — รหัสผ่านเดิมยังใช้ได้',
      ],
      label: 'ตั้งรหัสผ่านใหม่',
    },
    en: {
      subject: 'Reset your password — PDA BLISS CORE',
      heading: 'Password reset request',
      preheader: 'Your PDA BLISS CORE password reset link — valid for 30 minutes',
      paragraphs: [
        'Someone asked to reset the password of this account. Choose a new one with the button below.',
      ],
      facts: [
        'The link works once and expires in 30 minutes.',
        'After the reset, every device that is signed in will be signed out.',
        'If you did not ask for this, do nothing — your current password keeps working.',
      ],
      label: 'Set a new password',
    },
    'zh-CN': {
      subject: '重置密码 — PDA BLISS CORE',
      heading: '重置密码请求',
      preheader: 'PDA BLISS CORE 密码重置链接 — 30 分钟内有效',
      paragraphs: ['有人申请重置此账户的密码。请点击下方按钮设置新密码。'],
      facts: [
        '链接仅可使用一次，30 分钟后失效。',
        '重置后，所有已登录的设备都将退出登录。',
        '如果不是您本人申请，无需任何操作——当前密码仍然有效。',
      ],
      label: '设置新密码',
    },
  }[locale];
  return render(
    { ...copy, kind: 'security', action: { label: copy.label, url }, footer: FOOTER[locale] },
    locale,
  );
}

export function passwordChangedMail(locale: MailLocale, url: string): Rendered {
  const copy = {
    th: {
      subject: 'รหัสผ่านของคุณถูกเปลี่ยนแล้ว — PDA BLISS CORE',
      heading: 'รหัสผ่านถูกเปลี่ยนแล้ว',
      preheader: 'รหัสผ่าน PDA BLISS CORE ของคุณเพิ่งถูกเปลี่ยน',
      paragraphs: [
        'รหัสผ่านบัญชี PDA BLISS CORE ของคุณเพิ่งถูกตั้งใหม่ และทุกอุปกรณ์ถูกออกจากระบบแล้ว',
        'หากคุณไม่ได้ทำรายการนี้ ให้ขอตั้งรหัสผ่านใหม่ทันทีและติดต่อทีม PDA BLISS',
      ],
      label: 'ไปที่หน้าเข้าสู่ระบบ',
    },
    en: {
      subject: 'Your password was changed — PDA BLISS CORE',
      heading: 'Your password was changed',
      preheader: 'The password of your PDA BLISS CORE account was just changed',
      paragraphs: [
        'The password of your PDA BLISS CORE account was just reset, and every device was signed out.',
        'If this was not you, request a new password reset now and contact the PDA BLISS team.',
      ],
      label: 'Go to sign-in',
    },
    'zh-CN': {
      subject: '您的密码已更改 — PDA BLISS CORE',
      heading: '密码已更改',
      preheader: '您的 PDA BLISS CORE 密码刚刚被更改',
      paragraphs: [
        '您的 PDA BLISS CORE 账户密码刚刚被重置，所有设备均已退出登录。',
        '如果这不是您本人的操作，请立即重新申请重置密码并联系 PDA BLISS 团队。',
      ],
      label: '前往登录',
    },
  }[locale];
  return render(
    { ...copy, kind: 'security', action: { label: copy.label, url }, footer: FOOTER[locale] },
    locale,
  );
}

/** Sent instead of a second account when someone registers an address that already has one. */
export function existingAccountMail(locale: MailLocale, loginUrl: string): Rendered {
  const copy = {
    th: {
      subject: 'มีบัญชีนี้อยู่แล้ว — PDA BLISS CORE',
      heading: 'อีเมลนี้มีบัญชี PDA BLISS CORE อยู่แล้ว',
      preheader: 'มีการพยายามสมัครด้วยอีเมลที่มีบัญชีอยู่แล้ว',
      paragraphs: [
        'มีการพยายามสมัครสมาชิกด้วยอีเมลนี้ หากเป็นคุณ ให้เข้าสู่ระบบด้วยบัญชีเดิม หรือใช้ "ลืมรหัสผ่าน" หากจำรหัสผ่านไม่ได้',
        'หากไม่ใช่คุณ ไม่ต้องดำเนินการใด ๆ บัญชีของคุณไม่มีการเปลี่ยนแปลง',
      ],
      label: 'เข้าสู่ระบบ',
    },
    en: {
      subject: 'You already have an account — PDA BLISS CORE',
      heading: 'This email already has a PDA BLISS CORE account',
      preheader: 'Someone tried to register with an address that already has an account',
      paragraphs: [
        'Someone tried to register with this address. If it was you, sign in with your existing account, or use "Forgot password".',
        'If it was not you, no action is needed — nothing about your account changed.',
      ],
      label: 'Sign in',
    },
    'zh-CN': {
      subject: '您已拥有账户 — PDA BLISS CORE',
      heading: '此邮箱已注册 PDA BLISS CORE 账户',
      preheader: '有人尝试用已注册的邮箱再次注册',
      paragraphs: [
        '有人尝试使用此邮箱注册。如果是您本人，请直接使用现有账户登录，或使用"忘记密码"。',
        '如果不是您本人，无需任何操作——您的账户没有任何变化。',
      ],
      label: '登录',
    },
  }[locale];
  return render(
    {
      ...copy,
      kind: 'account',
      action: { label: copy.label, url: loginUrl },
      footer: FOOTER[locale],
    },
    locale,
  );
}

/** Company roles as an invitee reads them (EP25). */
const ROLE_NAMES: Record<string, Record<MailLocale, string>> = {
  SYSTEM_ADMIN: { th: 'ผู้ดูแลระบบของบริษัท', en: 'System Admin', 'zh-CN': '系统管理员' },
  EXECUTIVE: { th: 'ผู้บริหาร', en: 'Executive', 'zh-CN': '高管' },
  DEPARTMENT_MANAGER: { th: 'หัวหน้าแผนก', en: 'Department Manager', 'zh-CN': '部门经理' },
  DEPARTMENT_STAFF: { th: 'พนักงานแผนก', en: 'Department Staff', 'zh-CN': '部门员工' },
  VIEWER: { th: 'ผู้ดูข้อมูล', en: 'Viewer', 'zh-CN': '只读成员' },
};

const DATE_LOCALE: Record<MailLocale, string> = { th: 'th-TH', en: 'en-GB', 'zh-CN': 'zh-CN' };

export interface InvitationFacts {
  companyName: string;
  /** Who sent it (full name, or email for older accounts). */
  inviterName: string;
  role: string;
  expiresAt: Date;
  /** The company's time zone, so the expiry reads as local time. */
  timeZone: string;
  url: string;
}

export function invitationMail(locale: MailLocale, f: InvitationFacts): Rendered {
  const { companyName, inviterName } = f;
  const role = ROLE_NAMES[f.role]?.[locale] ?? f.role;
  const until = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: f.timeZone,
  }).format(f.expiresAt);
  const copy = {
    th: {
      subject: `คำเชิญเข้าร่วม ${companyName} บน PDA BLISS CORE`,
      heading: `คุณได้รับเชิญเข้าร่วม ${companyName}`,
      preheader: `${inviterName} เชิญคุณเข้าร่วม ${companyName} — ใช้ได้ 7 วัน`,
      paragraphs: [
        `${inviterName} เชิญคุณเข้าร่วม ${companyName} บน PDA BLISS CORE ในบทบาท ${role}`,
        'เข้าสู่ระบบหรือสมัครด้วยอีเมลนี้ แล้วกดยอมรับคำเชิญ',
      ],
      facts: [
        `ใช้ได้ถึง ${until} และใช้ได้ครั้งเดียว`,
        'ต้องใช้บัญชีที่ใช้อีเมลนี้เท่านั้น',
        'หากคุณไม่รู้จักบริษัทหรือผู้เชิญ ไม่ต้องดำเนินการใด ๆ — คำเชิญจะหมดอายุเอง',
      ],
      label: 'ดูคำเชิญ',
    },
    en: {
      subject: `Invitation to join ${companyName} on PDA BLISS CORE`,
      heading: `You are invited to join ${companyName}`,
      preheader: `${inviterName} invited you to ${companyName} — valid for 7 days`,
      paragraphs: [
        `${inviterName} invited you to join ${companyName} on PDA BLISS CORE as ${role}.`,
        'Sign in or register with this email address, then accept the invitation.',
      ],
      facts: [
        `Valid until ${until}, and it works once.`,
        'Only an account with this email address can accept it.',
        'If you do not know this company or the sender, do nothing — the invitation expires on its own.',
      ],
      label: 'View invitation',
    },
    'zh-CN': {
      subject: `邀请您加入 PDA BLISS CORE 上的 ${companyName}`,
      heading: `您受邀加入 ${companyName}`,
      preheader: `${inviterName} 邀请您加入 ${companyName} — 7 天内有效`,
      paragraphs: [
        `${inviterName} 邀请您以「${role}」身份加入 PDA BLISS CORE 上的 ${companyName}。`,
        '请使用此邮箱登录或注册，然后接受邀请。',
      ],
      facts: [
        `有效期至 ${until}，仅可使用一次。`,
        '只有使用此邮箱的账户才能接受邀请。',
        '如果您不认识该公司或邀请人，无需任何操作——邀请会自动失效。',
      ],
      label: '查看邀请',
    },
  }[locale];
  return render(
    {
      ...copy,
      kind: 'invitation',
      action: { label: copy.label, url: f.url },
      footer: FOOTER[locale],
    },
    locale,
  );
}

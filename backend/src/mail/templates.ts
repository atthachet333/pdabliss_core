import type { MailMessage } from './mailer.js';

/*
 * Transactional email templates (EP23). Thai first, with English and
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

interface Body {
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  code?: string;
  footer: string;
}

const FOOTER: Record<MailLocale, string> = {
  th: 'อีเมลนี้ส่งจาก PDA BLISS CORE โดยอัตโนมัติ กรุณาอย่าตอบกลับ หากคุณไม่ได้ทำรายการนี้ ไม่ต้องดำเนินการใด ๆ',
  en: 'This email was sent automatically by PDA BLISS CORE. Please do not reply. If you did not request this, you can ignore it.',
  'zh-CN': '本邮件由 PDA BLISS CORE 自动发送，请勿回复。如果这不是您本人的操作，请忽略本邮件。',
};

function render(body: Body, locale: MailLocale): Pick<MailMessage, 'subject' | 'text' | 'html'> {
  const lang = locale === 'zh-CN' ? 'zh-CN' : locale;
  const text = [
    body.heading,
    '',
    ...body.paragraphs.flatMap((p) => [p, '']),
    ...(body.code ? [body.code, ''] : []),
    ...(body.action ? [`${body.action.label}: ${body.action.url}`, ''] : []),
    '—',
    body.footer,
  ].join('\n');

  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(body.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f3f6f7;font-family:'IBM Plex Sans Thai','Segoe UI',Arial,sans-serif;color:#0b1a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:12px;letter-spacing:.14em;color:#0e8c6f;font-weight:600">PDA BLISS CORE</td></tr>
<tr><td style="padding-top:12px;font-size:20px;font-weight:600;line-height:1.4">${escape(body.heading)}</td></tr>
${body.paragraphs.map((p) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.7;color:#33454f">${escape(p)}</td></tr>`).join('\n')}
${body.code ? `<tr><td style="padding-top:20px"><div style="display:inline-block;font-family:Consolas,'Courier New',monospace;font-size:30px;letter-spacing:.3em;font-weight:700;background:#eef7f4;border-radius:12px;padding:12px 18px">${escape(body.code)}</div></td></tr>` : ''}
${
  body.action
    ? `<tr><td style="padding-top:22px"><a href="${escape(body.action.url)}" style="display:inline-block;background:#0e8c6f;color:#ffffff;text-decoration:none;font-weight:600;border-radius:999px;padding:12px 22px">${escape(body.action.label)}</a></td></tr>
<tr><td style="padding-top:12px;font-size:12px;line-height:1.6;color:#62737c;word-break:break-all">${escape(body.action.url)}</td></tr>`
    : ''
}
<tr><td style="padding-top:24px;border-top:1px solid #e3eaec;font-size:12px;line-height:1.6;color:#62737c">${escape(body.footer)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: body.subject, text, html };
}

type Rendered = Pick<MailMessage, 'subject' | 'text' | 'html'>;

export function verifyEmailMail(locale: MailLocale, url: string): Rendered {
  const copy = {
    th: {
      subject: 'ยืนยันอีเมลของคุณ — PDA BLISS CORE',
      heading: 'ยืนยันอีเมลเพื่อเปิดใช้บัญชี',
      paragraphs: [
        'กดปุ่มด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 24 ชั่วโมง',
      ],
      label: 'ยืนยันอีเมล',
    },
    en: {
      subject: 'Verify your email — PDA BLISS CORE',
      heading: 'Verify your email to activate your account',
      paragraphs: [
        'Confirm that this address is yours. The link works once and expires in 24 hours.',
      ],
      label: 'Verify email',
    },
    'zh-CN': {
      subject: '验证您的邮箱 — PDA BLISS CORE',
      heading: '验证邮箱以启用账户',
      paragraphs: ['请确认此邮箱属于您。链接仅可使用一次，24 小时后失效。'],
      label: '验证邮箱',
    },
  }[locale];
  return render({ ...copy, action: { label: copy.label, url }, footer: FOOTER[locale] }, locale);
}

export function otpMail(locale: MailLocale, code: string, purpose: 'login' | 'step_up'): Rendered {
  const copy = {
    th: {
      subject: `${code} คือรหัสยืนยันของคุณ — PDA BLISS CORE`,
      heading: purpose === 'login' ? 'รหัสยืนยันการเข้าสู่ระบบ' : 'รหัสยืนยันรายการสำคัญ',
      paragraphs: [
        'ใช้รหัสนี้ภายใน 10 นาที รหัสใช้ได้ครั้งเดียว และ PDA BLISS จะไม่ขอรหัสนี้จากคุณ',
      ],
    },
    en: {
      subject: `${code} is your verification code — PDA BLISS CORE`,
      heading: purpose === 'login' ? 'Your sign-in code' : 'Your code for a sensitive action',
      paragraphs: [
        'Use it within 10 minutes. It works once, and PDA BLISS will never ask you for it.',
      ],
    },
    'zh-CN': {
      subject: `${code} 是您的验证码 — PDA BLISS CORE`,
      heading: purpose === 'login' ? '登录验证码' : '重要操作验证码',
      paragraphs: ['请在 10 分钟内使用。验证码仅可使用一次，PDA BLISS 不会向您索取此验证码。'],
    },
  }[locale];
  return render({ ...copy, code, footer: FOOTER[locale] }, locale);
}

export function passwordResetMail(locale: MailLocale, url: string): Rendered {
  const copy = {
    th: {
      subject: 'ตั้งรหัสผ่านใหม่ — PDA BLISS CORE',
      heading: 'คำขอตั้งรหัสผ่านใหม่',
      paragraphs: [
        'กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 30 นาที',
        'เมื่อตั้งรหัสผ่านใหม่แล้ว ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ',
      ],
      label: 'ตั้งรหัสผ่านใหม่',
    },
    en: {
      subject: 'Reset your password — PDA BLISS CORE',
      heading: 'Password reset request',
      paragraphs: [
        'Choose a new password with the button below. The link works once and expires in 30 minutes.',
        'After the reset, every device that is signed in will be signed out.',
      ],
      label: 'Set a new password',
    },
    'zh-CN': {
      subject: '重置密码 — PDA BLISS CORE',
      heading: '重置密码请求',
      paragraphs: [
        '请点击下方按钮设置新密码。链接仅可使用一次，30 分钟后失效。',
        '重置后，所有已登录的设备都将退出登录。',
      ],
      label: '设置新密码',
    },
  }[locale];
  return render({ ...copy, action: { label: copy.label, url }, footer: FOOTER[locale] }, locale);
}

export function passwordChangedMail(locale: MailLocale, url: string): Rendered {
  const copy = {
    th: {
      subject: 'รหัสผ่านของคุณถูกเปลี่ยนแล้ว — PDA BLISS CORE',
      heading: 'รหัสผ่านถูกเปลี่ยนแล้ว',
      paragraphs: [
        'รหัสผ่านบัญชี PDA BLISS CORE ของคุณเพิ่งถูกตั้งใหม่ และทุกอุปกรณ์ถูกออกจากระบบแล้ว',
        'หากคุณไม่ได้ทำรายการนี้ ให้ขอตั้งรหัสผ่านใหม่ทันทีและติดต่อทีม PDA BLISS',
      ],
      label: 'ไปที่หน้าเข้าสู่ระบบ',
    },
    en: {
      subject: 'Your password was changed — PDA BLISS CORE',
      heading: 'Your password was changed',
      paragraphs: [
        'The password of your PDA BLISS CORE account was just reset, and every device was signed out.',
        'If this was not you, request a new password reset now and contact the PDA BLISS team.',
      ],
      label: 'Go to sign-in',
    },
    'zh-CN': {
      subject: '您的密码已更改 — PDA BLISS CORE',
      heading: '密码已更改',
      paragraphs: [
        '您的 PDA BLISS CORE 账户密码刚刚被重置，所有设备均已退出登录。',
        '如果这不是您本人的操作，请立即重新申请重置密码并联系 PDA BLISS 团队。',
      ],
      label: '前往登录',
    },
  }[locale];
  return render({ ...copy, action: { label: copy.label, url }, footer: FOOTER[locale] }, locale);
}

/** Sent instead of a second account when someone registers an address that already has one. */
export function existingAccountMail(locale: MailLocale, loginUrl: string): Rendered {
  const copy = {
    th: {
      subject: 'มีบัญชีนี้อยู่แล้ว — PDA BLISS CORE',
      heading: 'อีเมลนี้มีบัญชี PDA BLISS CORE อยู่แล้ว',
      paragraphs: [
        'มีการพยายามสมัครสมาชิกด้วยอีเมลนี้ หากเป็นคุณ ให้เข้าสู่ระบบด้วยบัญชีเดิม หรือใช้ "ลืมรหัสผ่าน" หากจำรหัสผ่านไม่ได้',
        'หากไม่ใช่คุณ ไม่ต้องดำเนินการใด ๆ บัญชีของคุณไม่มีการเปลี่ยนแปลง',
      ],
      label: 'เข้าสู่ระบบ',
    },
    en: {
      subject: 'You already have an account — PDA BLISS CORE',
      heading: 'This email already has a PDA BLISS CORE account',
      paragraphs: [
        'Someone tried to register with this address. If it was you, sign in with your existing account, or use "Forgot password".',
        'If it was not you, no action is needed — nothing about your account changed.',
      ],
      label: 'Sign in',
    },
    'zh-CN': {
      subject: '您已拥有账户 — PDA BLISS CORE',
      heading: '此邮箱已注册 PDA BLISS CORE 账户',
      paragraphs: [
        '有人尝试使用此邮箱注册。如果是您本人，请直接使用现有账户登录，或使用"忘记密码"。',
        '如果不是您本人，无需任何操作——您的账户没有任何变化。',
      ],
      label: '登录',
    },
  }[locale];
  return render(
    { ...copy, action: { label: copy.label, url: loginUrl }, footer: FOOTER[locale] },
    locale,
  );
}

export function invitationMail(locale: MailLocale, companyName: string, url: string): Rendered {
  const copy = {
    th: {
      subject: `คำเชิญเข้าร่วม ${companyName} บน PDA BLISS CORE`,
      heading: `คุณได้รับเชิญเข้าร่วม ${companyName}`,
      paragraphs: [
        'เข้าสู่ระบบหรือสมัครด้วยอีเมลนี้ แล้วกดยอมรับคำเชิญ ลิงก์หมดอายุใน 7 วันและใช้ได้ครั้งเดียว',
      ],
      label: 'ดูคำเชิญ',
    },
    en: {
      subject: `Invitation to join ${companyName} on PDA BLISS CORE`,
      heading: `You are invited to join ${companyName}`,
      paragraphs: [
        'Sign in or register with this email address, then accept the invitation. The link expires in 7 days and works once.',
      ],
      label: 'View invitation',
    },
    'zh-CN': {
      subject: `邀请您加入 PDA BLISS CORE 上的 ${companyName}`,
      heading: `您受邀加入 ${companyName}`,
      paragraphs: ['请使用此邮箱登录或注册，然后接受邀请。链接 7 天后失效，且仅可使用一次。'],
      label: '查看邀请',
    },
  }[locale];
  return render({ ...copy, action: { label: copy.label, url }, footer: FOOTER[locale] }, locale);
}

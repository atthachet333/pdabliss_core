import type { Localized } from '@/i18n/useCopy';

/*
 * The companion panel beside the account screens on large displays (EP24.1).
 * Only safeguards that exist today (EP23 / EP24) — no certification,
 * uptime or "100 %" claims.
 */

const th = {
  label: 'เกี่ยวกับบัญชี PDA BLISS CORE',
  kicker: 'PDA BLISS CORE',
  title: 'ระบบงานของทุกแผนก เริ่มจากบัญชีที่ปลอดภัย',
  points: [
    { title: 'ยืนยันอีเมลทุกบัญชี', text: 'ลิงก์ใช้ได้ครั้งเดียว ภายในเวลาที่กำหนด' },
    {
      title: 'รหัสยืนยันทางอีเมล',
      text: 'เมื่อเข้าสู่ระบบจากเบราว์เซอร์ใหม่ และทุกครั้งสำหรับทีมแพลตฟอร์ม',
    },
    { title: 'ควบคุมเซสชันได้เอง', text: 'ดูอุปกรณ์ที่เข้าสู่ระบบ และออกจากระบบทุกเครื่องได้' },
    {
      title: 'บัญชีแยกจากบริษัท',
      text: 'สร้างบริษัทหลังยืนยันอีเมล และข้อมูลของแต่ละบริษัทแยกจากกัน',
    },
  ],
  maker: 'พัฒนาโดย PDA BLISS COMPANY LIMITED',
};

export type AuthAsideCopy = typeof th;

export const AUTH_ASIDE_COPY: Localized<AuthAsideCopy> = {
  th,
  en: {
    label: 'About your PDA BLISS CORE account',
    kicker: 'PDA BLISS CORE',
    title: 'Every department’s work, starting with a secure account',
    points: [
      { title: 'Every account verifies its email', text: 'Links work once, within a set time' },
      {
        title: 'Email verification codes',
        text: 'On a new browser — and on every sign-in for the platform team',
      },
      {
        title: 'You control your sessions',
        text: 'See which devices are signed in and sign out everywhere',
      },
      {
        title: 'Account and company stay separate',
        text: 'Create the company after verification; each company’s data is kept apart',
      },
    ],
    maker: 'Made by PDA BLISS COMPANY LIMITED',
  },
  'zh-CN': {
    label: '关于您的 PDA BLISS CORE 账户',
    kicker: 'PDA BLISS CORE',
    title: '各部门的工作，从一个安全的账户开始',
    points: [
      { title: '每个账户都需验证邮箱', text: '链接仅可使用一次，并在规定时间内有效' },
      { title: '邮件验证码', text: '在新浏览器登录时需要 — 平台团队每次登录都需要' },
      { title: '自行管理会话', text: '查看已登录的设备，并可在所有设备上退出' },
      { title: '账户与公司分开', text: '验证邮箱后再创建公司，各公司的数据彼此隔离' },
    ],
    maker: '由 PDA BLISS COMPANY LIMITED 开发',
  },
};

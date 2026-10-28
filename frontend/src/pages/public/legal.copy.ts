import { SITE } from '@/config/site';
import type { Localized } from '@/i18n/useCopy';

/** /privacy and /terms words (moved out of the page in EP17 for build-time metadata). */
export type LegalKind = 'privacy' | 'terms';

const th = {
  privacy: 'นโยบายความเป็นส่วนตัว',
  terms: 'ข้อกำหนดการใช้งาน',
  lead: (title: string) =>
    `เอกสาร${title}ฉบับทางการของ ${SITE.company} อยู่ระหว่างจัดทำ และจะเผยแพร่ก่อนเปิดให้บริการเชิงพาณิชย์`,
  body: 'เว็บไซต์ในช่วงพัฒนานี้ไม่มีการเก็บข้อมูลส่วนบุคคลผ่านแบบฟอร์ม และ PDA BLISS ไม่ได้ตั้งคุกกี้เพื่อการติดตาม',
  /** EP24.1.4.1: the Contact page loads Google Maps with the page. */
  maps: 'หน้า “ติดต่อเรา” แสดงแผนที่ Google Maps ซึ่งเป็นบริการของบุคคลที่สาม เมื่อเปิดหน้านี้ เบราว์เซอร์จะโหลดแผนที่จาก Google ซึ่งอาจได้รับข้อมูลทางเทคนิค เช่น ที่อยู่ IP และอาจใช้คุกกี้หรือเทคโนโลยีที่คล้ายกันตามนโยบายของ Google เอง โดย PDA BLISS ไม่ได้ควบคุมการใช้งานดังกล่าว',
};

export const LEGAL_COPY: Localized<typeof th> = {
  th,
  en: {
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    lead: (title) =>
      `The official ${title} of ${SITE.company} is being prepared and will be published before commercial launch.`,
    body: 'During this development phase, the website collects no personal data through forms, and PDA BLISS sets no tracking cookies.',
    maps: 'The Contact page shows an embedded Google Maps map, a third-party service. Opening that page loads the map from Google, which may receive technical information such as your IP address and may use cookies or similar technologies under Google’s own policies; PDA BLISS does not control that use.',
  },
  'zh-CN': {
    privacy: '隐私政策',
    terms: '使用条款',
    lead: (title) => `${SITE.company} 的正式${title}正在制定中，将在商业发布前公布。`,
    body: '在当前开发阶段，本网站不通过表单收集个人数据，PDA BLISS 也不设置追踪类 Cookie。',
    maps: '“联系我们”页面嵌入了第三方服务 Google 地图。打开该页面时会从 Google 加载地图，Google 可能会收到 IP 地址等技术信息，并可能根据其自身政策使用 Cookie 或类似技术；PDA BLISS 无法控制这些使用。',
  },
};

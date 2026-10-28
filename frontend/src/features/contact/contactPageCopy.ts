import type { Localized } from '@/i18n/useCopy';

/*
 * /contact words (EP24.1.4.3): a company contact page — how to reach
 * PDA BLISS, where it is, and the way into /consultation for people who are
 * not sure where to start. The consultation itself has its own copy
 * (copy.ts). Contact values come from CONTACT; the map words from
 * locationCopy.ts. Honest wording: no response times, no promised outcomes.
 */

const th = {
  meta: {
    title: 'ติดต่อ PDA BLISS — โทรศัพท์ LINE OA อีเมล และที่ตั้งบริษัท',
    description:
      'ติดต่อ PDA BLISS COMPANY LIMITED ทางโทรศัพท์ LINE OA หรืออีเมล ดูที่ตั้งบริษัทบนแผนที่ และเริ่มปรึกษาเมื่อยังไม่แน่ใจว่าควรเริ่มจากตรงไหน',
  },
  hero: {
    eyebrow: 'ติดต่อ',
    title: 'คุยกับ PDA BLISS',
    lead: 'มีคำถามเกี่ยวกับ CORE การนำระบบไปใช้ ความร่วมมือ หรือเรื่องทั่วไป ยินดีรับฟังทุกเรื่อง — เลือกช่องทางที่สะดวกได้เลย',
    signpost: 'ยังไม่แน่ใจว่าควรเริ่มตรงไหน? ปรึกษาแบบมีขั้นตอน',
  },
  direct: {
    title: 'ช่องทางติดต่อ',
    call: 'โทรศัพท์',
    line: 'LINE OA',
    email: 'อีเมล',
  },
  invite: {
    title: 'ยังไม่แน่ใจว่าควรเริ่มจากตรงไหน?',
    body: 'ไม่จำเป็นต้องรู้ชื่อฟีเจอร์หรือระบบก่อน บอกเราว่าองค์กรของคุณทำงานอย่างไร และจุดไหนกำลังติดขัด แล้วเราจะช่วยดูจุดเริ่มต้นที่เหมาะสม',
    cta: 'เริ่มปรึกษาเรา',
    path: 'หกขั้นสั้น ๆ — เริ่มจากเรื่องที่อยากคุย',
  },
  sections: { location: 'ที่ตั้งบริษัท', consult: 'ปรึกษา' },
};

export type ContactPageCopy = typeof th;

export const CONTACT_PAGE_COPY: Localized<ContactPageCopy> = {
  th,
  en: {
    meta: {
      title: 'Contact PDA BLISS — phone, LINE OA, email and our location',
      description:
        'Reach PDA BLISS COMPANY LIMITED by phone, LINE OA or email, see where we are on the map, and start a consultation if you are not sure where to begin.',
    },
    hero: {
      eyebrow: 'Contact',
      title: 'Talk to PDA BLISS',
      lead: 'Questions about CORE, implementation, partnership or anything else are welcome — use whichever channel suits you.',
      signpost: 'Not sure where to start? Guided consultation',
    },
    direct: {
      title: 'Ways to reach us',
      call: 'Phone',
      line: 'LINE OA',
      email: 'Email',
    },
    invite: {
      title: 'Not sure where to start?',
      body: 'You don’t need to know feature or system names first. Tell us how your organization works and where things get stuck, and we will help you look for a sensible starting point.',
      cta: 'Start a consultation',
      path: 'Six short steps — starting with what you want to talk about',
    },
    sections: { location: 'Location', consult: 'Consultation' },
  },
  'zh-CN': {
    meta: {
      title: '联系 PDA BLISS——电话、LINE OA、电子邮件与公司位置',
      description:
        '通过电话、LINE OA 或电子邮件联系 PDA BLISS COMPANY LIMITED，在地图上查看公司位置；如果还不确定从哪里开始，可以先开始咨询。',
    },
    hero: {
      eyebrow: '联系我们',
      title: '与 PDA BLISS 沟通',
      lead: '无论是关于 CORE、系统实施、合作，还是一般问题，都欢迎与我们联系——选择方便的渠道即可。',
      signpost: '不确定从哪里入手？查看引导式咨询',
    },
    direct: {
      title: '联系方式',
      call: '电话',
      line: 'LINE OA',
      email: '电子邮件',
    },
    invite: {
      title: '还不确定从哪里开始？',
      body: '无需先了解功能或系统名称。告诉我们贵组织如何运作、哪里遇到了阻碍，我们会帮助您找到合适的起点。',
      cta: '开始咨询',
      path: '六个简短步骤——从您想沟通的话题开始',
    },
    sections: { location: '公司位置', consult: '咨询' },
  },
};

import type { ShellMessages } from '../types';

/** Thai — the default public locale and the source language for the shell. */
export const th: ShellMessages = {
  shell: {
    skipToContent: 'ข้ามไปยังเนื้อหาหลัก',
    home: 'PDA BLISS CORE Department Operations — หน้าแรก',
  },
  header: {
    primaryNav: 'เมนูหลัก',
    openMenu: 'เปิดเมนู',
    closeMenu: 'ปิดเมนู',
    menuDialog: 'เมนู',
    login: 'เข้าสู่ระบบ',
    megaRegion: (label) => `เมนู${label}`,
    explore: 'ดูรายละเอียด',
  },
  language: {
    label: 'ภาษา',
    current: (name) => `ภาษา: ${name}`,
    note: 'ทั้งเว็บไซต์แสดงผลได้ 3 ภาษา — หน้าจอตัวอย่างของระบบยังเป็นภาษาไทยตามตัวผลิตภัณฑ์',
  },
  nav: {
    overview: 'ภาพรวม',
    contact: 'ติดต่อเรา',
    groups: {
      product: {
        label: 'ผลิตภัณฑ์',
        eyebrow: 'Product',
        heading: 'CORE คืออะไร\nและใช้งานอย่างไร',
        intro:
          'พื้นที่ทำงานของแต่ละแผนก เชื่อมกันด้วยข้อมูลชุดเดียว — ดูวิธีทำงาน ลองใช้จริง แล้วเลือกแพ็คเกจที่เหมาะ',
        sections: { understand: 'เข้าใจ CORE', start: 'ลองและเลือก', byDepartment: 'ดูตามแผนก' },
        items: {
          how: { label: 'CORE ทำงานอย่างไร', description: 'งานหนึ่งชิ้นเดินผ่านหลายแผนกอย่างไร' },
          departments: { label: 'แผนก', description: 'พื้นที่ทำงานตามหน้าที่ของแต่ละทีม' },
          demo: {
            label: 'ทดลองใช้งาน CORE',
            description: 'เดินงานหนึ่งชิ้นผ่านทุกแผนก — ไม่ต้องสมัคร',
          },
          pricing: { label: 'แพ็คเกจ', description: 'คิดต่อบริษัท ทุกสาขาอยู่ใน Workspace เดียว' },
          executive: { label: 'ผู้บริหาร' },
          sales: { label: 'ฝ่ายขาย' },
          operations: { label: 'ปฏิบัติการ' },
          warehouse: { label: 'คลังสินค้า' },
          purchasing: { label: 'จัดซื้อ' },
          accounting: { label: 'บัญชีและการเงิน' },
        },
        highlight: {
          eyebrow: 'CORE Demo',
          statement: 'ลองเดินงานหนึ่งชิ้น\nผ่านทุกแผนกด้วยตัวเอง',
          body: 'สลับบทบาทได้ระหว่างทาง แล้วดูว่าแต่ละแผนกเห็นอะไร',
          cta: 'เปิด CORE Demo',
        },
      },
      solutions: {
        label: 'โซลูชัน',
        eyebrow: 'Solutions',
        heading: 'CORE เข้ากับ\nธุรกิจของคุณตรงไหน',
        intro: 'เริ่มจากปัญหาที่เจออยู่จริง ประเภทธุรกิจ และขนาดขององค์กร',
        sections: { fit: 'เริ่มจากองค์กรของคุณ', byIndustry: 'ตามประเภทธุรกิจ' },
        items: {
          problems: {
            label: 'ปัญหาที่ CORE ช่วยจัดการ',
            description: 'งานตกหล่น Human Error การอนุมัติ และสถานะที่มองไม่เห็น',
          },
          industries: {
            label: 'ประเภทธุรกิจ',
            description: 'หลักการเดียวกัน แต่แต่ละธุรกิจทำงานไม่เหมือนกัน',
          },
          enterprise: {
            label: 'สำหรับองค์กร',
            description: 'การควบคุม สิทธิ์ และการนำไปใช้เมื่อองค์กรเติบโต',
          },
          distribution: { label: 'กระจายสินค้า / ค้าส่ง' },
          services: { label: 'ธุรกิจบริการ' },
          projects: { label: 'ธุรกิจโครงการ' },
          retail: { label: 'ธุรกิจค้าปลีก' },
          property: { label: 'อสังหาริมทรัพย์ / งานปฏิบัติการ' },
          manufacturing: { label: 'การผลิต' },
        },
        highlight: {
          eyebrow: 'Built around your process',
          statement: 'ปัญหาของแต่ละองค์กรไม่เหมือนกัน',
          body: 'CORE ถูกออกแบบให้เริ่มจากกระบวนการจริงขององค์กร ไม่ใช่บังคับทุกบริษัทให้ใช้วิธีเดียวกัน',
          cta: 'ดูตามประเภทธุรกิจ',
        },
      },
      resources: {
        label: 'ความรู้',
        eyebrow: 'Resources',
        heading: 'เข้าใจระบบ\nก่อนตัดสินใจใช้ระบบ',
        intro:
          'คู่มือที่อธิบายแนวคิด Workflow การควบคุมงาน และการเตรียมองค์กร — มีประโยชน์แม้ยังไม่ได้ใช้ CORE',
        sections: { start: 'เริ่มที่นี่', concepts: 'แนวคิดหลัก', reference: 'อ้างอิง' },
        items: {
          start: {
            label: 'เริ่มต้นกับ CORE',
            description: 'CORE คืออะไร ไม่ใช่อะไร และควรเริ่มจากตรงไหน',
          },
          workflow: {
            label: 'Workflow & Operations',
            description: 'งานหนึ่งชิ้นเดินผ่านเจ้าของงาน สถานะ และการส่งต่ออย่างไร',
          },
          humanError: {
            label: 'Human Error',
            description: 'ป้องกัน ตรวจพบ แจ้งเตือน ควบคุม และย้อนรอยความผิดพลาด',
          },
          warehousePrivacy: {
            label: 'Warehouse Privacy',
            description: 'ทำไมคลังสินค้าไม่เห็นราคา และขอบเขตนี้ควรบังคับใช้ที่ไหน',
          },
          implementation: { label: 'Implementation Guide' },
          security: { label: 'Security & Data' },
          glossary: { label: 'CORE Glossary' },
        },
        highlight: {
          eyebrow: 'Resource Center',
          statement: 'เจ็ดคู่มือที่เขียนจริงทุกเรื่อง\nค้นหาได้ทันที',
          body: 'เริ่มจากคำถาม ปัญหา แผนก หรือช่วงขององค์กรที่คุณอยู่',
          cta: 'เปิดคลังความรู้',
        },
      },
      about: {
        label: 'เกี่ยวกับเรา',
        eyebrow: 'About',
        heading: 'ทีมที่อยู่เบื้องหลัง CORE',
        intro:
          'รู้จักบริษัทผู้พัฒนา PDA BLISS CORE แนวคิด และวิธีที่เราออกแบบระบบให้เข้ากับการทำงานจริง',
        sections: { company: 'PDA BLISS', more: 'วิธีที่เราทำงาน' },
        items: {
          company: { label: 'PDA BLISS', description: 'รู้จักบริษัทและแนวคิดของเรา' },
          why: { label: 'ทำไมเราถึงสร้าง CORE', description: 'ที่มาและปัญหาที่เราอยากแก้' },
          security: {
            label: 'Security & Trust',
            description: 'ใครเห็นอะไร และสิ่งที่เรายังไม่อ้าง',
          },
          approach: { label: 'แนวทางการพัฒนาระบบ' },
        },
        highlight: {
          eyebrow: 'PDA BLISS COMPANY LIMITED',
          statement:
            'เราไม่ได้มอง Software เป็นเพียงหน้าจอ\nแต่เป็นส่วนหนึ่งของวิธีที่องค์กรทำงานจริง',
          cta: 'การวางระบบและคำปรึกษา',
        },
      },
    },
  },
  footer: {
    lead: 'Department Operations Platform สำหรับองค์กร',
    description:
      'ออกแบบพื้นที่ทำงานให้เหมาะกับแต่ละแผนก พร้อมเชื่อมคน งาน ข้อมูล และกระบวนการไว้ใน CORE เดียว',
    developedBy: 'พัฒนาโดย PDA BLISS COMPANY LIMITED',
    groups: { product: 'ผลิตภัณฑ์', explore: 'สำรวจ' },
    links: {
      departments: 'แผนก',
      howItWorks: 'วิธีการทำงาน',
      demo: 'ทดลองใช้งาน CORE',
      pricing: 'แพ็คเกจ',
      solutions: 'โซลูชัน',
      industries: 'ประเภทธุรกิจ',
      enterprise: 'สำหรับองค์กร',
      resources: 'คลังความรู้',
      about: 'เกี่ยวกับเรา',
    },
    contactHeading: 'ติดต่อเรา',
    talk: 'คุยกับทีม PDA BLISS',
    address: 'ที่อยู่',
    phone: 'โทรศัพท์',
    emailLabel: 'อีเมล',
    lineLabel: 'LINE Official Account',
    rightsReserved: 'All rights reserved.',
    legal: 'ข้อมูลทางกฎหมาย',
    privacy: 'นโยบายความเป็นส่วนตัว',
    terms: 'ข้อกำหนดการใช้งาน',
    cookieSettings: 'การตั้งค่าคุกกี้',
  },
  contact: {
    phoneLabel: 'คุณวิน',
    lineLabel: 'LINE OA',
    opensInNewTab: '(เปิดในแท็บใหม่)',
  },
  utility: {
    label: 'เครื่องมือด่วน',
    backToTop: 'กลับขึ้นด้านบน',
    openContact: 'เปิดช่องทางติดต่อ',
    closeContact: 'ปิดช่องทางติดต่อ',
    panelTitle: 'ติดต่อทีม PDA BLISS',
    panelIntro: 'เลือกช่องทางที่สะดวกสำหรับคุณ',
    call: 'โทรหาเรา',
    line: 'LINE OA',
    email: 'ส่งอีเมล',
    consult: 'ขอรับคำปรึกษา',
    consultDetail: 'นัดหมายพูดคุยกับทีม PDA BLISS',
  },
  cookie: {
    region: 'ความยินยอมการใช้คุกกี้',
    title: 'คุกกี้และความเป็นส่วนตัว',
    body: 'เราใช้เฉพาะคุกกี้ที่จำเป็นต่อการทำงานของเว็บไซต์ คุกกี้ประเภทอื่นจะใช้เมื่อคุณอนุญาตเท่านั้น',
    note: 'ขณะนี้เว็บไซต์ยังไม่ได้ใช้คุกกี้วิเคราะห์หรือคุกกี้การตลาด',
    acceptAll: 'ยอมรับทั้งหมด',
    rejectNonEssential: 'ปฏิเสธคุกกี้ที่ไม่จำเป็น',
    settings: 'ตั้งค่าคุกกี้',
    privacyLink: 'นโยบายความเป็นส่วนตัว',
    prefsTitle: 'การตั้งค่าคุกกี้',
    prefsIntro:
      'เลือกประเภทคุกกี้ที่คุณอนุญาต การตั้งค่าจะถูกบันทึกไว้ในเบราว์เซอร์นี้เท่านั้น และเปลี่ยนได้ทุกเมื่อจากส่วนท้ายของเว็บไซต์',
    alwaysOn: 'เปิดใช้งานเสมอ',
    inUse: 'ใช้งานอยู่',
    notInUse: 'ยังไม่ได้ใช้งานบนเว็บไซต์นี้',
    save: 'บันทึกการตั้งค่า',
    close: 'ปิดการตั้งค่าคุกกี้',
    saved: 'บันทึกการตั้งค่าคุกกี้แล้ว',
    categories: {
      essential: {
        title: 'คุกกี้ที่จำเป็น',
        subtitle: 'Essential',
        description:
          'จำเป็นต่อการทำงานพื้นฐานของเว็บไซต์ เช่น การจดจำการตั้งค่าคุกกี้ของคุณ จึงไม่สามารถปิดได้',
      },
      analytics: {
        title: 'คุกกี้วิเคราะห์การใช้งาน',
        subtitle: 'Analytics',
        description:
          'ช่วยให้เราเข้าใจว่าผู้เข้าชมใช้งานเว็บไซต์อย่างไร เพื่อนำไปปรับปรุงประสบการณ์',
      },
      preferences: {
        title: 'คุกกี้เพื่อประสบการณ์การใช้งาน',
        subtitle: 'Preferences',
        description: 'จดจำตัวเลือกของคุณ เพื่อให้การใช้งานครั้งถัดไปสะดวกขึ้น',
      },
      marketing: {
        title: 'คุกกี้การตลาด',
        subtitle: 'Marketing',
        description: 'ใช้เพื่อแสดงเนื้อหาหรือโฆษณาที่เกี่ยวข้องกับความสนใจของคุณ',
      },
    },
  },
};

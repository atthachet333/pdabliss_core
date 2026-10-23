import type { ShellMessages } from '../types';

/** Thai — the default public locale and the source language for the shell. */
export const th: ShellMessages = {
  shell: {
    skipToContent: 'ข้ามไปยังเนื้อหาหลัก',
    home: 'PDA BLISS CORE หน้าแรก',
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
    plannedTag: 'อยู่ในแผนพัฒนา',
    groups: {
      departments: {
        label: 'แผนก',
        eyebrow: 'Departments',
        heading: 'ทำงานตามหน้าที่ของแต่ละแผนก',
        intro:
          'CORE ออกแบบพื้นที่ทำงานให้เหมาะกับหน้าที่และความรับผิดชอบของแต่ละทีม โดยทุกแผนกยังเชื่อมต่อกันบนข้อมูลชุดเดียว',
        items: {
          executive: {
            label: 'ผู้บริหาร',
            description: 'เห็นภาพรวม ปัญหา และสถานะสำคัญของทั้งองค์กร',
          },
          sales: { label: 'ฝ่ายขาย', description: 'รับออเดอร์ ติดตามสถานะ และการส่งมอบ' },
          operations: {
            label: 'ฝ่ายปฏิบัติการ',
            description: 'วางแผน ติดตามงาน และส่งต่องานระหว่างฝ่าย',
          },
          warehouse: {
            label: 'คลังสินค้า',
            description: 'รับสินค้า Stock Lot อายุสินค้า และการตรวจนับ',
          },
          purchasing: { label: 'จัดซื้อ', description: 'PR, PO, Supplier และสถานะการรับสินค้า' },
          accounting: {
            label: 'บัญชีและการเงิน',
            description: 'ติดตามคำขอจ่าย มัดจำ ยอดคงเหลือ และเอกสาร',
          },
        },
        highlight: {
          eyebrow: 'Department Experience',
          statement:
            'แต่ละแผนกไม่จำเป็นต้องเห็นระบบแบบเดียวกัน\nCORE จึงออกแบบประสบการณ์ตามหน้าที่ของผู้ใช้งาน',
          cta: 'สำรวจทุกแผนก',
        },
      },
      packages: {
        label: 'แพ็คเกจ',
        eyebrow: 'Packages',
        heading: 'เลือกรูปแบบที่เหมาะกับองค์กร',
        intro:
          'ตั้งแต่ทีมที่กำลังเริ่มวางระบบ ไปจนถึงองค์กรที่ต้องการ Workflow, Control และ Integration ที่ซับซ้อนขึ้น',
        note: 'คิดค่าบริการต่อบริษัท · ทุกสาขาอยู่ใน Workspace เดียว',
        items: {
          starter: { label: 'Starter', description: 'สำหรับทีมที่ต้องการเริ่มจัดกระบวนการทำงาน' },
          business: { label: 'Business', description: 'สำหรับองค์กรที่มีหลายแผนกทำงานร่วมกัน' },
          professional: {
            label: 'Professional',
            description: 'สำหรับองค์กรที่ต้องการ Workflow และการควบคุมเพิ่มขึ้น',
          },
          enterprise: {
            label: 'Enterprise',
            description: 'สำหรับองค์กรขนาดใหญ่และความต้องการเฉพาะ',
          },
        },
        highlight: {
          eyebrow: 'Consultation',
          statement: 'ไม่แน่ใจว่าแพ็คเกจไหนเหมาะ?',
          body: 'บอกลักษณะการทำงานขององค์กร แล้วคุยกับเราเพื่อวางรูปแบบที่เหมาะสม',
          cta: 'ขอคำปรึกษา',
        },
      },
      howItWorks: {
        label: 'วิธีการทำงาน',
        eyebrow: 'How CORE works',
        heading: 'จากงานของแต่ละแผนก\nสู่กระบวนการเดียวกันทั้งองค์กร',
        intro: 'ดูว่างาน ข้อมูล และการอนุมัติเดินทางระหว่างแผนกอย่างไร ตั้งแต่เริ่มต้นจนปิดงาน',
        items: {
          how: { label: 'CORE ทำงานอย่างไร', description: 'แนวคิดและโครงสร้างการทำงานของระบบ' },
          crossDept: {
            label: 'การทำงานข้ามแผนก',
            description: 'ดูว่างานถูกส่งต่อระหว่างแต่ละฝ่ายอย่างไร',
          },
          workflow: {
            label: 'Workflow และ Approval',
            description: 'กำหนดขั้นตอนและผู้รับผิดชอบได้อย่างชัดเจน',
          },
          tracking: { label: 'การติดตามสถานะ', description: 'รู้ว่างานอยู่ตรงไหนและกำลังรอใคร' },
          errorPrevention: {
            label: 'Human Error Prevention',
            description: 'ออกแบบระบบให้ช่วยป้องกันและแจ้งเตือนความผิดพลาด',
          },
        },
        highlight: {
          eyebrow: 'Connected Workflow',
          statement: 'แยกวิธีการทำงานของแต่ละแผนก\nแต่ไม่แยกข้อมูลออกจากกัน',
          cta: 'ดูวิธีการทำงาน',
        },
      },
      solutions: {
        label: 'โซลูชัน',
        eyebrow: 'Solutions',
        heading: 'เริ่มจากปัญหาที่องค์กรเจอจริง',
        intro:
          'ความผิดพลาด การส่งต่องาน และการมองไม่เห็นสถานะ คือจุดที่งานระหว่างแผนกมักสะดุด และเป็นจุดที่ CORE ถูกออกแบบมาให้ช่วย',
        items: {
          humanError: { label: 'ลด Human Error', description: 'ลดขั้นตอนผิดพลาดและงานที่ตกหล่น' },
          multiDept: {
            label: 'เชื่อมการทำงานหลายแผนก',
            description: 'ลดการถามสถานะและการส่งข้อมูลซ้ำ',
          },
          workflow: { label: 'Workflow & Approval', description: 'สร้างมาตรฐานให้กระบวนการสำคัญ' },
          stock: { label: 'Stock & Expiry Control', description: 'ควบคุมสินค้า Lot และวันหมดอายุ' },
          visibility: {
            label: 'Operational Visibility',
            description: 'ทำให้หัวหน้าเห็นสถานะงานจริง',
          },
          management: {
            label: 'Management Control',
            description: 'รวมข้อมูลสำคัญสำหรับการตัดสินใจ',
          },
        },
        highlight: {
          eyebrow: 'Built around your process',
          statement: 'ปัญหาของแต่ละองค์กรไม่เหมือนกัน',
          body: 'CORE ถูกออกแบบให้เริ่มจากกระบวนการจริงขององค์กร ไม่ใช่บังคับทุกบริษัทให้ใช้วิธีเดียวกัน',
          cta: 'ดูตัวอย่างการใช้งาน',
        },
      },
      enterprise: {
        label: 'สำหรับองค์กร',
        eyebrow: 'Enterprise',
        heading: 'รองรับองค์กรที่ต้องการมากกว่าแค่ระบบเก็บข้อมูล',
        intro: 'แนวทางการออกแบบสำหรับองค์กรที่มีหลายทีม หลายขั้นตอน และต้องการการควบคุมที่ชัดเจน',
        note: 'บางความสามารถอยู่ในแผนพัฒนา สอบถามสถานะล่าสุดได้จากทีมงาน',
        items: {
          scale: {
            label: 'สำหรับองค์กรขนาดใหญ่',
            description: 'โครงสร้างที่รองรับหลายทีมและกระบวนการซับซ้อน',
          },
          security: {
            label: 'Security & Access',
            description: 'ควบคุมสิทธิ์ตามบทบาทและความรับผิดชอบ',
          },
          audit: {
            label: 'Audit & Control',
            description: 'ตรวจสอบย้อนหลังและติดตามการเปลี่ยนแปลง',
          },
          customWorkflow: {
            label: 'Custom Workflow',
            description: 'ออกแบบขั้นตอนตามโครงสร้างขององค์กร',
          },
          integration: {
            label: 'API & Integration',
            description: 'เตรียมพร้อมสำหรับการเชื่อมต่อระบบภายนอก',
          },
          support: {
            label: 'Implementation & Support',
            description: 'วางระบบ อบรม และดูแลการใช้งาน',
          },
        },
        highlight: {
          eyebrow: 'Enterprise',
          statement: 'สำหรับองค์กรที่ต้องการความยืดหยุ่น\nการควบคุม และการขยายระบบในระยะยาว',
          cta: 'พูดคุยกับทีม PDA BLISS',
        },
      },
      about: {
        label: 'เกี่ยวกับเรา',
        eyebrow: 'About',
        heading: 'ทีมที่อยู่เบื้องหลัง CORE',
        intro:
          'รู้จักบริษัทผู้พัฒนา PDA BLISS CORE แนวคิด และวิธีที่เราออกแบบระบบให้เข้ากับการทำงานจริง',
        items: {
          company: { label: 'PDA BLISS', description: 'รู้จักบริษัทและแนวคิดของเรา' },
          why: { label: 'ทำไมเราถึงสร้าง CORE', description: 'ที่มาและปัญหาที่เราอยากแก้' },
          approach: {
            label: 'แนวทางการพัฒนาระบบ',
            description: 'วิธีที่เราคิดเรื่อง Process และ User Experience',
          },
          consulting: { label: 'ที่ปรึกษา', description: 'การวางระบบและคำปรึกษาสำหรับองค์กร' },
        },
        highlight: {
          eyebrow: 'PDA BLISS COMPANY LIMITED',
          statement:
            'เราไม่ได้มอง Software เป็นเพียงหน้าจอ\nแต่เป็นส่วนหนึ่งของวิธีที่องค์กรทำงานจริง',
          cta: 'ติดต่อทีมงาน',
        },
      },
    },
  },
  footer: {
    byline: 'by PDA BLISS',
    lead: 'Department Operations Platform สำหรับองค์กร',
    description:
      'ออกแบบพื้นที่ทำงานให้เหมาะกับแต่ละแผนก พร้อมเชื่อมคน งาน ข้อมูล และกระบวนการไว้ใน CORE เดียว',
    shortcuts: 'ช่องทางติดต่อด่วน',
    call: 'โทร',
    line: 'LINE',
    email: 'Email',
    developedBy: 'พัฒนาโดย PDA BLISS COMPANY LIMITED',
    groups: { quick: 'ลิงก์ด่วน', company: 'องค์กร' },
    contactHeading: 'ติดต่อเรา',
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
    body: 'เว็บไซต์นี้ใช้คุกกี้ที่จำเป็นเพื่อให้ PDA BLISS CORE ทำงานได้อย่างถูกต้อง และจะใช้คุกกี้เพื่อวิเคราะห์หรือพัฒนาประสบการณ์การใช้งานเฉพาะเมื่อคุณอนุญาตเท่านั้น',
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

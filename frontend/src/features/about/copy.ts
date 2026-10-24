import type { ProductId } from '@/config/company';
import type { Localized } from '@/i18n/useCopy';
import type {
  Activity,
  Exchange,
  Guard,
  ImplementationStep,
  Layer,
  MethodStep,
  Principle,
  Stage,
  Symptom,
  Trust,
} from './model';

/*
 * /about words (EP12). Thai is the source; English and Simplified Chinese
 * share its shape. Claim discipline: no founding year, headcount, client
 * count, projects, awards, certifications, partners or testimonials — none
 * exists in an approved source. Company names come from config/company.ts and
 * contact values from config/contact.ts, never from here.
 *
 * `|` marks where a display line may wrap on narrow screens.
 */

interface Titled {
  title: string;
  body: string;
}

const th = {
  meta: {
    title: 'เกี่ยวกับ PDA BLISS — เริ่มจากการทำงานจริง',
    description:
      'PDA BLISS พัฒนาระบบโดยเริ่มจากคน งาน ความรับผิดชอบ และจุดที่กระบวนการมักผิดพลาด แนวคิด แนวทางการพัฒนาระบบ การทำงานร่วมกับองค์กร และข้อมูลบริษัท',
  },
  hero: {
    titleA: 'เราไม่ได้เริ่มจากคำถามว่า\nSoftware ควร|มีฟีเจอร์อะไร',
    titleB: 'เราเริ่มจากคำถามว่า\nองค์กร|ทำงานจริง|อย่างไร',
    lead: 'PDA BLISS พัฒนาระบบโดยมองจากคน งาน ความรับผิดชอบ และจุดที่กระบวนการมักผิดพลาด ก่อนเปลี่ยนสิ่งเหล่านั้นให้กลายเป็น Software ที่ใช้งานได้จริง',
    talk: 'พูดคุยกับ PDA BLISS',
    why: 'ทำไมเราถึงสร้าง CORE',
    visual:
      'ภาพประกอบ: บันทึกงาน ข้อความแชต และคำถามที่กระจัดกระจาย ค่อย ๆ เรียงตัวเป็นสถานะงานที่เชื่อมกันใน CORE',
    fragments: [
      'ใครอนุมัติ?',
      'ส่งในไลน์แล้วนะ',
      'ยอดไม่ตรง',
      'PO ฉบับไหน?',
      'รอของเข้า',
      'ไฟล์ล่าสุดอยู่ไหน',
    ],
    fragmentsLabel: 'งานจริง',
    structuredLabel: 'ระบบที่มีโครงสร้าง',
    states: ['รับคำสั่งซื้อ', 'อนุมัติ', 'จัดเตรียม', 'ส่งมอบ', 'ตรวจเอกสาร'],
  },
  company: {
    kicker: 'PDA BLISS',
    title: 'บริษัทพัฒนา Software |ที่สนใจ\nว่างานเดินต่อกัน|อย่างไร',
    body: 'PDA BLISS ออกแบบและพัฒนาระบบสำหรับการทำงานขององค์กร และเป็นผู้สร้าง PDA BLISS CORE เราสนใจคำถามที่ดูธรรมดาแต่สำคัญ — งานชิ้นหนึ่งเดินจากแผนกหนึ่งไปอีกแผนกอย่างไร ใครรับผิดชอบช่วงไหน และระบบควรช่วยให้งานนั้นถูกต้องตั้งแต่ต้นได้อย่างไร',
    relationTitle: 'บริษัทกับผลิตภัณฑ์',
    relation: {
      company: {
        name: 'PDA BLISS',
        role: 'บริษัทผู้พัฒนา · ผู้สร้างผลิตภัณฑ์ · ผู้ร่วมวางระบบกับองค์กร',
      },
      product: {
        name: 'CORE',
        role: 'Department Operations Platform — แพลตฟอร์มปฏิบัติการระดับแผนก',
      },
    },
    relationNote:
      'PDA BLISS คือบริษัท CORE คือผลิตภัณฑ์ เราดูแลทั้งการพัฒนาผลิตภัณฑ์ และการนำไปใช้ในแต่ละองค์กร',
  },
  belief: {
    kicker: 'สิ่งที่เราเชื่อ',
    title: 'Software ที่ดี|ควรเข้ากับความรับผิดชอบของคน\nไม่ใช่ให้คน|ปรับตัวเข้าหา Software',
    principles: {
      responsibility: {
        title: 'Software ควรเข้ากับ|ความรับผิดชอบ',
        body: 'หน้าจอ เมนู และข้อมูล ควรถูกจัดตามสิ่งที่แต่ละคนต้องรับผิดชอบ ไม่ใช่ตามโครงสร้างของโมดูล',
      },
      ownership: {
        title: 'งานทุกชิ้นควรมีเจ้าของที่ชัดเจน',
        body: 'เมื่องานเปลี่ยนมือ ทุกคนควรรู้ว่าตอนนี้งานอยู่ที่ใคร และใครต้องทำอะไรต่อ',
      },
      status: {
        title: 'สถานะงานไม่ควรต้องตามถาม',
        body: 'ความคืบหน้าควรมองเห็นได้จากระบบ ไม่ใช่จากการโทรหรือส่งข้อความถามกันทั้งวัน',
      },
      sees: {
        title: 'แต่ละแผนกควรเห็นสิ่งที่ตัวเองต้องใช้',
        body: 'ข้อมูลที่ไม่เกี่ยวกับหน้าที่ไม่ได้ช่วยให้ทำงานดีขึ้น — และบางข้อมูลไม่ควรถูกส่งไปถึงตั้งแต่แรก',
      },
      early: {
        title: 'ปัญหาควรถูกมองเห็นตั้งแต่เนิ่น ๆ',
        body: 'ความผิดปกติที่เห็นตอนเกิด แก้ง่ายกว่าความผิดปกติที่เพิ่งรู้ตอนสิ้นเดือน',
      },
      humanError: {
        title: 'ระบบควรช่วยลด Human Error',
        body: 'ความผิดพลาดของคนเป็นเรื่องปกติ ระบบที่ดีจึงออกแบบให้ทางที่ถูกต้องเป็นทางที่ง่ายที่สุด',
      },
      exceptions: {
        title: 'ผู้บริหารควรเห็นข้อยกเว้น ไม่ใช่เสียงรบกวน',
        body: 'ภาพรวมที่ดีคือสิ่งที่ต้องตัดสินใจ — งานที่ติด งานที่รอ และความเสี่ยง ไม่ใช่ทุกธุรกรรม',
      },
      simplify: {
        title: 'เทคโนโลยีควรทำให้งานง่ายขึ้น',
        body: 'ถ้าระบบใหม่ทำให้ต้องกรอกซ้ำหรือคิดมากขึ้น แปลว่าระบบนั้นยังออกแบบไม่เสร็จ',
      },
    } satisfies Record<Principle, Titled>,
  },
  problem: {
    kicker: 'ปัญหาที่เราเห็นในการทำงานจริง',
    title: 'องค์กรส่วนใหญ่|ไม่ได้ขาด Software\nแต่งานกระจาย|อยู่ในหลายที่เกินไป',
    lead: 'สิ่งที่เราเห็นซ้ำ ๆ ไม่ใช่การไม่มีระบบ แต่เป็นช่องว่าง — ระหว่างเครื่องมือ ระหว่างแผนก และระหว่างคนที่ต้องส่งงานต่อกัน',
    symptoms: {
      tools: {
        title: 'เครื่องมือที่ไม่เชื่อมกัน',
        body: 'ไฟล์หนึ่ง ระบบหนึ่ง และกลุ่มแชตอีกหลายกลุ่ม',
      },
      information: {
        title: 'ข้อมูลที่แตกเป็นชิ้น',
        body: 'ตัวเลขชุดเดียวกัน มีหลายเวอร์ชันอยู่หลายที่',
      },
      chat: { title: 'ส่งงานต่อผ่านแชต', body: 'งานสำคัญถูกส่งต่อด้วยข้อความที่เลื่อนหายไป' },
      ownership: {
        title: 'ไม่ชัดว่าใครรับผิดชอบ',
        body: 'งานค้างอยู่ระหว่างแผนก โดยไม่มีใครเป็นเจ้าของ',
      },
      duplicate: { title: 'กรอกข้อมูลซ้ำ', body: 'ข้อมูลเดียวกันถูกพิมพ์ใหม่ในทุกขั้นตอน' },
      visibility: { title: 'เห็นปัญหาช้าเกินไป', body: 'รู้ว่ามีปัญหา เมื่อปัญหากระทบลูกค้าแล้ว' },
      modules: {
        title: 'ระบบที่ออกแบบตามโมดูล',
        body: 'ทุกคนต้องเข้าใจโครงสร้างทั้งระบบ เพื่อทำงานส่วนของตัวเอง',
      },
    } satisfies Record<Symptom, Titled>,
    link: 'ดูปัญหาเหล่านี้ในบริบทการทำงานจริง',
  },
  systems: {
    kicker: 'วิธีที่เราคิดเรื่องระบบ',
    title: 'เราออกแบบจากความรับผิดชอบ\nแล้วจึงเชื่อม|ทุกความรับผิดชอบเข้าด้วยกัน',
    traditional: {
      label: 'แนวทางที่พบบ่อย',
      steps: ['ระบบขนาดใหญ่หนึ่งระบบ', 'ทุกคนเข้าโครงสร้างเดียวกัน', 'แต่ละคนค้นหางานของตัวเอง'],
    },
    core: {
      label: 'แนวคิดของ CORE',
      steps: ['ความรับผิดชอบ', 'พื้นที่ทำงานของแผนก', 'Workflow ที่เชื่อมกัน', 'ภาพรวมขององค์กร'],
    },
    note: 'นี่คือแนวทางการออกแบบของเรา ไม่ใช่การบอกว่าระบบแบบรวมศูนย์ไม่ดี — หลายองค์กรใช้ระบบเหล่านั้นได้ดี เราเพียงเลือกเริ่มจากจุดที่ต่างออกไป',
    humanError: {
      title: 'Human Error ไม่ได้หายไป\nเพียงเพราะ|บอกให้ทุกคนระวังมากขึ้น',
      body: 'คนเหนื่อย คนรีบ และคนเปลี่ยนหน้าที่ได้เสมอ เราจึงออกแบบให้ระบบช่วยรับภาระนั้น ผ่านหลักการ 5 ข้อของ CORE',
      guards: {
        guide: 'นำทาง',
        validate: 'ตรวจสอบ',
        reveal: 'ทำให้มองเห็น',
        control: 'ควบคุม',
        preserve: 'เก็บบริบท',
      } satisfies Record<Guard, string>,
    },
    link: 'ดูว่าแนวคิดนี้ทำงานจริงอย่างไร',
  },
  approach: {
    kicker: 'จาก Process สู่ Product',
    title: 'แนวทางการพัฒนาระบบ\nจากงานจริง|สู่ระบบที่ใช้งานได้จริง',
    lead: 'ทุกระบบที่เราออกแบบเดินผ่านเส้นทางเดียวกัน — เริ่มจากการดูงานจริง และกลับไปที่งานจริงทุกครั้งที่ปรับปรุง',
    visual:
      'ภาพประกอบ: บันทึกจากหน้างาน กลายเป็นแผนที่ความรับผิดชอบ แล้วเป็น Workflow และสุดท้ายเป็นหน้าจอ CORE',
    stages: {
      notes: {
        title: 'บันทึกจากหน้างาน',
        body: 'สิ่งที่เกิดขึ้นจริง รวมถึงสิ่งที่ไม่มีใครเขียนไว้',
      },
      map: { title: 'แผนที่ความรับผิดชอบ', body: 'ใครทำอะไร ส่งต่อให้ใคร และติดตรงไหน' },
      workflow: { title: 'Workflow', body: 'สถานะ เงื่อนไข และการส่งต่อที่ชัดเจน' },
      interface: { title: 'หน้าจอ CORE', body: 'พื้นที่ทำงานที่บอกงานถัดไปของแต่ละคน' },
    } satisfies Record<Stage, Titled>,
    steps: {
      realWork: {
        title: 'งานจริง',
        body: 'เริ่มจากสิ่งที่เกิดขึ้นในแต่ละวัน ไม่ใช่จากรายการฟีเจอร์',
      },
      observe: {
        title: 'สังเกต',
        body: 'ดูว่างานเดินอย่างไร ใช้เอกสารอะไร และคุยกันผ่านช่องทางไหน',
      },
      responsibility: {
        title: 'เข้าใจความรับผิดชอบ',
        body: 'แยกให้ชัดว่าแต่ละบทบาทรับผิดชอบอะไร และตัดสินใจอะไร',
      },
      process: { title: 'วาด Process', body: 'วาดเส้นทางของงานข้ามแผนก ตั้งแต่ต้นจนจบ' },
      failure: { title: 'หาจุดที่มักผิดพลาด', body: 'หาจุดที่งานมักติด ล่าช้า หรือผิดซ้ำ ๆ' },
      workflow: {
        title: 'ออกแบบ Workflow',
        body: 'กำหนดสถานะ เงื่อนไข และการอนุมัติ ตรงจุดเหล่านั้น',
      },
      interface: {
        title: 'ออกแบบหน้าจอ',
        body: 'ให้แต่ละบทบาทเห็นเฉพาะสิ่งที่ต้องใช้ และงานถัดไปที่ต้องทำ',
      },
      build: { title: 'พัฒนาระบบ', body: 'พัฒนาบนพื้นฐานเดียวกันของ CORE' },
      test: {
        title: 'ทดสอบกับสถานการณ์จริง',
        body: 'ทดสอบด้วยสถานการณ์ที่เกิดขึ้นจริง รวมถึงกรณีผิดปกติ',
      },
      improve: { title: 'ปรับปรุง', body: 'ปรับจากการใช้งานจริง แล้วกลับไปดูงานจริงอีกครั้ง' },
    } satisfies Record<MethodStep, Titled>,
    loop: 'แล้วกลับไปที่งานจริงอีกครั้ง',
    sketch: {
      notes: ['ใครเซ็น?', 'รอ 2 วัน', 'ส่งต่อ?'],
      roles: ['ขาย', 'คลัง', 'บัญชี'],
      next: 'งานถัดไป',
    },
  },
  consulting: {
    kicker: 'ทำงานร่วมกับองค์กร',
    title: 'ที่ปรึกษา\nเราช่วยทำความเข้าใจการทำงาน|ก่อนตั้งค่าระบบ',
    lead: 'PDA BLISS ไม่ได้เป็นเพียงผู้ขาย Software เราทำงานร่วมกับทีมของคุณเพื่อทำความเข้าใจกระบวนการ ความรับผิดชอบ และปัญหาที่เกิดขึ้นจริง ก่อนเปลี่ยนสิ่งเหล่านั้นเป็นการตั้งค่า CORE',
    tableCaption:
      'การทำงานร่วมกัน: สิ่งที่องค์กรนำมา สิ่งที่ PDA BLISS ทำ และสิ่งที่กลายเป็นการตั้งค่า CORE',
    columns: {
      topic: 'หัวข้อ',
      org: 'องค์กรของคุณ',
      us: 'PDA BLISS',
      core: 'การตั้งค่า CORE',
    },
    exchange: {
      processes: {
        topic: 'กระบวนการ',
        org: 'วิธีทำงานในปัจจุบัน',
        us: 'Process Mapping',
        core: 'Workflow และสถานะเอกสาร',
      },
      responsibilities: {
        topic: 'ความรับผิดชอบ',
        org: 'ใครทำอะไร และใครอนุมัติ',
        us: 'ทบทวนความรับผิดชอบของแต่ละแผนก',
        core: 'บทบาท สิทธิ์ และพื้นที่ทำงาน',
      },
      problems: {
        topic: 'ปัญหา',
        org: 'จุดที่งานติดหรือผิดบ่อย',
        us: 'หาจุดเสี่ยงในกระบวนการ',
        core: 'การตรวจสอบและการแจ้งเตือน',
      },
      controls: {
        topic: 'การควบคุม',
        org: 'กฎและเงื่อนไขที่ต้องรักษา',
        us: 'ออกแบบเงื่อนไขและการอนุมัติ',
        core: 'กฎธุรกิจและสายอนุมัติ',
      },
      outcome: {
        topic: 'ผลลัพธ์ที่ต้องการ',
        org: 'สิ่งที่อยากเห็นเมื่อระบบพร้อม',
        us: 'วางแผนการนำระบบไปใช้',
        core: 'มุมมองของแต่ละแผนกและผู้บริหาร',
      },
    } satisfies Record<Exchange, { topic: string; org: string; us: string; core: string }>,
    activitiesTitle: 'สิ่งที่เราทำร่วมกับทีมของคุณ',
    activities: {
      mapping: 'Process Mapping',
      workflowReview: 'ทบทวน Workflow',
      responsibilityReview: 'ทบทวนความรับผิดชอบของแผนก',
      planning: 'วางแผนการนำระบบไปใช้',
      data: 'เตรียมข้อมูล',
      training: 'ฝึกอบรม',
      customWorkflow: 'พูดคุยเรื่อง Workflow เฉพาะ',
      integration: 'กำหนดขอบเขตการเชื่อมต่อระบบ',
    } satisfies Record<Activity, string>,
    boundary:
      'คำว่า “ที่ปรึกษา” ในที่นี้หมายถึงการทำงานร่วมกันเรื่องกระบวนการและการวางระบบ CORE โดยทีม PDA BLISS — ไม่ใช่บริการที่ปรึกษาด้านบัญชี ภาษี หรือกฎหมาย',
  },
  implementation: {
    kicker: 'การนำระบบไปใช้',
    title: 'วางระบบทีละขั้น\nจนทีม|ใช้งานได้จริง',
    lead: 'ขอบเขต ระยะเวลา และรายละเอียดของแต่ละขั้น กำหนดร่วมกันตามขนาดและความพร้อมขององค์กร',
    steps: {
      listen: 'รับฟัง',
      understand: 'ทำความเข้าใจ',
      map: 'วาดแผนที่งาน',
      design: 'ออกแบบ',
      build: 'ตั้งค่า / พัฒนา',
      validate: 'ตรวจสอบร่วมกัน',
      train: 'ฝึกอบรม',
      launch: 'เริ่มใช้งาน',
      improve: 'ปรับปรุงต่อเนื่อง',
    } satisfies Record<ImplementationStep, string>,
    link: 'ดูขั้นตอนการวางระบบสำหรับองค์กร',
  },
  longTerm: {
    kicker: 'ออกแบบเพื่อใช้งานระยะยาว',
    title: 'เราปรับ Workflow |ให้เข้ากับองค์กรได้\nแต่ CORE |ยังคงเป็นผลิตภัณฑ์',
    lead: 'ทุกองค์กรเริ่มจากพื้นฐานเดียวกันของ CORE แล้วปรับการตั้งค่าและ Workflow ให้เข้ากับการทำงาน — ไม่ใช่การเขียนระบบใหม่ทั้งชุดสำหรับแต่ละองค์กร',
    visual:
      'ภาพประกอบ: พื้นฐานมาตรฐานของ CORE อยู่ด้านล่าง การตั้งค่าอยู่ด้านบน และการเชื่อมต่อเฉพาะโครงการอยู่บนสุดเมื่อจำเป็น',
    layers: {
      foundation: {
        title: 'พื้นฐานมาตรฐานของ CORE',
        body: 'พื้นที่ทำงานของแผนก เอกสาร สถานะ สิทธิ์ และการตรวจสอบย้อนหลัง',
      },
      configuration: {
        title: 'การตั้งค่าและการปรับ Workflow',
        body: 'สายอนุมัติ เงื่อนไข บทบาท และขั้นตอน ตามวิธีทำงานขององค์กร',
      },
      integration: {
        title: 'การเชื่อมต่อเฉพาะโครงการ เมื่อจำเป็น',
        body: 'เชื่อมกับระบบที่องค์กรใช้อยู่ ตามขอบเขตที่ตกลงร่วมกัน',
      },
    } satisfies Record<Layer, Titled>,
    whyTitle: 'ทำไมจึงสำคัญ',
    why: [
      'ทุกองค์กรได้รับการปรับปรุงของผลิตภัณฑ์ไปพร้อมกัน',
      'ระบบดูแลรักษาได้ในระยะยาว',
      'การปรับให้เข้ากับองค์กร ไม่ทำให้ระบบแตกเป็นคนละชุด',
    ],
    productsTitle: 'ผลิตภัณฑ์โดย PDA BLISS',
    products: {
      core: {
        role: 'Department Operations Platform',
        body: 'พื้นที่ทำงานของแต่ละแผนก เชื่อมกันด้วย Workflow เดียวกัน',
      },
      one: {
        role: 'แพลตฟอร์มงานธุรกิจและบัญชี',
        body: 'บริหารงานธุรกิจและบัญชี จากมุมมองของบริษัท',
      },
      property: {
        role: 'งานอสังหาริมทรัพย์และการให้เช่า',
        body: 'สัญญาเช่า ผู้เช่า และการวางบิลสำหรับงานให้เช่า',
      },
    } satisfies Record<ProductId, { role: string; body: string }>,
    current: 'คุณอยู่ที่นี่',
    productsNote: 'แต่ละผลิตภัณฑ์ตอบโจทย์ต่างกัน และไม่ได้แทนที่กัน',
  },
  info: {
    kicker: 'ข้อมูลบริษัท',
    title: 'ติดต่อ PDA BLISS |ได้โดยตรง',
    labels: {
      name: 'ชื่อบริษัท',
      address: 'ที่อยู่สำนักงาน',
      phone: 'โทรศัพท์',
      email: 'อีเมล',
      line: 'LINE Official Account',
    },
    trustTitle: 'สิ่งที่เรายึดถือในการสื่อสาร',
    trust: {
      identity: 'ข้อมูลบริษัทและช่องทางติดต่อที่ติดต่อได้จริง',
      status: 'บอกสถานะของแต่ละความสามารถอย่างตรงไปตรงมา',
      boundaries: 'บอกขอบเขตของ CORE ให้ชัด รวมถึงสิ่งที่ CORE ไม่ได้ทำ',
      noClaims: 'ไม่แสดงตัวเลข รางวัล หรือการรับรองที่ไม่มีที่มา',
    } satisfies Record<Trust, string>,
  },
  talk: {
    title: 'เล่าให้เราฟัง|ว่างานในองค์กรของคุณเดินอย่างไร',
    body: 'แล้วเราจะคุยกันว่า CORE ช่วยได้ตรงไหน — และตรงไหนที่ยังไม่ใช่',
    primary: 'พูดคุยกับ PDA BLISS',
    line: 'LINE OA',
    industries: 'ดู CORE ในบริบทแต่ละประเภทธุรกิจ',
    why: 'ทำไมเราถึงสร้าง CORE',
  },
};

export type AboutCopy = typeof th;

export const ABOUT: Localized<AboutCopy> = {
  th,
  en: {
    meta: {
      title: 'About PDA BLISS — software that starts from real work',
      description:
        'PDA BLISS builds systems from people, work, responsibility and the points where processes fail. Our beliefs, how we design systems, how we work with organizations, and company information.',
    },
    hero: {
      titleA: 'We did not start by asking\nwhat features software should have',
      titleB: 'We started by asking\nhow an organization really works',
      lead: 'PDA BLISS designs systems by looking at people, work, responsibility and the points where processes tend to fail — then turns them into software that works in practice.',
      talk: 'Talk to PDA BLISS',
      why: 'Why we built CORE',
      visual:
        'Illustration: scattered notes, chat messages and questions gradually align into connected work states in CORE',
      fragments: [
        'Who approved this?',
        'Sent it on chat',
        'Totals don’t match',
        'Which PO?',
        'Waiting for stock',
        'Where is the latest file?',
      ],
      fragmentsLabel: 'Real work',
      structuredLabel: 'A structured system',
      states: ['Order received', 'Approved', 'Picking', 'Delivered', 'Documents checked'],
    },
    company: {
      kicker: 'PDA BLISS',
      title: 'A software company\ninterested in how work moves',
      body: 'PDA BLISS designs and builds systems for how organizations operate, and is the maker of PDA BLISS CORE. We care about questions that look ordinary but matter — how a piece of work travels from one department to the next, who is responsible at each point, and how a system can help it be right from the start.',
      relationTitle: 'Company and product',
      relation: {
        company: {
          name: 'PDA BLISS',
          role: 'The company · product maker · implementation partner',
        },
        product: { name: 'CORE', role: 'Department Operations Platform' },
      },
      relationNote:
        'PDA BLISS is the company. CORE is the product. We look after both the product and how it is put to work in each organization.',
    },
    belief: {
      kicker: 'What we believe',
      title:
        'Good software fits\nthe responsibility of the people using it —\nnot the other way round',
      principles: {
        responsibility: {
          title: 'Software should fit responsibility',
          body: 'Screens, menus and information should follow what each person is responsible for — not the structure of modules.',
        },
        ownership: {
          title: 'Every piece of work should have a clear owner',
          body: 'When work changes hands, everyone should know where it is now and who acts next.',
        },
        status: {
          title: 'Status should not require chasing people',
          body: 'Progress should be visible in the system, not found through calls and messages all day.',
        },
        sees: {
          title: 'Each department should see what it needs',
          body: 'Information outside a role does not help anyone work better — and some should never be sent in the first place.',
        },
        early: {
          title: 'Problems should become visible early',
          body: 'An exception seen as it happens is easier to fix than one discovered at month end.',
        },
        humanError: {
          title: 'Systems should reduce Human Error',
          body: 'People make mistakes. Good systems make the right way the easiest way.',
        },
        exceptions: {
          title: 'Management should see exceptions, not noise',
          body: 'A good overview shows what needs a decision — blocked work, waiting work and risk — not every transaction.',
        },
        simplify: {
          title: 'Technology should simplify operations',
          body: 'If a new system means re-typing or more thinking, the system is not finished yet.',
        },
      },
    },
    problem: {
      kicker: 'The problem we see in real work',
      title:
        'Most organizations do not lack software.\nTheir work is spread across too many places.',
      lead: 'What we see again and again is not a missing system but gaps — between tools, between departments and between the people who hand work to each other.',
      symptoms: {
        tools: {
          title: 'Disconnected tools',
          body: 'One file, one system and several chat groups.',
        },
        information: {
          title: 'Fragmented information',
          body: 'The same numbers, in several versions, in several places.',
        },
        chat: {
          title: 'Chat-based handoffs',
          body: 'Important work passed on in messages that scroll away.',
        },
        ownership: {
          title: 'Unclear ownership',
          body: 'Work sits between departments with no one owning it.',
        },
        duplicate: { title: 'Duplicated entry', body: 'The same data re-typed at every step.' },
        visibility: {
          title: 'Delayed visibility',
          body: 'A problem is noticed once it has reached the customer.',
        },
        modules: {
          title: 'Systems built around modules',
          body: 'Everyone must understand the whole structure to do their own part.',
        },
      },
      link: 'See these problems in real operating situations',
    },
    systems: {
      kicker: 'How we think about systems',
      title: 'We design from responsibility,\nthen connect every responsibility together',
      traditional: {
        label: 'A common approach',
        steps: [
          'One large system',
          'Everyone enters the same structure',
          'Each person searches for their work',
        ],
      },
      core: {
        label: 'The CORE philosophy',
        steps: [
          'Responsibility',
          'Department workspace',
          'Connected workflow',
          'Organization visibility',
        ],
      },
      note: 'This is our design philosophy, not a claim that centralized systems are bad — many organizations use them well. We simply choose to start from a different place.',
      humanError: {
        title: 'Human Error does not disappear\nbecause people are told to be more careful',
        body: 'People get tired, rush and change roles. So we design systems to carry that load, through the five CORE principles.',
        guards: {
          guide: 'Guide',
          validate: 'Validate',
          reveal: 'Reveal',
          control: 'Control',
          preserve: 'Preserve context',
        },
      },
      link: 'See how this works in practice',
    },
    approach: {
      kicker: 'From process to product',
      title: 'Our approach to building systems:\nfrom real work to a system that works',
      lead: 'Every system we design follows the same path — it starts by watching real work, and returns to real work every time it improves.',
      visual:
        'Illustration: notes from the floor become a responsibility map, then a workflow, and finally a CORE screen',
      stages: {
        notes: {
          title: 'Notes from the floor',
          body: 'What really happens — including what nobody wrote down.',
        },
        map: {
          title: 'Responsibility map',
          body: 'Who does what, who hands to whom, and where it stalls.',
        },
        workflow: { title: 'Workflow', body: 'Clear states, conditions and handoffs.' },
        interface: {
          title: 'CORE screen',
          body: 'A workspace that shows each person their next action.',
        },
      },
      steps: {
        realWork: {
          title: 'Real work',
          body: 'Start from what happens each day, not from a feature list.',
        },
        observe: {
          title: 'Observe',
          body: 'See how work moves, which documents it uses and which channels people talk through.',
        },
        responsibility: {
          title: 'Understand responsibility',
          body: 'Separate clearly what each role owns and what it decides.',
        },
        process: {
          title: 'Map the process',
          body: 'Draw the path of work across departments, end to end.',
        },
        failure: {
          title: 'Find failure points',
          body: 'Find where work tends to stall, run late or go wrong repeatedly.',
        },
        workflow: {
          title: 'Design the workflow',
          body: 'Set states, conditions and approvals at those points.',
        },
        interface: {
          title: 'Design the interface',
          body: 'Show each role only what it needs, and the next action to take.',
        },
        build: { title: 'Build the system', body: 'Build on the same CORE foundation.' },
        test: {
          title: 'Test with real scenarios',
          body: 'Test with situations that really happen — exceptions included.',
        },
        improve: { title: 'Improve', body: 'Adjust from real use, then look at real work again.' },
      },
      loop: 'Then back to real work',
      sketch: {
        notes: ['Who signs?', 'Waiting 2 days', 'Hand over?'],
        roles: ['Sales', 'Stock', 'Finance'],
        next: 'Next action',
      },
    },
    consulting: {
      kicker: 'Working with organizations',
      title: 'Consulting\nwe help understand the work\nbefore configuring the system',
      lead: 'PDA BLISS is not only a software vendor. We work with your team to understand processes, responsibilities and the problems that really occur — before turning them into a CORE configuration.',
      tableCaption:
        'Working together: what the organization brings, what PDA BLISS does, and what becomes CORE configuration',
      columns: {
        topic: 'Topic',
        org: 'Your organization',
        us: 'PDA BLISS',
        core: 'CORE configuration',
      },
      exchange: {
        processes: {
          topic: 'Processes',
          org: 'How work is done today',
          us: 'Process mapping',
          core: 'Workflow and document states',
        },
        responsibilities: {
          topic: 'Responsibilities',
          org: 'Who does what, and who approves',
          us: 'Department responsibility review',
          core: 'Roles, permissions and workspaces',
        },
        problems: {
          topic: 'Problems',
          org: 'Where work stalls or goes wrong',
          us: 'Find risk points in the process',
          core: 'Validation and alerts',
        },
        controls: {
          topic: 'Controls',
          org: 'Rules and conditions to keep',
          us: 'Design conditions and approvals',
          core: 'Business rules and approval chains',
        },
        outcome: {
          topic: 'Desired outcome',
          org: 'What you want to see when it is ready',
          us: 'Implementation planning',
          core: 'Department and executive views',
        },
      },
      activitiesTitle: 'What we do with your team',
      activities: {
        mapping: 'Process mapping',
        workflowReview: 'Workflow review',
        responsibilityReview: 'Department responsibility review',
        planning: 'Implementation planning',
        data: 'Data preparation',
        training: 'Training',
        customWorkflow: 'Custom workflow discussion',
        integration: 'Integration scope',
      },
      boundary:
        '“Consulting” here means working together on processes and CORE implementation, by the PDA BLISS team — not accounting, tax or legal advisory services.',
    },
    implementation: {
      kicker: 'Implementation',
      title: 'Put in place step by step,\nuntil the team really uses it',
      lead: 'Scope, timing and the detail of each step are agreed together, based on the size and readiness of the organization.',
      steps: {
        listen: 'Listen',
        understand: 'Understand',
        map: 'Map',
        design: 'Design',
        build: 'Build / configure',
        validate: 'Validate together',
        train: 'Train',
        launch: 'Launch',
        improve: 'Improve',
      },
      link: 'See the implementation journey for organizations',
    },
    longTerm: {
      kicker: 'Built for long-term use',
      title: 'We adapt workflows to the organization —\nCORE remains a product',
      lead: 'Every organization starts from the same CORE foundation, then configuration and workflows are adapted to how it works. It is not a new codebase written for each organization.',
      visual:
        'Illustration: the standard CORE foundation at the base, configuration above it, and project-specific integrations on top where needed',
      layers: {
        foundation: {
          title: 'Standard CORE foundation',
          body: 'Department workspaces, documents, states, permissions and audit trail.',
        },
        configuration: {
          title: 'Configuration and workflow adaptation',
          body: 'Approval chains, conditions, roles and steps that follow how the organization works.',
        },
        integration: {
          title: 'Project-specific integrations, where needed',
          body: 'Connections to systems the organization already uses, within an agreed scope.',
        },
      },
      whyTitle: 'Why it matters',
      why: [
        'Every organization receives product improvements together',
        'The system stays maintainable over the long term',
        'Adapting to an organization does not split the system into separate versions',
      ],
      productsTitle: 'Products by PDA BLISS',
      products: {
        core: {
          role: 'Department Operations Platform',
          body: 'A workspace for each department, connected by one workflow.',
        },
        one: {
          role: 'Business and accounting platform',
          body: 'Business and accounting management from the company’s perspective.',
        },
        property: {
          role: 'Property and rental operations',
          body: 'Leases, tenants and billing for rental operations.',
        },
      },
      current: 'You are here',
      productsNote: 'Each product serves a different need; none replaces another.',
    },
    info: {
      kicker: 'Company information',
      title: 'Reach PDA BLISS directly',
      labels: {
        name: 'Company',
        address: 'Office address',
        phone: 'Phone',
        email: 'Email',
        line: 'LINE Official Account',
      },
      trustTitle: 'How we communicate',
      trust: {
        identity: 'Real company details and contact channels that reach us',
        status: 'An honest status for every capability',
        boundaries: 'Clear boundaries for CORE — including what it does not do',
        noClaims: 'No numbers, awards or certifications without a source',
      },
    },
    talk: {
      title: 'Tell us how work moves\nin your organization',
      body: 'Then we can talk about where CORE helps — and where it is not the right fit.',
      primary: 'Talk to PDA BLISS',
      line: 'LINE OA',
      industries: 'See CORE in different types of business',
      why: 'Why we built CORE',
    },
  },
  'zh-CN': {
    meta: {
      title: '关于 PDA BLISS——从真实工作出发',
      description:
        'PDA BLISS 从人员、工作、职责以及流程容易出错的环节出发构建系统。了解我们的理念、系统设计方法、与企业的合作方式以及公司信息。',
    },
    hero: {
      titleA: '我们的出发点不是\n软件应该有哪些功能',
      titleB: '而是\n组织实际上如何运作',
      lead: 'PDA BLISS 从人员、工作、职责以及流程容易出错的环节出发设计系统，再把这些转化为真正可用的软件。',
      talk: '与 PDA BLISS 交流',
      why: '我们为何打造 CORE',
      visual: '示意图：零散的笔记、聊天消息和问题，逐渐整理成 CORE 中相互连接的工作状态',
      fragments: [
        '谁批准的？',
        '已经在聊天里发了',
        '数量对不上',
        '哪张采购单？',
        '等货中',
        '最新文件在哪？',
      ],
      fragmentsLabel: '真实工作',
      structuredLabel: '有结构的系统',
      states: ['接收订单', '审批', '备货', '交付', '核对单据'],
    },
    company: {
      kicker: 'PDA BLISS',
      title: '一家关注\n工作如何衔接的软件公司',
      body: 'PDA BLISS 为组织的日常运作设计和开发系统，也是 PDA BLISS CORE 的开发者。我们关心一些看似平常却很重要的问题——一项工作如何从一个部门传到下一个部门，每个环节由谁负责，以及系统如何帮助它从一开始就做对。',
      relationTitle: '公司与产品',
      relation: {
        company: { name: 'PDA BLISS', role: '公司 · 产品开发者 · 实施伙伴' },
        product: { name: 'CORE', role: 'Department Operations Platform——部门运营平台' },
      },
      relationNote:
        'PDA BLISS 是公司，CORE 是产品。我们既负责产品本身，也负责它在每个组织中的落地。',
    },
    belief: {
      kicker: '我们的信念',
      title: '好的软件应当适应人的职责\n而不是让人去适应软件',
      principles: {
        responsibility: {
          title: '软件应当适应职责',
          body: '界面、菜单和信息应按照每个人负责的工作来组织，而不是按照模块结构。',
        },
        ownership: {
          title: '每项工作都应有明确的负责人',
          body: '工作交接时，所有人都应知道它现在在谁手里，下一步由谁处理。',
        },
        status: {
          title: '状态不应靠追问',
          body: '进度应在系统中可见，而不是整天靠电话和消息去问。',
        },
        sees: {
          title: '每个部门只看到自己需要的',
          body: '与职责无关的信息不会让工作更好——有些信息从一开始就不应被发送。',
        },
        early: {
          title: '问题应尽早显现',
          body: '在发生时就看到的异常，比到月底才发现的异常更容易处理。',
        },
        humanError: {
          title: '系统应帮助减少人为错误',
          body: '人难免出错。好的系统让正确的做法成为最容易的做法。',
        },
        exceptions: {
          title: '管理层应看到例外，而不是噪音',
          body: '好的全局视图展示需要决策的事项——受阻的工作、等待的工作和风险，而不是每一笔交易。',
        },
        simplify: {
          title: '技术应让运营更简单',
          body: '如果新系统让人重复录入或想得更多，说明系统还没有设计完成。',
        },
      },
    },
    problem: {
      kicker: '我们在真实工作中看到的问题',
      title: '多数组织并不缺软件\n而是工作分散在太多地方',
      lead: '我们反复看到的不是缺少系统，而是缝隙——工具之间、部门之间，以及需要相互交接工作的人之间。',
      symptoms: {
        tools: { title: '工具彼此割裂', body: '一个文件、一个系统，再加上好几个聊天群。' },
        information: { title: '信息碎片化', body: '同一组数字，在不同地方有多个版本。' },
        chat: { title: '靠聊天交接', body: '重要工作通过很快被刷走的消息传递。' },
        ownership: { title: '职责不清', body: '工作停在部门之间，没有人负责。' },
        duplicate: { title: '重复录入', body: '同样的数据在每个环节重新输入。' },
        visibility: { title: '发现太晚', body: '问题影响到客户时才被注意到。' },
        modules: {
          title: '按模块设计的系统',
          body: '每个人都要理解整个结构，才能完成自己的部分。',
        },
      },
      link: '在真实运营场景中查看这些问题',
    },
    systems: {
      kicker: '我们如何思考系统',
      title: '我们从职责出发设计\n再把所有职责连接起来',
      traditional: {
        label: '常见做法',
        steps: ['一个大型系统', '所有人进入同一结构', '每个人寻找自己的工作'],
      },
      core: {
        label: 'CORE 的理念',
        steps: ['职责', '部门工作空间', '相互连接的工作流', '组织全局视图'],
      },
      note: '这是我们的设计理念，并不是说集中式系统不好——很多组织用得很好。我们只是选择从不同的起点出发。',
      humanError: {
        title: '人为错误不会因为\n提醒大家更小心而消失',
        body: '人会疲惫、会赶时间、会换岗。因此我们通过 CORE 的五项原则，让系统来分担这份负担。',
        guards: {
          guide: '引导',
          validate: '校验',
          reveal: '显现',
          control: '控制',
          preserve: '保留上下文',
        },
      },
      link: '查看这一理念如何实际运作',
    },
    approach: {
      kicker: '从流程到产品',
      title: '我们的系统开发方法\n从真实工作到真正可用的系统',
      lead: '我们设计的每个系统都走同一条路——从观察真实工作开始，每次改进时再回到真实工作。',
      visual: '示意图：现场笔记变成职责地图，再变成工作流，最后成为 CORE 界面',
      stages: {
        notes: { title: '现场笔记', body: '真实发生的事情——包括没人写下来的部分。' },
        map: { title: '职责地图', body: '谁做什么、交给谁、卡在哪里。' },
        workflow: { title: '工作流', body: '清晰的状态、条件与交接。' },
        interface: { title: 'CORE 界面', body: '为每个人显示下一步行动的工作空间。' },
      },
      steps: {
        realWork: { title: '真实工作', body: '从每天发生的事情开始，而不是从功能清单开始。' },
        observe: { title: '观察', body: '看工作如何流转、使用哪些单据、通过哪些渠道沟通。' },
        responsibility: { title: '理解职责', body: '分清每个角色负责什么、决定什么。' },
        process: { title: '绘制流程', body: '从头到尾画出工作跨部门的路径。' },
        failure: { title: '找出易错环节', body: '找出工作经常受阻、延误或反复出错的地方。' },
        workflow: { title: '设计工作流', body: '在这些环节设定状态、条件和审批。' },
        interface: { title: '设计界面', body: '让每个角色只看到需要的内容和下一步行动。' },
        build: { title: '开发系统', body: '在同一个 CORE 基础上开发。' },
        test: { title: '用真实场景测试', body: '用真实发生的情况测试，包括异常情况。' },
        improve: { title: '改进', body: '根据实际使用调整，再回去观察真实工作。' },
      },
      loop: '然后再回到真实工作',
      sketch: {
        notes: ['谁签字？', '等了 2 天', '要交接？'],
        roles: ['销售', '仓库', '财务'],
        next: '下一步',
      },
    },
    consulting: {
      kicker: '与组织合作',
      title: '咨询\n在配置系统之前\n先帮助理解工作',
      lead: 'PDA BLISS 不只是软件供应商。我们与您的团队一起理解流程、职责以及真实发生的问题，再把它们转化为 CORE 的配置。',
      tableCaption: '合作方式：组织带来的内容、PDA BLISS 的工作，以及最终形成的 CORE 配置',
      columns: { topic: '主题', org: '您的组织', us: 'PDA BLISS', core: 'CORE 配置' },
      exchange: {
        processes: {
          topic: '流程',
          org: '目前的工作方式',
          us: '流程梳理',
          core: '工作流与单据状态',
        },
        responsibilities: {
          topic: '职责',
          org: '谁做什么、谁审批',
          us: '部门职责梳理',
          core: '角色、权限与工作空间',
        },
        problems: {
          topic: '问题',
          org: '工作经常受阻或出错的地方',
          us: '找出流程中的风险点',
          core: '校验与提醒',
        },
        controls: {
          topic: '控制',
          org: '需要遵守的规则与条件',
          us: '设计条件与审批',
          core: '业务规则与审批链',
        },
        outcome: {
          topic: '期望结果',
          org: '系统就绪时希望看到的',
          us: '实施规划',
          core: '各部门与管理层视图',
        },
      },
      activitiesTitle: '我们与您的团队一起做的事',
      activities: {
        mapping: '流程梳理',
        workflowReview: '工作流评审',
        responsibilityReview: '部门职责梳理',
        planning: '实施规划',
        data: '数据准备',
        training: '培训',
        customWorkflow: '定制工作流讨论',
        integration: '集成范围界定',
      },
      boundary:
        '这里的“咨询”是指由 PDA BLISS 团队就流程与 CORE 实施开展的合作——并非会计、税务或法律咨询服务。',
    },
    implementation: {
      kicker: '实施',
      title: '一步一步落地\n直到团队真正用起来',
      lead: '每个阶段的范围、时间与细节，根据组织的规模和准备情况共同确定。',
      steps: {
        listen: '倾听',
        understand: '理解',
        map: '梳理',
        design: '设计',
        build: '配置 / 开发',
        validate: '共同验证',
        train: '培训',
        launch: '上线',
        improve: '持续改进',
      },
      link: '查看面向组织的实施路径',
    },
    longTerm: {
      kicker: '为长期使用而设计',
      title: '我们可以让工作流适应组织\n但 CORE 始终是一个产品',
      lead: '每个组织都从同一个 CORE 基础开始，再根据工作方式调整配置和工作流——而不是为每个组织重新编写一整套系统。',
      visual: '示意图：底层是标准的 CORE 基础，上面是配置，最上层是必要时的项目专属集成',
      layers: {
        foundation: { title: '标准 CORE 基础', body: '部门工作空间、单据、状态、权限与审计记录。' },
        configuration: {
          title: '配置与工作流调整',
          body: '按组织工作方式设定的审批链、条件、角色与步骤。',
        },
        integration: { title: '必要时的项目专属集成', body: '在约定范围内连接组织现有的系统。' },
      },
      whyTitle: '为什么重要',
      why: [
        '所有组织同步获得产品改进',
        '系统可以长期维护',
        '适应组织的调整不会让系统分裂成不同版本',
      ],
      productsTitle: 'PDA BLISS 的产品',
      products: {
        core: {
          role: 'Department Operations Platform',
          body: '每个部门的工作空间，通过同一个工作流相连。',
        },
        one: { role: '业务与财务平台', body: '从公司视角管理业务与财务。' },
        property: { role: '物业与租赁运营', body: '租赁运营中的租约、租户与账单。' },
      },
      current: '当前页面',
      productsNote: '每个产品满足不同的需求，彼此不能替代。',
    },
    info: {
      kicker: '公司信息',
      title: '直接联系 PDA BLISS',
      labels: {
        name: '公司名称',
        address: '办公地址',
        phone: '电话',
        email: '电子邮件',
        line: 'LINE 官方账号',
      },
      trustTitle: '我们的沟通原则',
      trust: {
        identity: '真实的公司信息和可以联系到我们的渠道',
        status: '如实说明每项能力的状态',
        boundaries: '清楚说明 CORE 的边界——包括它不做什么',
        noClaims: '不展示没有来源的数字、奖项或认证',
      },
    },
    talk: {
      title: '告诉我们\n您的组织中工作如何流转',
      body: '然后我们一起看看 CORE 能在哪里帮上忙——以及哪里并不合适。',
      primary: '与 PDA BLISS 交流',
      line: 'LINE OA',
      industries: '查看 CORE 在不同业务类型中的应用',
      why: '我们为何打造 CORE',
    },
  },
};

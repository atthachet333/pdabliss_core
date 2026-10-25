import type { Guard } from '@/features/about/model';
import type { Localized } from '@/i18n/useCopy';
import type { Growth, Module, Signal, Viewer } from './model';

/*
 * /why-core words (EP12). Thai is the source. Product-origin framing only:
 * no invented anecdotes, customers or numbers. Safeguards are described as
 * what CORE is designed to support, never as certified guarantees.
 *
 * `|` marks where a display line may wrap on narrow screens.
 */

interface Titled {
  title: string;
  body: string;
}

const th = {
  meta: {
    title: 'ทำไมเราถึงสร้าง CORE — งานจริงมักติดอยู่ระหว่างแผนก',
    description:
      'ที่มาของ PDA BLISS CORE: เมื่อองค์กรเติบโต งานเริ่มติดอยู่ระหว่างแผนก CORE จึงให้แต่ละแผนกมีพื้นที่ทำงานของตัวเองบนสถานะงานเดียวกัน พร้อมแนวคิดเรื่อง Human Error และมุมมองของผู้บริหาร',
  },
  hero: {
    eyebrow: 'Why CORE',
    titleA: 'เราไม่ได้สร้าง CORE\nเพราะองค์กรต้องการ |Software อีกหนึ่งตัว',
    titleB: 'เราสร้าง CORE\nเพราะงานจริง|มักติดอยู่ระหว่างแผนก',
    lead: 'งานส่วนใหญ่ไม่ได้ผิดพลาดภายในแผนกใดแผนกหนึ่ง แต่มักหยุดนิ่งตรงรอยต่อ — ตอนที่ต้องส่งต่อ รออนุมัติ หรือรอข้อมูลจากอีกฝ่าย CORE ถูกออกแบบมาสำหรับรอยต่อเหล่านั้น',
    visual:
      'ภาพประกอบ: หกแผนกเป็นเกาะแยกกัน มีช่องว่างที่งานรออยู่ระหว่างเกาะ และชั้นเชื่อมต่อของ CORE อยู่ด้านล่างเชื่อมทุกแผนก',
    gap: 'รอ',
    layer: 'CORE · สถานะงานเดียวกันทั้งองค์กร',
    primary: 'ดูว่า CORE ทำงานอย่างไร',
    about: 'รู้จัก PDA BLISS',
  },
  origin: {
    kicker: 'ที่มาของ CORE',
    title: 'CORE ไม่ได้เริ่มจากรายการฟีเจอร์\nแต่เริ่มจากรูปแบบ|ที่เกิดซ้ำเมื่อองค์กรเติบโต',
    lead: 'ในองค์กรเล็ก ทุกคนเห็นงานเดียวกันและคุยกันได้ทันที เมื่อองค์กรเติบโต โครงสร้างที่จำเป็นต่อการขยายตัว ก็สร้างระยะห่างระหว่างงานไปพร้อมกัน',
    visual: 'ภาพประกอบ: หกขั้นของการเติบโตขององค์กร จากบทบาทที่แยกออกจากกัน จนถึงการมองเห็นที่ลดลง',
    stages: {
      roles: { title: 'บทบาทแยกออกจากกัน', body: 'คนหนึ่งคนไม่ได้ทำทุกอย่างอีกต่อไป' },
      departments: {
        title: 'เกิดเป็นแผนก',
        body: 'งานที่คล้ายกันรวมเป็นทีม มีหัวหน้าและวิธีทำงานของตัวเอง',
      },
      handoffs: { title: 'การส่งต่องานมากขึ้น', body: 'งานหนึ่งชิ้นต้องผ่านหลายมือก่อนเสร็จ' },
      approvals: { title: 'การอนุมัติมากขึ้น', body: 'การตัดสินใจสำคัญต้องมีผู้รับผิดชอบรับรอง' },
      systems: { title: 'ระบบเพิ่มขึ้นทีละตัว', body: 'แต่ละแผนกหาเครื่องมือของตัวเอง' },
      visibility: { title: 'การมองเห็นลดลง', body: 'ไม่มีใครเห็นเส้นทางทั้งหมดของงาน' },
    } satisfies Record<Growth, Titled>,
    conclusion:
      'CORE ถูกออกแบบรอบความจริงข้อนี้ — ไม่ใช่เพื่อลดโครงสร้างขององค์กร แต่เพื่อไม่ให้งานหายไปในช่องว่างระหว่างโครงสร้าง',
  },
  shift: {
    kicker: 'จาก ONE LARGE SYSTEM สู่ CORE',
    title: 'ระบบใหญ่ระบบเดียว\nทำให้ทุกคน|เห็นข้อมูลมากเกินไป',
    titleB: 'CORE ให้แต่ละคนเห็นงานของตัวเอง|บนสถานะงานเดียวกัน',
    lead: 'เมื่อทุกคนเข้าโครงสร้างเดียวกัน ความซับซ้อนของทั้งองค์กรก็ตกอยู่กับผู้ใช้ทุกคน CORE แยกประสบการณ์ตามความรับผิดชอบ แต่เก็บสถานะงานไว้ร่วมกัน',
    viewAs: 'ดูจากมุมของ',
    before: {
      label: 'ONE LARGE SYSTEM',
      title: 'หน้าจอเดียว สำหรับทุกคน',
      points: [
        'หน้าจอเดียวสำหรับทุกคน',
        'โมดูลจำนวนมาก',
        'เห็นข้อมูลเกินหน้าที่',
        'ความซับซ้อนถูกผลักไปที่ผู้ใช้',
      ],
    },
    after: {
      label: 'CORE',
      title: 'พื้นที่ทำงานต่างกัน สถานะงานเดียวกัน',
      points: [
        'ประสบการณ์เฉพาะของแต่ละแผนก',
        'สถานะงานร่วมกัน',
        'ข้อมูลตามความรับผิดชอบ',
        'Workflow ที่เชื่อมกัน',
      ],
    },
    modules: {
      sales: 'งานขาย',
      warehouse: 'คลังสินค้า',
      operations: 'ปฏิบัติการ',
      purchasing: 'จัดซื้อ',
      accounting: 'บัญชีและการเงิน',
      pricing: 'ราคาและต้นทุน',
      executive: 'รายงานผู้บริหาร',
      settings: 'ตั้งค่าระบบ',
    } satisfies Record<Module, string>,
    moduleCount: (n: number) => `1 หน้าจอ · ${n} โมดูล`,
    excess: 'เห็นโดยไม่จำเป็น',
    own: 'งานของคุณอยู่ตรงนี้',
    beforeCaption: (who: string) => `${who}: เห็นทุกโมดูล แล้วต้องหาเองว่างานของตัวเองอยู่ตรงไหน`,
    afterCaption: (who: string) => `${who}: เปิดมาเจองานของตัวเอง และเห็นสถานะงานเดียวกับทุกแผนก`,
    needs: {
      sales: ['ใบเสนอราคา', 'คำสั่งขาย', 'ติดตามการส่งมอบ'],
      warehouse: ['รายการจัดเตรียม', 'Lot และวันหมดอายุ', 'จำนวนที่ต้องจ่าย'],
      operations: ['แผนงาน', 'Work Order', 'งานที่ติด'],
      purchasing: ['PR ที่รออนุมัติ', 'PO ที่รอรับ', 'Supplier ที่ล่าช้า'],
      accounting: ['เอกสารที่ต้องตรวจ', 'รายการรอวางบิล', 'การกระทบยอด'],
      executive: ['งานที่ติด', 'ข้อยกเว้น', 'สุขภาพของแต่ละแผนก'],
    } satisfies Record<Viewer, readonly string[]>,
    shared: 'สถานะงานร่วม',
    sharedValue: 'SO-1042 · รอจัดส่ง',
    note: 'นี่คือแนวทางการออกแบบของ PDA BLISS ไม่ใช่การบอกว่าระบบแบบเดิมไม่ดี — หลายองค์กรใช้ระบบเหล่านั้นได้ดี',
  },
  departments: {
    kicker: 'หน้าที่ต่างกัน หน้าจอจึงต่างกัน',
    title: 'แต่ละความรับผิดชอบ\nต้องการ|หน้าจอที่ต่างกัน',
    lines: {
      sales: { who: 'ฝ่ายขาย', rest: 'ไม่จำเป็นต้องเห็นหน้าจอของคลังสินค้า' },
      warehouse: { who: 'คลังสินค้า', rest: 'ไม่จำเป็นต้องเห็นข้อมูลการเงิน' },
      accounting: { who: 'บัญชี', rest: 'ไม่จำเป็นต้องใช้หน้าจอสแกนของคลัง' },
      executive: { who: 'ผู้บริหาร', rest: 'ไม่จำเป็นต้องเห็นทุกธุรกรรม' },
    } satisfies Record<
      'sales' | 'warehouse' | 'accounting' | 'executive',
      { who: string; rest: string }
    >,
    conclusion: 'หน้าที่ต่างกัน จึงต้องการหน้าจอที่ต่างกัน',
    privacy:
      'สำหรับคลังสินค้า นี่ไม่ใช่แค่การซ่อนคอลัมน์ — CORE ออกแบบให้ข้อมูลราคาไม่ถูกส่งไปยังพื้นที่ทำงานของคลังตั้งแต่ต้น',
    link: 'สำรวจแต่ละแผนก',
  },
  connected: {
    kicker: 'เชื่อมกัน ไม่ใช่แยกขาด',
    title: 'แยกตามแผนก\nไม่ได้แปลว่า|ตัดขาดจากกัน',
    lead: 'ทุกแผนกเห็นงานชิ้นเดียวกันในแบบที่ตัวเองต้องใช้ เมื่อสถานะเปลี่ยนในแผนกหนึ่ง ทุกแผนกที่เกี่ยวข้องเห็นการเปลี่ยนแปลงเดียวกัน',
    visual: 'ภาพประกอบ: หกแผนกเห็นคำสั่งขาย SO-1042 คนละมุม แต่ทุกมุมอ่านจากสถานะงานเดียวกัน',
    workspace: 'พื้นที่ทำงาน',
    views: {
      sales: 'ยืนยันกับลูกค้าแล้ว',
      warehouse: 'จัดเตรียม 24 ชิ้น · LOT-B12',
      operations: 'กำหนดส่งวันพฤหัสบดี',
      purchasing: 'วัตถุดิบครบแล้ว',
      accounting: 'รอเอกสารส่งมอบ',
      executive: 'เป็นไปตามแผน',
    } satisfies Record<Viewer, string>,
    doc: 'SO-1042',
    state: 'สถานะงานเดียวกัน',
    stateValue: 'รอจัดส่ง',
  },
  humanError: {
    kicker: 'Human Error',
    title: 'Human Error |ไม่ได้แก้ได้\nด้วยการบอกให้คน|ระวังมากขึ้น',
    lead: 'คนเหนื่อย คนรีบ และคนเปลี่ยนหน้าที่ได้เสมอ ถ้าความถูกต้องขึ้นอยู่กับความจำและความระมัดระวังของทุกคนตลอดเวลา ความผิดพลาดก็จะเกิดซ้ำ',
    record: { title: 'ระบบที่บันทึก', body: 'รู้ว่าเกิดอะไรขึ้น — หลังจากที่เกิดไปแล้ว' },
    prevent: {
      title: 'ระบบที่ช่วยป้องกัน',
      body: 'ทำให้สถานะที่ผิดเกิดขึ้นได้ยาก — ตั้งแต่ก่อนเกิด',
    },
    statement:
      'CORE ไม่ควรเป็นเพียงที่บันทึกว่าเกิดอะไรขึ้น แต่ควรช่วยไม่ให้สถานะที่ผิดเกิดขึ้นตั้งแต่แรก',
    visual:
      'ภาพประกอบ: งานเดินผ่านสถานะต่าง ๆ เมื่อกำลังจะเลือก Lot ผิด CORE แนะนำ Lot ที่ถูกต้องก่อน งานจึงไปต่อในสถานะที่ถูกต้อง',
    track: ['ใบเบิก', 'เลือก Lot', 'ยืนยันจ่าย', 'ส่งต่อ'],
    blocked: 'จ่าย Lot ที่หมดอายุช้ากว่า',
    blockedLabel: 'สถานะที่ไม่ควรเกิด',
    guide: 'CORE แนะนำ Lot ตามลำดับ FEFO',
    guardsTitle: 'ระบบจึงถูกออกแบบให้',
    guards: {
      guide: {
        verb: 'นำทาง',
        example: 'แนะนำ Lot ที่ควรจ่ายก่อนตามวันหมดอายุ ก่อนยืนยันการจ่ายสินค้า',
      },
      validate: { verb: 'ตรวจสอบ', example: 'เทียบจำนวนที่รับจริงกับ PO ทันทีที่บันทึก' },
      reveal: {
        verb: 'ทำให้มองเห็น',
        example: 'แจ้งจัดซื้อและปฏิบัติการเมื่อ PO เลยกำหนด และมีงานรออยู่',
      },
      control: { verb: 'ควบคุม', example: 'งานสำคัญไม่ไปต่อ จนกว่าเอกสารครบและได้รับอนุมัติ' },
      preserve: { verb: 'เก็บบริบท', example: 'บันทึกว่าใครเปลี่ยนอะไร เมื่อไร และเพราะอะไร' },
    } satisfies Record<Guard, { verb: string; example: string }>,
    note: 'ตัวอย่างเหล่านี้คือสิ่งที่ CORE ถูกออกแบบมาเพื่อรองรับ ไม่ใช่การรับประกันว่าความผิดพลาดจะไม่เกิดขึ้นเลย',
    solutions: 'ดูปัญหา Human Error ในงานจริง',
    how: 'ดูกลไกใน How CORE Works',
  },
  executive: {
    kicker: 'มุมมองผู้บริหาร',
    title: 'ผู้บริหารควรเห็นสิ่งที่ต้องตัดสินใจ\nไม่ใช่เสียงรบกวน|จากงานทุกชิ้น',
    lead: 'งานประจำวันจำนวนมากเป็นเรื่องของแต่ละแผนก สิ่งที่ผู้บริหารต้องเห็นคือสัญญาณที่บอกว่าตรงไหนต้องการการตัดสินใจ',
    visual:
      'ภาพประกอบ: จุดเล็ก ๆ จำนวนมากแทนงานทั้งหมดในแต่ละวัน ถูกกรองเหลือสัญญาณห้าประเภทที่ผู้บริหารต้องเห็น',
    noise: 'งานทั้งหมดในแต่ละวัน',
    signalsLabel: 'สิ่งที่ผู้บริหารเห็น',
    signals: {
      bottlenecks: { title: 'คอขวด', body: 'ขั้นตอนที่งานสะสม' },
      exceptions: { title: 'ข้อยกเว้น', body: 'งานที่ไม่เป็นไปตามเงื่อนไข' },
      waiting: { title: 'งานที่รอ', body: 'งานที่รอการตัดสินใจ หรือรออีกแผนก' },
      risk: { title: 'ความเสี่ยง', body: 'สิ่งที่อาจกระทบลูกค้าหรือกำหนดส่ง' },
      health: { title: 'สุขภาพของแต่ละแผนก', body: 'ภาระงานและงานค้างของแต่ละทีม' },
    } satisfies Record<Signal, Titled>,
    link: 'ดูพื้นที่ทำงานของผู้บริหาร',
  },
  nextAction: {
    kicker: 'Software ที่ดีควรหายไป',
    title: 'Software ที่ดี\nควรทำให้งานถัดไป|ชัดเจน',
    body: 'ผู้ใช้ไม่ควรต้องเข้าใจทั้งระบบ เพื่อทำงานของตัวเองให้ถูกต้อง เมื่อระบบออกแบบดีพอ คนจะเห็นงาน — ไม่ใช่เห็น Software',
    label: 'งานถัดไปของคุณ',
    task: 'ตรวจรับสินค้า PO-2381',
    meta: '3 รายการ · คลังสินค้า A',
  },
  see: {
    title: 'ดูว่าแนวคิดนี้|กลายเป็นการทำงานจริงอย่างไร',
    primary: 'ดูว่า CORE ทำงานอย่างไร',
    secondary: 'สำรวจแต่ละแผนก',
    demo: 'ขอ Demo',
    about: 'รู้จัก PDA BLISS',
    tryDemo: 'ลองดูแนวคิดนี้ใน Demo',
  },
};

export type WhyCoreCopy = typeof th;

export const WHY_CORE: Localized<WhyCoreCopy> = {
  th,
  en: {
    meta: {
      title: 'Why we built CORE — real work gets stuck between departments',
      description:
        'The origin of PDA BLISS CORE: as organizations grow, work gets stuck between departments. CORE gives each department its own workspace on one shared work state — with a Human Error philosophy and an executive view built for decisions.',
    },
    hero: {
      eyebrow: 'Why CORE',
      titleA: 'We did not build CORE\nbecause organizations need one more piece of software',
      titleB: 'We built CORE\nbecause real work gets stuck between departments',
      lead: 'Most work does not go wrong inside one department. It stalls at the seams — when it has to be handed over, approved, or wait for information from someone else. CORE was designed for those seams.',
      visual:
        'Illustration: six departments as separate islands, gaps where work waits between them, and the CORE connection layer beneath linking every department',
      gap: 'Waiting',
      layer: 'CORE · one work state for the whole organization',
      primary: 'See how CORE works',
      about: 'About PDA BLISS',
    },
    origin: {
      kicker: 'Where CORE comes from',
      title:
        'CORE did not start from a feature list.\nIt started from a pattern that repeats as organizations grow.',
      lead: 'In a small organization, everyone sees the same work and can talk straight away. As it grows, the structure it needs in order to scale also creates distance between pieces of work.',
      visual:
        'Illustration: six stages of organizational growth, from roles separating to visibility decreasing',
      stages: {
        roles: { title: 'Roles separate', body: 'One person no longer does everything.' },
        departments: {
          title: 'Departments form',
          body: 'Similar work becomes a team, with its own lead and way of working.',
        },
        handoffs: {
          title: 'Handoffs increase',
          body: 'One piece of work passes through many hands.',
        },
        approvals: {
          title: 'Approvals increase',
          body: 'Important decisions need someone accountable to sign them off.',
        },
        systems: { title: 'Systems multiply', body: 'Each department finds its own tools.' },
        visibility: {
          title: 'Visibility decreases',
          body: 'No one sees the whole path of the work.',
        },
      },
      conclusion:
        'CORE was designed around this reality — not to reduce an organization’s structure, but so work does not disappear into the gaps between it.',
    },
    shift: {
      kicker: 'From ONE LARGE SYSTEM to CORE',
      title: 'One large system\ngives everyone too much information',
      titleB: 'CORE shows each person their own work, on one shared state',
      lead: 'When everyone enters the same structure, the complexity of the whole organization lands on every user. CORE separates the experience by responsibility, and keeps the state of the work shared.',
      viewAs: 'View as',
      before: {
        label: 'ONE LARGE SYSTEM',
        title: 'One interface for everyone',
        points: [
          'One interface for everyone',
          'Many modules',
          'Excessive visibility',
          'Complexity pushed to users',
        ],
      },
      after: {
        label: 'CORE',
        title: 'Different workspaces, one work state',
        points: [
          'Department-specific experience',
          'Shared state',
          'Responsibility-based information',
          'Connected workflow',
        ],
      },
      modules: {
        sales: 'Sales',
        warehouse: 'Warehouse',
        operations: 'Operations',
        purchasing: 'Purchasing',
        accounting: 'Accounting & finance',
        pricing: 'Prices & costs',
        executive: 'Executive reports',
        settings: 'System settings',
      },
      moduleCount: (n) => `1 interface · ${n} modules`,
      excess: 'Shown without need',
      own: 'Your work is in here',
      beforeCaption: (who) => `${who}: sees every module, then has to find where their own work is`,
      afterCaption: (who) =>
        `${who}: opens straight onto their own work, and sees the same work state as every department`,
      needs: {
        sales: ['Quotations', 'Sales orders', 'Delivery follow-up'],
        warehouse: ['Pick lists', 'Lots and expiry dates', 'Quantities to issue'],
        operations: ['Work plan', 'Work orders', 'Blocked work'],
        purchasing: ['PRs awaiting approval', 'POs awaiting receipt', 'Late suppliers'],
        accounting: ['Documents to check', 'Ready to bill', 'Reconciliation'],
        executive: ['Blocked work', 'Exceptions', 'Department health'],
      },
      shared: 'Shared work state',
      sharedValue: 'SO-1042 · Awaiting delivery',
      note: 'This is PDA BLISS’s design philosophy, not a claim that traditional systems are bad — many organizations use them well.',
    },
    departments: {
      kicker: 'Different duties, different screens',
      title: 'Different responsibilities\nrequire different interfaces',
      lines: {
        sales: { who: 'Sales', rest: 'does not need Warehouse screens' },
        warehouse: { who: 'Warehouse', rest: 'does not need financial information' },
        accounting: { who: 'Accounting', rest: 'does not need the warehouse scanning UI' },
        executive: { who: 'Executives', rest: 'do not need every transaction' },
      },
      conclusion: 'Different responsibilities require different interfaces.',
      privacy:
        'For the Warehouse this is not just hiding a column — CORE is designed so pricing is never sent to the Warehouse workspace in the first place.',
      link: 'Explore each department',
    },
    connected: {
      kicker: 'Connected, not isolated',
      title: 'Department-specific\ndoes not mean disconnected',
      lead: 'Every department sees the same piece of work in the way it needs. When the state changes in one department, every department involved sees the same change.',
      visual:
        'Illustration: six departments see sales order SO-1042 from different angles, all reading from the same work state',
      workspace: 'Workspace',
      views: {
        sales: 'Confirmed with customer',
        warehouse: 'Pick 24 units · LOT-B12',
        operations: 'Due Thursday',
        purchasing: 'Materials complete',
        accounting: 'Awaiting delivery documents',
        executive: 'On plan',
      },
      doc: 'SO-1042',
      state: 'Same work state',
      stateValue: 'Awaiting delivery',
    },
    humanError: {
      kicker: 'Human Error',
      title: 'Human Error is not solved\nby telling people to be more careful',
      lead: 'People get tired, rush and change roles. If being right depends on everyone’s memory and care at every moment, mistakes repeat.',
      record: {
        title: 'A system that records',
        body: 'Knows what happened — after it has happened.',
      },
      prevent: {
        title: 'A system that helps prevent',
        body: 'Makes a bad state hard to reach — before it happens.',
      },
      statement:
        'CORE should not merely store what happened. It should help prevent bad states from happening.',
      visual:
        'Illustration: work moves through states; when the wrong lot is about to be chosen, CORE suggests the right lot first, so work continues in a correct state',
      track: ['Issue request', 'Choose lot', 'Confirm issue', 'Hand over'],
      blocked: 'Issue the later-expiring lot',
      blockedLabel: 'A state that should not happen',
      guide: 'CORE suggests the lot in FEFO order',
      guardsTitle: 'So the system is designed to',
      guards: {
        guide: {
          verb: 'Guide',
          example: 'Suggest the lot to issue first by expiry date, before the issue is confirmed.',
        },
        validate: {
          verb: 'Validate',
          example: 'Compare quantities received with the PO as soon as they are recorded.',
        },
        reveal: {
          verb: 'Reveal',
          example:
            'Alert purchasing and operations when a PO is overdue and work is waiting on it.',
        },
        control: {
          verb: 'Control',
          example: 'Important work does not move on until documents are complete and approved.',
        },
        preserve: {
          verb: 'Preserve context',
          example: 'Record who changed what, when, and why.',
        },
      },
      note: 'These examples are what CORE is designed to support — not a guarantee that mistakes never happen.',
      solutions: 'See Human Error problems in real work',
      how: 'See the mechanism in How CORE Works',
    },
    executive: {
      kicker: 'The executive view',
      title: 'Management should see what needs a decision —\nnot the noise of every task',
      lead: 'Most daily work belongs to each department. What management needs to see are the signals that show where a decision is needed.',
      visual:
        'Illustration: many small dots stand for all the work of a day, filtered down to five kinds of signal that management needs to see',
      noise: 'All of a day’s work',
      signalsLabel: 'What management sees',
      signals: {
        bottlenecks: { title: 'Bottlenecks', body: 'Steps where work piles up' },
        exceptions: { title: 'Exceptions', body: 'Work that does not meet its conditions' },
        waiting: { title: 'Waiting', body: 'Work waiting for a decision or another department' },
        risk: { title: 'Risk', body: 'What could affect a customer or a due date' },
        health: { title: 'Department health', body: 'Each team’s workload and backlog' },
      },
      link: 'See the Executive workspace',
    },
    nextAction: {
      kicker: 'Good software should disappear',
      title: 'Good software\nmakes the next action obvious',
      body: 'Users should not need to understand the entire system to do their job correctly. When a system is designed well enough, people see the work — not the software.',
      label: 'Your next action',
      task: 'Receive goods for PO-2381',
      meta: '3 lines · Warehouse A',
    },
    see: {
      title: 'See how this idea\nbecomes real work',
      primary: 'See how CORE works',
      secondary: 'Explore each department',
      demo: 'Request a demo',
      about: 'About PDA BLISS',
      tryDemo: 'Try this idea in the demo',
    },
  },
  'zh-CN': {
    meta: {
      title: '我们为何打造 CORE——真实工作常卡在部门之间',
      description:
        'PDA BLISS CORE 的由来：组织成长后，工作开始卡在部门之间。CORE 让每个部门拥有自己的工作空间，并共享同一个工作状态，同时体现了关于人为错误和管理层视图的理念。',
    },
    hero: {
      eyebrow: 'Why CORE',
      titleA: '我们打造 CORE\n不是因为组织还需要一个软件',
      titleB: '而是因为\n真实工作常常卡在部门之间',
      lead: '多数工作并不是在某个部门内部出错，而是停在衔接处——需要交接、等待审批，或等待另一方的信息时。CORE 正是为这些衔接处而设计的。',
      visual:
        '示意图：六个部门像彼此分开的岛屿，岛屿之间是工作等待的缝隙，下方的 CORE 连接层把所有部门连在一起',
      gap: '等待',
      layer: 'CORE · 全组织同一个工作状态',
      primary: '了解 CORE 如何运作',
      about: '了解 PDA BLISS',
    },
    origin: {
      kicker: 'CORE 的由来',
      title: 'CORE 不是从功能清单开始的\n而是从组织成长时反复出现的模式开始的',
      lead: '在小型组织里，每个人看到的是同样的工作，随时可以沟通。组织成长后，扩张所需的结构也在工作之间拉开了距离。',
      visual: '示意图：组织成长的六个阶段，从角色分工到可见性下降',
      stages: {
        roles: { title: '角色分开', body: '一个人不再包办所有事情。' },
        departments: { title: '形成部门', body: '相似的工作组成团队，有自己的负责人和做法。' },
        handoffs: { title: '交接增多', body: '一项工作要经过很多人才能完成。' },
        approvals: { title: '审批增多', body: '重要决定需要有人负责确认。' },
        systems: { title: '系统增多', body: '每个部门各自寻找工具。' },
        visibility: { title: '可见性下降', body: '没有人能看到工作的完整路径。' },
      },
      conclusion:
        'CORE 正是围绕这一现实而设计的——不是为了减少组织的结构，而是为了不让工作消失在结构之间的缝隙里。',
    },
    shift: {
      kicker: '从 ONE LARGE SYSTEM 到 CORE',
      title: '一个大系统\n让每个人看到太多信息',
      titleB: 'CORE 让每个人看到自己的工作，并共享同一个状态',
      lead: '当所有人进入同一个结构，整个组织的复杂性就落在每个用户身上。CORE 按职责区分体验，同时让工作状态保持共享。',
      viewAs: '以此视角查看',
      before: {
        label: 'ONE LARGE SYSTEM',
        title: '所有人共用一个界面',
        points: ['所有人共用一个界面', '模块众多', '看到超出职责的信息', '复杂性被推给用户'],
      },
      after: {
        label: 'CORE',
        title: '不同的工作空间，同一个工作状态',
        points: ['各部门专属的体验', '共享状态', '按职责提供信息', '相互连接的工作流'],
      },
      modules: {
        sales: '销售',
        warehouse: '仓库',
        operations: '运营',
        purchasing: '采购',
        accounting: '会计与财务',
        pricing: '价格与成本',
        executive: '管理层报表',
        settings: '系统设置',
      },
      moduleCount: (n) => `1 个界面 · ${n} 个模块`,
      excess: '不需要却看得到',
      own: '您的工作在这里',
      beforeCaption: (who) => `${who}：看到所有模块，还要自己找到自己的工作在哪里`,
      afterCaption: (who) => `${who}：一打开就是自己的工作，并与所有部门看到同一个工作状态`,
      needs: {
        sales: ['报价单', '销售订单', '交付跟进'],
        warehouse: ['拣货清单', '批次与有效期', '待发数量'],
        operations: ['工作计划', '工单', '受阻工作'],
        purchasing: ['待审批请购单', '待收货采购单', '延迟的供应商'],
        accounting: ['待核对单据', '待开票', '对账'],
        executive: ['受阻工作', '例外', '部门健康度'],
      },
      shared: '共享工作状态',
      sharedValue: 'SO-1042 · 待发货',
      note: '这是 PDA BLISS 的设计理念，并不是说传统系统不好——很多组织用得很好。',
    },
    departments: {
      kicker: '职责不同，界面不同',
      title: '不同的职责\n需要不同的界面',
      lines: {
        sales: { who: '销售', rest: '不需要看到仓库的界面' },
        warehouse: { who: '仓库', rest: '不需要看到财务信息' },
        accounting: { who: '财务', rest: '不需要仓库的扫码界面' },
        executive: { who: '管理层', rest: '不需要看到每一笔交易' },
      },
      conclusion: '职责不同，所以需要不同的界面。',
      privacy:
        '对仓库而言，这不只是隐藏某一列——CORE 的设计让价格信息从一开始就不会发送到仓库工作空间。',
      link: '了解各个部门',
    },
    connected: {
      kicker: '相互连接，而非彼此隔离',
      title: '按部门区分\n不等于彼此割裂',
      lead: '每个部门以自己需要的方式看到同一项工作。一个部门里的状态发生变化，所有相关部门看到的是同一个变化。',
      visual: '示意图：六个部门从不同角度查看销售订单 SO-1042，但都读取同一个工作状态',
      workspace: '工作空间',
      views: {
        sales: '已与客户确认',
        warehouse: '拣货 24 件 · LOT-B12',
        operations: '周四交付',
        purchasing: '原料已齐',
        accounting: '等待交付单据',
        executive: '按计划进行',
      },
      doc: 'SO-1042',
      state: '同一个工作状态',
      stateValue: '待发货',
    },
    humanError: {
      kicker: 'Human Error',
      title: '人为错误\n不是靠提醒大家更小心就能解决的',
      lead: '人会疲惫、会赶时间、会换岗。如果正确与否取决于每个人时刻的记忆和细心，错误就会反复发生。',
      record: { title: '只做记录的系统', body: '知道发生了什么——在事情发生之后。' },
      prevent: { title: '帮助预防的系统', body: '让错误状态难以出现——在事情发生之前。' },
      statement: 'CORE 不应只是记录发生了什么，而应帮助防止错误状态的出现。',
      visual:
        '示意图：工作依次经过各个状态；当即将选错批次时，CORE 先建议正确的批次，工作因此在正确的状态下继续',
      track: ['领料单', '选择批次', '确认发货', '交接'],
      blocked: '发出有效期更晚的批次',
      blockedLabel: '不应出现的状态',
      guide: 'CORE 按 FEFO 顺序建议批次',
      guardsTitle: '因此，系统被设计为',
      guards: {
        guide: { verb: '引导', example: '确认发货前，按有效期建议应先发出的批次。' },
        validate: { verb: '校验', example: '一经录入，即把实际收货数量与采购单对比。' },
        reveal: { verb: '显现', example: '采购单逾期且有工作在等待时，提醒采购与运营。' },
        control: { verb: '控制', example: '单据不齐、未获批准之前，重要工作不会继续。' },
        preserve: { verb: '保留上下文', example: '记录谁在何时修改了什么，以及原因。' },
      },
      note: '这些示例是 CORE 设计上要支持的内容——并不保证错误永远不会发生。',
      solutions: '查看真实工作中的人为错误问题',
      how: '在 How CORE Works 中查看机制',
    },
    executive: {
      kicker: '管理层视图',
      title: '管理层应看到需要决策的事项\n而不是每项工作的噪音',
      lead: '大量日常工作属于各个部门。管理层需要看到的是那些指出哪里需要决策的信号。',
      visual: '示意图：许多小点代表一天中的全部工作，经过筛选后只剩管理层需要看到的五类信号',
      noise: '一天中的全部工作',
      signalsLabel: '管理层看到的内容',
      signals: {
        bottlenecks: { title: '瓶颈', body: '工作堆积的环节' },
        exceptions: { title: '例外', body: '不符合条件的工作' },
        waiting: { title: '等待', body: '等待决策或等待其他部门的工作' },
        risk: { title: '风险', body: '可能影响客户或交期的事项' },
        health: { title: '部门健康度', body: '各团队的工作量与积压' },
      },
      link: '查看管理层工作空间',
    },
    nextAction: {
      kicker: '好的软件应当隐于无形',
      title: '好的软件\n让下一步一目了然',
      body: '用户不需要理解整个系统，也能正确完成自己的工作。系统设计得足够好时，人们看到的是工作——而不是软件。',
      label: '您的下一步',
      task: '为 PO-2381 收货',
      meta: '3 行 · A 仓库',
    },
    see: {
      title: '看看这一理念\n如何变成真实的工作',
      primary: '了解 CORE 如何运作',
      secondary: '了解各个部门',
      demo: '申请演示',
      about: '了解 PDA BLISS',
      tryDemo: '在演示中体验这一理念',
    },
  },
};

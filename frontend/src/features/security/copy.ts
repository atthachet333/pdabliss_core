import type { Localized } from '@/i18n/useCopy';
import type {
  ControlId,
  FaqId,
  Field,
  MatrixRow,
  SecurityRole,
  TraceEvent,
  TracePart,
} from './model';

/*
 * /security words (EP15). Structure and statuses live in model.ts; status
 * labels come from the EP10 enterprise copy (one taxonomy, site-wide).
 *
 * Claim safety: no certification, compliance, uptime, recovery-time or
 * guarantee claims, in any language. Tests scan every string.
 */

type Item = { title: string; body: string };
type Pair = { label: string; value: string };

const th = {
  meta: {
    title: 'ความปลอดภัยและความไว้วางใจ — ทุกคนไม่ควรเห็นทุกอย่าง',
    description:
      'แนวทางด้านความปลอดภัยของ PDA BLISS CORE: การมองเห็นข้อมูลตามหน้าที่ ขอบเขตของคลังสินค้า ผู้บริหารกับผู้ดูแลระบบ การติดตามย้อนหลัง และสถานะที่ระบุตรงไปตรงมาว่าสิ่งใดมีแล้ว สิ่งใดอยู่ในแผน',
  },
  hero: {
    eyebrow: 'Security & Trust · ความปลอดภัยและความไว้วางใจ',
    title: 'ทุกคนไม่ควรเห็นทุกอย่าง',
    lead: 'CORE ออกแบบการมองเห็นข้อมูลตามหน้าที่ ความรับผิดชอบ และบริบทของงาน เพื่อให้แต่ละแผนกเห็นสิ่งที่จำเป็นโดยไม่เปิดข้อมูลเกินความต้องการ',
    concept:
      'ความปลอดภัยไม่ได้เริ่มจาก Firewall\nแต่เริ่มจากการที่คนเห็นเฉพาะสิ่งที่จำเป็นต่อหน้าที่',
    notOnly: 'ไม่ใช่แค่',
    notOnlyItems: ['การเข้ารหัส', 'เซิร์ฟเวอร์', 'ใบรับรอง'],
    also: 'แต่รวมถึง',
    pillars: [
      'ความรับผิดชอบ',
      'สิทธิ์การเข้าถึง',
      'การมองเห็น',
      'ขอบเขต',
      'การตรวจสอบย้อนหลัง',
      'การควบคุม',
    ],
    primary: 'พูดคุยเรื่อง Security / Implementation',
    secondary: 'ดู Enterprise',
    demo: 'ดู CORE Demo',
  },
  windows: {
    eyebrow: 'งานเดียวกัน · มุมมองต่างกัน',
    title: 'ข้อมูลไหลไปเฉพาะหน้าต่าง\nที่ได้รับอนุญาต',
    lead: 'งานหนึ่งชิ้นมีข้อมูลหลายส่วน แต่ละบทบาทได้รับเฉพาะส่วนที่จำเป็นต่อหน้าที่ — ส่วนที่ไม่จำเป็นหยุดก่อนถึงหน้าต่างนั้น เลือกบทบาทเพื่อดู',
    group: 'เลือกบทบาท',
    object: 'งานชิ้นเดียวกัน',
    objectId: 'SO-1042 · คำสั่งซื้อพร้อมการเติมสินค้า',
    count: 'เห็น {n} จาก {total}',
    reaches: 'ส่งถึงมุมมองนี้',
    stops: 'หยุดก่อนถึงมุมมองนี้',
    selected: 'กำลังดู',
    note: 'ตัวอย่างเพื่ออธิบายแนวคิด — บทบาทและข้อมูลจริงกำหนดตามขอบเขตการวางระบบของแต่ละองค์กร ไม่ใช่โมเดลสิทธิ์สุดท้ายของระบบจริง',
    roles: {
      sales: { name: 'ฝ่ายขาย', focus: 'คำสั่งซื้อ ลูกค้า และการส่งมอบ' },
      warehouse: { name: 'คลังสินค้า', focus: 'สินค้า ตำแหน่ง Lot วันหมดอายุ การรับและจัด' },
      purchasing: { name: 'จัดซื้อ', focus: 'การสั่งซื้อ Supplier และของค้างรับ' },
      accounting: { name: 'บัญชีและการเงิน', focus: 'เอกสาร ยอดชำระ และความพร้อมชำระ' },
      executive: { name: 'ผู้บริหาร', focus: 'ภาพรวม ข้อยกเว้น และความเสี่ยง' },
      admin: { name: 'ผู้ดูแลระบบ', focus: 'ผู้ใช้ สิทธิ์ และการตั้งค่า' },
    } satisfies Record<SecurityRole, { name: string; focus: string }>,
    fields: {
      order: { label: 'ใบสั่งขาย', value: 'SO-1042' },
      customer: { label: 'ลูกค้า', value: 'บริษัท ตัวอย่าง จำกัด' },
      item: { label: 'สินค้า', value: 'น้ำยาทำความสะอาด 5 ลิตร · SKU-7731' },
      quantity: { label: 'จำนวน', value: '120 ชิ้น' },
      location: { label: 'ตำแหน่งจัดเก็บ', value: 'A-03-2' },
      lot: { label: 'Lot', value: 'LOT-B2410' },
      expiry: { label: 'วันหมดอายุ', value: '2027-06-30' },
      receiving: { label: 'การรับสินค้า', value: 'รับแล้ว 80 / 100' },
      picking: { label: 'การจัดสินค้า', value: 'จัดตามลำดับ FEFO' },
      price: { label: 'ราคาขาย', value: '฿48,000' },
      cost: { label: 'ต้นทุน / ราคาซื้อ', value: '฿36,000' },
      margin: { label: 'กำไรขั้นต้น', value: '฿12,000' },
      payment: { label: 'ยอดชำระ', value: 'รอชำระ ฿36,000' },
      terms: { label: 'เงื่อนไขการเงินกับ Supplier', value: 'เครดิต 30 วัน' },
      exception: { label: 'ข้อยกเว้น', value: 'ค้างรับ 20 ชิ้น' },
      permissions: { label: 'สิทธิ์และการตั้งค่า', value: '6 บทบาท · 24 ผู้ใช้' },
    } satisfies Record<Field, Pair>,
  },
  warehouse: {
    eyebrow: 'ตัวอย่างที่ชัดที่สุด',
    title: 'คลังเห็นทุกอย่างที่งานต้องใช้\nยกเว้นตัวเลขที่ไม่เกี่ยวกับงาน',
    lead: 'คนรับและจัดสินค้าต้องรู้ว่าอะไร กี่ชิ้น อยู่ที่ไหน Lot ใด หมดอายุเมื่อไร — แต่ไม่จำเป็นต้องรู้ราคา ต้นทุน หรือกำไร',
    boundary: 'ขอบเขตมุมมองคลัง',
    source: 'งานชิ้นเดียวกัน',
    view: 'มุมมองคลังสินค้า',
    passes: 'เข้ามุมมองคลัง',
    stopped: 'ไม่ถูกส่งเข้ามา',
    seesTitle: 'คลังเห็น',
    notTitle: 'คลังไม่เห็น',
    not: ['ราคาขาย', 'ต้นทุน / ราคาซื้อ', 'กำไร', 'ยอดชำระ', 'เงื่อนไขการเงิน'],
    fact: 'ไม่ใช่การซ่อนคอลัมน์ — ใน Demo ข้อมูลราคาไม่อยู่ในข้อมูลของมุมมองคลังตั้งแต่ต้น และ Backend พื้นฐานสร้างข้อมูลคลังจากรายการข้อมูลที่อนุญาต (Allow-list) เฉพาะประเภทปฏิบัติงาน ซึ่งทดสอบกับข้อมูลตัวอย่าง',
    demo: 'ดูมุมมองคลังใน Demo',
  },
  roles: {
    eyebrow: 'สองบทบาทที่มักถูกรวมกัน',
    title: 'ผู้บริหาร ≠ ผู้ดูแลระบบ',
    lead: 'ผู้บริหารต้องเห็นภาพรวมเพื่อตัดสินใจ ผู้ดูแลระบบต้องตั้งค่าให้ระบบทำงาน — คนละหน้าที่ คนละการมองเห็น',
    neq: 'ไม่ใช่สิ่งเดียวกัน',
    executive: {
      title: 'ผู้บริหาร',
      body: 'การมองเห็นการดำเนินงานทั้งองค์กร',
      items: [
        'ภาพรวมการดำเนินงานทั้งองค์กร',
        'ข้อยกเว้นที่ต้องตัดสินใจ',
        'คอขวดระหว่างแผนก',
        'ความเสี่ยงต่อการส่งมอบ',
        'สุขภาพของแต่ละแผนก',
      ],
      without: 'ไม่จำเป็นต้องตั้งค่าผู้ใช้หรือสิทธิ์',
    },
    admin: {
      title: 'ผู้ดูแลระบบ',
      body: 'การตั้งค่าผู้ใช้และระบบ',
      items: ['ผู้ใช้และบัญชี', 'บทบาทและสิทธิ์', 'การตั้งค่าระบบ', 'โครงสร้างแผนกและสาขา'],
      without: 'ไม่จำเป็นต้องเห็นยอดขาย ต้นทุน หรือกำไร',
    },
  },
  enforcement: {
    eyebrow: 'พูดตรงไปตรงมา',
    title: 'การซ่อนบนหน้าจอ\nยังไม่ใช่ขอบเขตความปลอดภัย',
    lead: 'หน้าจอที่ไม่แสดงราคาช่วยให้คนทำงานง่ายขึ้น — แต่ขอบเขตที่แท้จริงต้องอยู่ที่ Server ซึ่งตัดสินว่าข้อมูลใดถูกส่งให้ใคร ก่อนข้อมูลจะออกจากระบบ',
    neq: 'UI visibility ≠ security boundary',
    ui: {
      title: 'สิ่งที่หน้าจอแสดง',
      body: 'จัดหน้าจอให้เหมาะกับหน้าที่และลดความสับสน — แต่ถ้าข้อมูลถูกส่งมาถึงเครื่องแล้ว การซ่อนไว้ก็ยังไม่ใช่การป้องกัน',
    },
    server: {
      title: 'สิ่งที่ Server อนุญาตให้ส่ง',
      body: 'ตรวจสิทธิ์ก่อนส่งทุกครั้ง และส่งเฉพาะข้อมูลที่บทบาทนั้นได้รับอนุญาต — ข้อมูลที่ไม่ได้รับอนุญาตไม่ถูกส่งออกมาเลย',
    },
    stages: {
      now: {
        label: 'วันนี้',
        body: 'เว็บไซต์ Demo และต้นแบบแสดงแนวทางการมองเห็นตามหน้าที่ — เป็นภาพตัวอย่างของโมเดลที่ตั้งใจไว้ ไม่ใช่การบังคับสิทธิ์ของระบบจริง',
      },
      foundation: {
        label: 'โครงสร้างพื้นฐาน',
        body: 'Backend พื้นฐานจัดประเภทข้อมูล (ปฏิบัติงาน / การค้า / การเงิน) และสร้างข้อมูลแต่ละมุมมองจาก Allow-list — ทดสอบกับข้อมูลตัวอย่างเท่านั้น',
      },
      later: {
        label: 'ระยะ Backend ถัดไป',
        body: 'การยืนยันตัวตนจริง สิทธิ์ของผู้ใช้จริง และการตรวจสิทธิ์ที่ Server ทุกคำขอ — เปิดใช้เมื่อพัฒนาและทดสอบแล้วเท่านั้น',
      },
    },
  },
  trace: {
    eyebrow: 'การติดตามย้อนหลัง',
    title: 'ทุกการเปลี่ยนแปลงสำคัญ\nควรบอกได้ว่าเกิดอะไรขึ้น',
    lead: 'แนวทางที่ตั้งใจไว้: การเปลี่ยนแปลงหนึ่งครั้งควรบอกได้ว่าใคร บทบาทใด แผนกใด ทำอะไร ก่อนและหลังเป็นอย่างไร เกิดขึ้นลำดับใด และอ้างอิงเอกสารใด',
    group: 'เลือกเหตุการณ์',
    parts: {
      who: 'ใคร',
      role: 'บทบาท',
      department: 'แผนก',
      action: 'ทำอะไร',
      before: 'ก่อน',
      after: 'หลัง',
      order: 'เวลา / ลำดับ',
      source: 'อ้างอิง',
    } satisfies Record<TracePart, string>,
    events: {
      receive: {
        label: 'รับสินค้า 80 จาก 100',
        values: {
          who: 'ผู้ใช้คลัง (ตัวอย่าง)',
          role: 'พนักงานรับสินค้า',
          department: 'คลังสินค้า',
          action: 'บันทึกรับสินค้า',
          before: 'รอรับ 0 / 100',
          after: 'รับแล้ว 80 / 100 · ค้างรับ 20',
          order: 'ลำดับที่ 4 · 09:42',
          source: 'PO-2215 · GR-3307',
        },
      },
      lot: {
        label: 'ระบุ Lot และวันหมดอายุ',
        values: {
          who: 'ผู้ใช้คลัง (ตัวอย่าง)',
          role: 'พนักงานรับสินค้า',
          department: 'คลังสินค้า',
          action: 'บันทึก Lot',
          before: 'ยังไม่ระบุ Lot',
          after: 'LOT-B2410 · 2027-06-30',
          order: 'ลำดับที่ 7 · 10:15',
          source: 'GR-3307',
        },
      },
      approve: {
        label: 'อนุมัติเอกสาร',
        values: {
          who: 'ผู้ใช้บัญชี (ตัวอย่าง)',
          role: 'ผู้อนุมัติ',
          department: 'บัญชีและการเงิน',
          action: 'บันทึกการอนุมัติ',
          before: 'รออนุมัติ',
          after: 'อนุมัติแล้ว',
          order: 'ลำดับที่ 10 · 13:30',
          source: 'INV-5521',
        },
      },
    } satisfies Record<TraceEvent, { label: string; values: Record<TracePart, string> }>,
    note: 'โครงสร้างประวัติงานออกแบบไว้แล้ว และ Demo แสดงประวัติจำลองของงานหนึ่งชิ้น — การจัดเก็บประวัติในระบบจริงมาพร้อม Backend ระยะถัดไป',
    demoStatus: 'ประวัติจำลองใน Demo',
  },
  control: {
    eyebrow: 'การควบคุมงานที่สำคัญ',
    title: 'งานที่มีผลมาก\nไม่ควรผ่านได้ด้วยคลิกเดียว',
    lead: 'การกระทำที่มีผลต่อเงิน สินค้า หรือความเสี่ยง สามารถกำหนดให้ต้องมีเงื่อนไขก่อนทำต่อ',
    items: {
      requiredInfo: {
        title: 'ข้อมูลที่ต้องมี',
        body: 'บางขั้นตอนทำต่อไม่ได้จนกว่าจะมีข้อมูลที่จำเป็น',
      },
      approval: {
        title: 'การอนุมัติ',
        body: 'งานที่มีผลทางการเงินหรือความเสี่ยง กำหนดให้ต้องผ่านผู้อนุมัติก่อนได้',
      },
      conditions: {
        title: 'เงื่อนไข',
        body: 'สายอนุมัติเปลี่ยนตามเงื่อนไข เช่น มูลค่า หรือประเภทงาน',
      },
      responsibility: {
        title: 'ความรับผิดชอบตามบทบาท',
        body: 'แต่ละขั้นมีเจ้าของชัดเจน — งานถูกส่งต่อให้คนที่รับผิดชอบ ไม่ใช่ทุกคน',
      },
    } satisfies Record<ControlId, Item>,
    example: 'ตัวอย่างใน Demo: ปิดรับสินค้าไม่ได้ถ้ายังไม่ระบุ Lot และวันหมดอายุ',
    approval: 'ดู Workflow และการอนุมัติ',
    enterprise: 'ดูการควบคุมสำหรับองค์กร',
  },
  data: {
    eyebrow: 'หลักการด้านข้อมูล',
    title: 'หลักการ ไม่ใช่คำสัญญาทางเทคนิค',
    lead: 'แนวทางที่ใช้ออกแบบ CORE และใช้วางระบบร่วมกับแต่ละองค์กร',
    principles: {
      collect: {
        title: 'เก็บเฉพาะที่งานต้องใช้',
        body: 'ออกแบบข้อมูลจากงานจริง ไม่เก็บสิ่งที่ไม่มีใครใช้',
      },
      visibility: {
        title: 'มองเห็นตามหน้าที่',
        body: 'แต่ละบทบาทเห็นสิ่งที่จำเป็นต่อการทำงานของตน',
      },
      trace: {
        title: 'ติดตามการเปลี่ยนแปลงสำคัญ',
        body: 'การเปลี่ยนแปลงที่มีผลต่องาน ควรบอกได้ว่าใคร ทำอะไร เมื่อไร',
      },
      configuration: {
        title: 'แยกหน้าที่การตั้งค่า',
        body: 'คนตั้งค่าสิทธิ์ไม่จำเป็นต้องเป็นคนเห็นตัวเลขธุรกิจ',
      },
      backup: {
        title: 'วางแผนสำรองและกู้คืน',
        body: 'กำหนดนโยบายสำรองข้อมูลและทดสอบการกู้คืนก่อนใช้งานจริง',
      },
      availability: {
        title: 'เฝ้าดูความพร้อมของระบบ',
        body: 'วางการเฝ้าระวังระบบเป็นส่วนหนึ่งของการติดตั้ง',
      },
      hardening: {
        title: 'เตรียมระบบก่อนใช้งานจริง',
        body: 'ระบบที่ใช้กับข้อมูลจริงต้องตั้งค่าและตรวจสอบเพิ่มเติมก่อนเปิดใช้',
      },
    } satisfies Record<string, Item>,
    goLive: {
      title: 'ก่อนใช้งานจริง ต้องมีอะไรบ้าง',
      lead: 'ส่วนนี้กำหนดร่วมกันในขั้นตอนวางระบบ — ยังไม่ใช่บริการที่เปิดใช้งานอยู่ในวันนี้',
      items: {
        backup: 'นโยบายสำรองข้อมูล',
        recovery: 'การทดสอบกู้คืนข้อมูล',
        monitoring: 'การเฝ้าระวังระบบ',
        incident: 'ขั้นตอนรับมือเหตุขัดข้อง',
      },
      pending: 'กำหนดในการวางระบบ',
      note: 'เราจะไม่ประกาศตัวเลขเวลากู้คืนหรือระดับความพร้อมใช้งาน จนกว่าจะตกลงและวัดผลได้จริงในระบบที่ใช้งาน',
    },
  },
  readiness: {
    eyebrow: 'สถานะวันนี้',
    title: 'อะไรมีแล้ว อะไรอยู่ในแผน',
    lead: 'ทุกชั้นระบุสถานะตามระบบเดียวกับหน้าสำหรับองค์กร',
    layer: 'ชั้น',
    status: 'สถานะ',
    now: 'วันนี้หมายความว่า',
    rows: {
      identity: {
        name: 'การยืนยันตัวตน',
        now: 'หน้าเข้าสู่ระบบวันนี้เป็นต้นแบบสำหรับตรวจหน้าจอเท่านั้น — การยืนยันตัวตนจริง SSO และ MFA อยู่ในแผน',
      },
      access: {
        name: 'การควบคุมสิทธิ์',
        now: 'ต้นแบบและ Demo แสดงการมองเห็นตามบทบาท — การบังคับสิทธิ์กับผู้ใช้จริงที่ Server อยู่ในระยะ Backend ถัดไป',
      },
      workflow: {
        name: 'การควบคุมขั้นตอนงาน',
        now: 'ข้อมูลที่ต้องมี การอนุมัติ และเงื่อนไข กำหนดตามขอบเขตการวางระบบ',
      },
      trace: {
        name: 'การติดตามย้อนหลัง',
        now: 'ออกแบบโครงสร้างประวัติงานแล้ว — Demo แสดงประวัติจำลอง',
      },
      data: {
        name: 'การแยกประเภทข้อมูล',
        now: 'Backend พื้นฐานจัดประเภทข้อมูลและสร้างแต่ละมุมมองจาก Allow-list — ทดสอบกับข้อมูลตัวอย่าง',
      },
      backup: {
        name: 'สำรองและกู้คืน',
        now: 'กำหนดนโยบายและทดสอบในขั้นตอนเตรียมใช้งานจริง',
      },
      observability: {
        name: 'การเฝ้าระวังระบบ',
        now: 'วางแผนพร้อมการติดตั้งระบบจริง',
      },
      integration: {
        name: 'การเชื่อมต่อ',
        now: 'ออกแบบโครงสร้างให้เชื่อมต่อระบบอื่นได้ — ขอบเขตจริงกำหนดในการวางระบบ',
      },
    } satisfies Record<MatrixRow, { name: string; now: string }>,
    notClaim: {
      title: 'สิ่งที่ PDA BLISS ยังไม่อ้าง',
      items: [
        'ยังไม่มีการรับรองมาตรฐานความปลอดภัยจากหน่วยงานภายนอก',
        'ยังไม่ประกาศตัวเลขความพร้อมใช้งาน หรือเวลากู้คืนระบบ',
        'ยังไม่มีการยืนยันตัวตนจริง SSO หรือ MFA ที่เปิดใช้งาน',
        'การจัดหน้าจอตามบทบาทในต้นแบบ ไม่ใช่การบังคับสิทธิ์ของระบบจริง',
      ],
      close: 'เราจะระบุเพิ่มเมื่อมีหลักฐานที่ตรวจสอบได้เท่านั้น',
    },
  },
  faq: {
    eyebrow: 'คำถามที่พบบ่อย',
    title: 'คำถามเรื่องความปลอดภัย',
    items: {
      warehousePrice: {
        q: 'คลังเห็นราคาหรือไม่?',
        a: 'ไม่เห็น — มุมมองคลังออกแบบให้มีเฉพาะสินค้า จำนวน ตำแหน่ง Lot วันหมดอายุ และงานรับ/จัด ใน Demo ข้อมูลราคาไม่อยู่ในข้อมูลของมุมมองคลังตั้งแต่ต้น ในระบบจริง การบังคับใช้นี้จะอยู่ที่ Server',
      },
      sameData: {
        q: 'ผู้ใช้ทุกคนเห็นข้อมูลเหมือนกันหรือไม่?',
        a: 'ไม่ — งานเดียวกัน แต่แต่ละบทบาทเห็นมุมมองที่ต่างกันตามหน้าที่ ขอบเขตจริงกำหนดตามการวางระบบของแต่ละองค์กร',
      },
      execAdmin: {
        q: 'ผู้บริหารกับ Admin ต่างกันอย่างไร?',
        a: 'ผู้บริหารเห็นภาพรวมการดำเนินงาน ข้อยกเว้น คอขวด และความเสี่ยง — Admin ดูแลผู้ใช้ สิทธิ์ และการตั้งค่า โดยไม่จำเป็นต้องเห็นตัวเลขธุรกิจ',
      },
      audit: {
        q: 'CORE เก็บ Audit Trail หรือไม่?',
        a: 'โครงสร้างประวัติงานออกแบบไว้แล้ว (ใคร บทบาท แผนก การกระทำ ก่อน/หลัง ลำดับ และเอกสารอ้างอิง) และ Demo แสดงประวัติจำลอง การจัดเก็บในระบบจริงมาพร้อม Backend ระยะถัดไป',
      },
      sso: {
        q: 'มี SSO หรือไม่?',
        a: 'ยังไม่มี — การยืนยันตัวตนจริงและ SSO อยู่ในแผนพัฒนา หน้าเข้าสู่ระบบวันนี้เป็นต้นแบบสำหรับตรวจหน้าจอเท่านั้น',
      },
      mfa: {
        q: 'มี MFA หรือไม่?',
        a: 'ยังไม่มี — อยู่ในแผนพัฒนาร่วมกับการยืนยันตัวตนจริง',
      },
      backup: {
        q: 'รองรับ Backup อย่างไร?',
        a: 'นโยบายสำรองข้อมูลและการทดสอบกู้คืนกำหนดร่วมกันในขั้นตอนเตรียมใช้งานจริง เรายังไม่ประกาศตัวเลขหรือเงื่อนไขใด ๆ จนกว่าจะตกลงและทดสอบร่วมกัน',
      },
      certification: {
        q: 'มี Certification หรือไม่?',
        a: 'ยังไม่มี — CORE ยังไม่มีการรับรองมาตรฐานความปลอดภัยจากหน่วยงานภายนอก เราจะระบุเฉพาะเมื่อมีหลักฐานที่ตรวจสอบได้',
      },
      separation: {
        q: 'ข้อมูลของแต่ละแผนกแยกกันอย่างไร?',
        a: 'ทุกแผนกทำงานบนงานชิ้นเดียวกัน แต่รับเฉพาะข้อมูลที่จำเป็นต่อหน้าที่ ข้อมูลถูกจัดประเภท (ปฏิบัติงาน / การค้า / การเงิน) และออกแบบให้แต่ละมุมมองรับได้เฉพาะประเภทที่ได้รับอนุญาต',
      },
      integration: {
        q: 'ถ้าต้องการ Integration ต้องทำอย่างไร?',
        a: 'เริ่มจากคุยว่าต้องเชื่อมกับระบบใด ข้อมูลใด และใครรับผิดชอบ — ขอบเขต วิธีเชื่อมต่อ และสิทธิ์ของการเชื่อมต่อ กำหนดร่วมกันในการวางระบบ',
      },
    } satisfies Record<FaqId, { q: string; a: string }>,
  },
  consult: {
    title: 'อยากคุยเรื่องสิทธิ์ ขอบเขต\nและการวางระบบขององค์กรคุณ?',
    lead: 'เริ่มจากว่าใครควรเห็นอะไร แล้วค่อยออกแบบระบบให้ตรงกับความรับผิดชอบจริง',
    primary: 'พูดคุยเรื่อง Security / Implementation',
    secondary: 'ดู Enterprise',
    demo: 'ดู CORE Demo',
  },
};

export type SecurityCopy = typeof th;

export const SECURITY_COPY: Localized<SecurityCopy> = {
  th,
  en: {
    meta: {
      title: 'Security & Trust — not everyone should see everything',
      description:
        'How PDA BLISS CORE approaches security: visibility by responsibility, the Warehouse boundary, Executive vs. Admin, traceability, and plain statuses for what exists today and what is planned.',
    },
    hero: {
      eyebrow: 'Security & Trust',
      title: 'Not everyone should see everything',
      lead: 'CORE shapes what each person sees around their responsibility and the context of the work, so every department sees what it needs — and nothing beyond it.',
      concept:
        'Security does not start with a firewall.\nIt starts with people seeing only what their work requires.',
      notOnly: 'Not only',
      notOnlyItems: ['Encryption', 'Servers', 'Certificates'],
      also: 'but also',
      pillars: ['Responsibility', 'Access', 'Visibility', 'Boundaries', 'Traceability', 'Control'],
      primary: 'Talk about security / implementation',
      secondary: 'See Enterprise',
      demo: 'See the CORE demo',
    },
    windows: {
      eyebrow: 'Same work · different views',
      title: 'Information flows only\ninto permitted windows',
      lead: 'One work item has many parts. Each role receives only what its responsibility needs — the rest stops before it reaches that window. Choose a role.',
      group: 'Choose a role',
      object: 'The same work item',
      objectId: 'SO-1042 · customer order with replenishment',
      count: 'Sees {n} of {total}',
      reaches: 'Reaches this view',
      stops: 'Stops before this view',
      selected: 'Viewing',
      note: 'An illustration of the idea — actual roles and fields are set by each organization’s implementation scope. This is not the final production permission model.',
      roles: {
        sales: { name: 'Sales', focus: 'Orders, customers and delivery' },
        warehouse: {
          name: 'Warehouse',
          focus: 'Items, locations, lots, expiry, receiving and picking',
        },
        purchasing: { name: 'Purchasing', focus: 'Purchase orders, suppliers and open receipts' },
        accounting: {
          name: 'Accounting & Finance',
          focus: 'Documents, payments and payment readiness',
        },
        executive: { name: 'Executive', focus: 'Overview, exceptions and risk' },
        admin: { name: 'System admin', focus: 'Users, permissions and setup' },
      },
      fields: {
        order: { label: 'Sales order', value: 'SO-1042' },
        customer: { label: 'Customer', value: 'Example Co., Ltd.' },
        item: { label: 'Item', value: 'Cleaning solution 5 L · SKU-7731' },
        quantity: { label: 'Quantity', value: '120 units' },
        location: { label: 'Location', value: 'A-03-2' },
        lot: { label: 'Lot', value: 'LOT-B2410' },
        expiry: { label: 'Expiry', value: '2027-06-30' },
        receiving: { label: 'Receiving', value: 'Received 80 / 100' },
        picking: { label: 'Picking', value: 'FEFO order' },
        price: { label: 'Selling price', value: '฿48,000' },
        cost: { label: 'Cost / purchase price', value: '฿36,000' },
        margin: { label: 'Gross margin', value: '฿12,000' },
        payment: { label: 'Payment', value: 'Due ฿36,000' },
        terms: { label: 'Supplier financial terms', value: '30-day credit' },
        exception: { label: 'Exception', value: '20 units outstanding' },
        permissions: { label: 'Permissions & settings', value: '6 roles · 24 users' },
      },
    },
    warehouse: {
      eyebrow: 'The clearest example',
      title: 'The warehouse sees everything the work needs —\nexcept numbers the work doesn’t',
      lead: 'People who receive and pick need to know what, how many, where, which lot and when it expires. They don’t need the price, the cost or the margin.',
      boundary: 'Warehouse view boundary',
      source: 'The same work item',
      view: 'Warehouse view',
      passes: 'Enters the warehouse view',
      stopped: 'Not sent',
      seesTitle: 'The warehouse sees',
      notTitle: 'The warehouse does not see',
      not: [
        'Selling price',
        'Cost / purchase price',
        'Margin',
        'Payment amounts',
        'Financial terms',
      ],
      fact: 'This is not a hidden column. In the demo, prices are not part of the warehouse view’s data at all, and the backend foundation builds warehouse data from an allow-list of operational fields only — tested on sample data.',
      demo: 'See the warehouse view in the demo',
    },
    roles: {
      eyebrow: 'Two roles that often get merged',
      title: 'Executive ≠ System admin',
      lead: 'Executives need the overview to decide. Admins need the settings to make the system work. Different responsibilities, different visibility.',
      neq: 'Not the same',
      executive: {
        title: 'Executive',
        body: 'Organization-wide operational visibility',
        items: [
          'Operations across the organization',
          'Exceptions that need a decision',
          'Bottlenecks between departments',
          'Delivery risk',
          'Each department’s health',
        ],
        without: 'Does not need to manage users or permissions',
      },
      admin: {
        title: 'System admin',
        body: 'User and system configuration',
        items: [
          'Users and accounts',
          'Roles and permissions',
          'System settings',
          'Department and branch structure',
        ],
        without: 'Does not need to see sales, cost or margin figures',
      },
    },
    enforcement: {
      eyebrow: 'Plainly stated',
      title: 'Hiding something on screen\nis not a security boundary',
      lead: 'A screen without prices makes work easier. But the real boundary has to live on the server, which decides what information is sent to whom — before it ever leaves the system.',
      neq: 'UI visibility ≠ security boundary',
      ui: {
        title: 'What the screen shows',
        body: 'Arranged around each responsibility to reduce confusion — but once data has reached a device, hiding it is not protection.',
      },
      server: {
        title: 'What the server allows to be sent',
        body: 'Checks permission before every response and sends only what that role is allowed to receive — anything else is never sent.',
      },
      stages: {
        now: {
          label: 'Today',
          body: 'This website, the demo and the prototype illustrate the intended access model. They are an illustration, not production permission enforcement.',
        },
        foundation: {
          label: 'Foundation',
          body: 'The backend foundation classifies data (operational / commercial / financial) and builds each view from an allow-list — tested on sample data only.',
        },
        later: {
          label: 'Next backend phases',
          body: 'Real identity, real user permissions and server-side checks on every request — switched on only once they are built and tested.',
        },
      },
    },
    trace: {
      eyebrow: 'Traceability',
      title: 'Every important change\nshould explain itself',
      lead: 'The intended model: one change records who, in which role and department, did what, what it was before and after, in what order, and which document it refers to.',
      group: 'Choose an event',
      parts: {
        who: 'Who',
        role: 'Role',
        department: 'Department',
        action: 'Action',
        before: 'Before',
        after: 'After',
        order: 'Time / order',
        source: 'Source',
      },
      events: {
        receive: {
          label: 'Receive 80 of 100',
          values: {
            who: 'Warehouse user (sample)',
            role: 'Receiving staff',
            department: 'Warehouse',
            action: 'Record receipt',
            before: 'Awaiting 0 / 100',
            after: 'Received 80 / 100 · 20 outstanding',
            order: 'Step 4 · 09:42',
            source: 'PO-2215 · GR-3307',
          },
        },
        lot: {
          label: 'Record lot and expiry',
          values: {
            who: 'Warehouse user (sample)',
            role: 'Receiving staff',
            department: 'Warehouse',
            action: 'Record lot',
            before: 'No lot recorded',
            after: 'LOT-B2410 · 2027-06-30',
            order: 'Step 7 · 10:15',
            source: 'GR-3307',
          },
        },
        approve: {
          label: 'Approve documents',
          values: {
            who: 'Accounting user (sample)',
            role: 'Approver',
            department: 'Accounting & Finance',
            action: 'Record approval',
            before: 'Awaiting approval',
            after: 'Approved',
            order: 'Step 10 · 13:30',
            source: 'INV-5521',
          },
        },
      },
      note: 'The history structure is designed, and the demo shows a simulated history for one work item. Storing history in production arrives with the next backend phases.',
      demoStatus: 'Simulated history in the demo',
    },
    control: {
      eyebrow: 'Controlling what matters',
      title: 'High-impact work\nshouldn’t pass with one click',
      lead: 'Actions that affect money, stock or risk can be set to require conditions before the work continues.',
      items: {
        requiredInfo: {
          title: 'Required information',
          body: 'Some steps cannot continue until the necessary information is there.',
        },
        approval: {
          title: 'Approval',
          body: 'Work with financial or risk impact can be set to pass an approver first.',
        },
        conditions: {
          title: 'Conditions',
          body: 'Approval paths change with conditions such as value or type of work.',
        },
        responsibility: {
          title: 'Role responsibility',
          body: 'Each step has a clear owner — work is handed to whoever is responsible, not to everyone.',
        },
      },
      example: 'In the demo: receiving cannot close until the lot and expiry are recorded.',
      approval: 'See workflow and approval',
      enterprise: 'See organizational control',
    },
    data: {
      eyebrow: 'Data principles',
      title: 'Principles, not technical promises',
      lead: 'How CORE is designed, and how it is set up with each organization.',
      principles: {
        collect: {
          title: 'Collect only what work needs',
          body: 'Data is designed from real work — nothing nobody uses.',
        },
        visibility: {
          title: 'Role-appropriate visibility',
          body: 'Each role sees what its own work requires.',
        },
        trace: {
          title: 'Trace important changes',
          body: 'A change that affects work should say who did what, and when.',
        },
        configuration: {
          title: 'Separate configuration duties',
          body: 'Whoever sets permissions doesn’t need to see business figures.',
        },
        backup: {
          title: 'Plan for backup and recovery',
          body: 'A backup policy and a recovery test are defined before live use.',
        },
        availability: {
          title: 'Watch operational availability',
          body: 'Monitoring is planned as part of every installation.',
        },
        hardening: {
          title: 'Harden before live use',
          body: 'A system holding real data is configured and reviewed further before it opens.',
        },
      },
      goLive: {
        title: 'What a live deployment needs first',
        lead: 'Defined together during implementation — not a service running today.',
        items: {
          backup: 'Backup policy',
          recovery: 'Recovery testing',
          monitoring: 'Monitoring',
          incident: 'Incident procedures',
        },
        pending: 'Defined during implementation',
        note: 'We will not publish recovery-time or availability figures until they are agreed and measured on a system in use.',
      },
    },
    readiness: {
      eyebrow: 'Status today',
      title: 'What exists, and what is planned',
      lead: 'Each layer uses the same status system as the Enterprise page.',
      layer: 'Layer',
      status: 'Status',
      now: 'What this means today',
      rows: {
        identity: {
          name: 'Identity',
          now: 'Today’s sign-in page is a prototype for reviewing screens only — real identity, SSO and MFA are planned.',
        },
        access: {
          name: 'Access',
          now: 'The prototype and demo show role-based visibility — server-side enforcement for real users comes in the next backend phases.',
        },
        workflow: {
          name: 'Workflow control',
          now: 'Required information, approval and conditions are set per implementation scope.',
        },
        trace: {
          name: 'Trace',
          now: 'The history structure is designed — the demo shows a simulated history.',
        },
        data: {
          name: 'Data classification',
          now: 'The backend foundation classifies data and builds each view from an allow-list — tested on sample data.',
        },
        backup: {
          name: 'Backup / recovery',
          now: 'Policy and testing are defined while preparing for live use.',
        },
        observability: {
          name: 'Observability',
          now: 'Planned with each production installation.',
        },
        integration: {
          name: 'Integration',
          now: 'The structure is designed to connect other systems — actual scope is set during implementation.',
        },
      },
      notClaim: {
        title: 'What PDA BLISS does not claim yet',
        items: [
          'CORE holds no third-party security certification yet.',
          'No availability or recovery-time figures are published.',
          'No live real identity, SSO or MFA.',
          'Role-based screens in the prototype are not production permission enforcement.',
        ],
        close: 'We will add to this only when there is verifiable evidence.',
      },
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Security questions',
      items: {
        warehousePrice: {
          q: 'Does the warehouse see prices?',
          a: 'No. The warehouse view is designed around items, quantities, locations, lots, expiry and receiving / picking work. In the demo, prices are not part of the warehouse view’s data at all. In production, this boundary is enforced on the server.',
        },
        sameData: {
          q: 'Does every user see the same information?',
          a: 'No. It is the same work, but each role sees a different view based on its responsibility. Actual scope is set in each organization’s implementation.',
        },
        execAdmin: {
          q: 'How is an executive different from an admin?',
          a: 'Executives see operations, exceptions, bottlenecks and risk. Admins manage users, permissions and settings, without needing business figures.',
        },
        audit: {
          q: 'Does CORE keep an audit trail?',
          a: 'The history structure is designed (who, role, department, action, before / after, order and source document), and the demo shows a simulated history. Storing it in production arrives with the next backend phases.',
        },
        sso: {
          q: 'Is there SSO?',
          a: 'Not yet. Real identity and SSO are planned. Today’s sign-in page is a prototype for reviewing screens only.',
        },
        mfa: {
          q: 'Is there MFA?',
          a: 'Not yet. It is planned together with real identity.',
        },
        backup: {
          q: 'How are backups handled?',
          a: 'A backup policy and recovery testing are defined together while preparing for live use. We publish no figures or terms until they are agreed and tested.',
        },
        certification: {
          q: 'Does CORE have a certification?',
          a: 'Not yet. CORE holds no third-party security certification. We will state one only when there is verifiable evidence.',
        },
        separation: {
          q: 'How is each department’s information kept separate?',
          a: 'Every department works on the same item but receives only what its role requires. Data is classified (operational / commercial / financial), and each view is designed to receive only the classes it is cleared for.',
        },
        integration: {
          q: 'What if we need an integration?',
          a: 'Start by discussing which systems, which data and who is responsible. Scope, method and the integration’s own permissions are set during implementation.',
        },
      },
    },
    consult: {
      title: 'Want to talk about access, boundaries\nand your implementation?',
      lead: 'Start with who should see what, then design the system around real responsibility.',
      primary: 'Talk about security / implementation',
      secondary: 'See Enterprise',
      demo: 'See the CORE demo',
    },
  },
  'zh-CN': {
    meta: {
      title: '安全与信任——不是每个人都该看到一切',
      description:
        'PDA BLISS CORE 的安全思路：按职责划分可见范围、仓库的数据边界、高管与系统管理员的区别、可追溯性，以及如实标注哪些已具备、哪些在规划中。',
    },
    hero: {
      eyebrow: '安全与信任',
      title: '不是每个人都该看到一切',
      lead: 'CORE 按职责、责任与工作情境设计数据的可见范围，让每个部门看到所需信息，而不过度开放。',
      concept: '安全不是从防火墙开始，\n而是从每个人只看到工作所需开始。',
      notOnly: '不仅是',
      notOnlyItems: ['加密', '服务器', '证书'],
      also: '还包括',
      pillars: ['责任', '访问权限', '可见范围', '边界', '可追溯', '控制'],
      primary: '洽谈安全 / 实施',
      secondary: '查看企业方案',
      demo: '体验 CORE 演示',
    },
    windows: {
      eyebrow: '同一项工作 · 不同视图',
      title: '信息只流向\n获准的窗口',
      lead: '一项工作包含许多信息。每个角色只收到职责所需的部分——其余部分在到达该窗口前停下。请选择角色。',
      group: '选择角色',
      object: '同一项工作',
      objectId: 'SO-1042 · 含补货的客户订单',
      count: '可见 {n} / {total}',
      reaches: '送达此视图',
      stops: '在此视图前停下',
      selected: '正在查看',
      note: '用于说明理念的示例——实际角色与字段按各组织的实施范围设定，并非最终的生产权限模型。',
      roles: {
        sales: { name: '销售', focus: '订单、客户与交付' },
        warehouse: { name: '仓库', focus: '物品、库位、批次、有效期、收货与拣货' },
        purchasing: { name: '采购', focus: '采购单、供应商与待收货' },
        accounting: { name: '财务会计', focus: '单据、付款与付款准备' },
        executive: { name: '高管', focus: '全局、异常与风险' },
        admin: { name: '系统管理员', focus: '用户、权限与设置' },
      },
      fields: {
        order: { label: '销售订单', value: 'SO-1042' },
        customer: { label: '客户', value: '示例有限公司' },
        item: { label: '物品', value: '清洁剂 5 升 · SKU-7731' },
        quantity: { label: '数量', value: '120 件' },
        location: { label: '库位', value: 'A-03-2' },
        lot: { label: '批次', value: 'LOT-B2410' },
        expiry: { label: '有效期', value: '2027-06-30' },
        receiving: { label: '收货', value: '已收 80 / 100' },
        picking: { label: '拣货', value: '按 FEFO 顺序' },
        price: { label: '销售价', value: '฿48,000' },
        cost: { label: '成本 / 采购价', value: '฿36,000' },
        margin: { label: '毛利', value: '฿12,000' },
        payment: { label: '付款', value: '待付 ฿36,000' },
        terms: { label: '供应商财务条款', value: '30 天账期' },
        exception: { label: '异常', value: '待收 20 件' },
        permissions: { label: '权限与设置', value: '6 个角色 · 24 位用户' },
      },
    },
    warehouse: {
      eyebrow: '最清楚的例子',
      title: '仓库看到工作所需的一切——\n除了与工作无关的数字',
      lead: '负责收货与拣货的人需要知道是什么、多少、在哪里、哪个批次、何时到期——但不需要知道价格、成本或毛利。',
      boundary: '仓库视图边界',
      source: '同一项工作',
      view: '仓库视图',
      passes: '进入仓库视图',
      stopped: '不会送达',
      seesTitle: '仓库可见',
      notTitle: '仓库不可见',
      not: ['销售价', '成本 / 采购价', '毛利', '付款金额', '财务条款'],
      fact: '这不是隐藏列。在演示中，价格根本不在仓库视图的数据里；基础后端也仅从业务操作类字段的允许清单（allow-list）构建仓库数据——已用示例数据测试。',
      demo: '在演示中查看仓库视图',
    },
    roles: {
      eyebrow: '常被混为一谈的两个角色',
      title: '高管 ≠ 系统管理员',
      lead: '高管需要全局视图来做决策；管理员需要设置让系统运转。职责不同，可见范围也不同。',
      neq: '并不相同',
      executive: {
        title: '高管',
        body: '覆盖整个组织的运营可见性',
        items: [
          '整个组织的运营概况',
          '需要决策的异常',
          '部门之间的瓶颈',
          '交付风险',
          '各部门的健康状况',
        ],
        without: '无需管理用户或权限',
      },
      admin: {
        title: '系统管理员',
        body: '用户与系统配置',
        items: ['用户与账号', '角色与权限', '系统设置', '部门与分支结构'],
        without: '无需查看销售额、成本或毛利',
      },
    },
    enforcement: {
      eyebrow: '坦白说明',
      title: '在屏幕上隐藏\n并不等于安全边界',
      lead: '不显示价格的界面让工作更简单；但真正的边界必须在服务器端，由它在数据离开系统之前决定把什么发给谁。',
      neq: 'UI visibility ≠ security boundary',
      ui: {
        title: '界面显示的内容',
        body: '按职责安排界面以减少混乱——但数据一旦已传到设备上，隐藏它并不是保护。',
      },
      server: {
        title: '服务器允许发送的内容',
        body: '每次响应前检查权限，只发送该角色获准接收的数据——其余数据根本不会发出。',
      },
      stages: {
        now: {
          label: '目前',
          body: '本网站、演示与原型展示的是预期的访问模型——属于示意，而非生产环境的权限执行。',
        },
        foundation: {
          label: '基础结构',
          body: '基础后端对数据分类（业务操作 / 商业 / 财务），并按允许清单构建各视图——仅用示例数据测试。',
        },
        later: {
          label: '后续后端阶段',
          body: '真实身份、真实用户权限以及服务器端对每个请求的检查——开发并测试完成后才会启用。',
        },
      },
    },
    trace: {
      eyebrow: '可追溯性',
      title: '每一次重要变更\n都应能说清发生了什么',
      lead: '预期模型：一次变更应记录是谁、什么角色、哪个部门、做了什么、前后有何不同、发生顺序以及引用的单据。',
      group: '选择事件',
      parts: {
        who: '谁',
        role: '角色',
        department: '部门',
        action: '操作',
        before: '之前',
        after: '之后',
        order: '时间 / 顺序',
        source: '来源',
      },
      events: {
        receive: {
          label: '收货 80 / 100',
          values: {
            who: '仓库用户（示例）',
            role: '收货人员',
            department: '仓库',
            action: '登记收货',
            before: '待收 0 / 100',
            after: '已收 80 / 100 · 待收 20',
            order: '第 4 步 · 09:42',
            source: 'PO-2215 · GR-3307',
          },
        },
        lot: {
          label: '登记批次与有效期',
          values: {
            who: '仓库用户（示例）',
            role: '收货人员',
            department: '仓库',
            action: '登记批次',
            before: '尚未登记批次',
            after: 'LOT-B2410 · 2027-06-30',
            order: '第 7 步 · 10:15',
            source: 'GR-3307',
          },
        },
        approve: {
          label: '审批单据',
          values: {
            who: '财务用户（示例）',
            role: '审批人',
            department: '财务会计',
            action: '登记审批',
            before: '待审批',
            after: '已审批',
            order: '第 10 步 · 13:30',
            source: 'INV-5521',
          },
        },
      },
      note: '工作历史的结构已经设计完成，演示中展示一项工作的模拟历史。生产环境中的历史存储将随后续后端阶段提供。',
      demoStatus: '演示中的模拟历史',
    },
    control: {
      eyebrow: '控制重要的工作',
      title: '影响重大的工作\n不应一键通过',
      lead: '涉及资金、库存或风险的操作，可设定为满足条件后才能继续。',
      items: {
        requiredInfo: { title: '必需信息', body: '部分步骤在必要信息齐全前无法继续。' },
        approval: { title: '审批', body: '涉及财务或风险的工作，可设定为先经审批人。' },
        conditions: { title: '条件', body: '审批路径可按金额或工作类型等条件变化。' },
        responsibility: {
          title: '按角色的责任',
          body: '每一步都有明确的负责人——工作交给负责的人，而不是所有人。',
        },
      },
      example: '演示中的例子：未登记批次与有效期前，无法关闭收货。',
      approval: '查看工作流与审批',
      enterprise: '查看组织级控制',
    },
    data: {
      eyebrow: '数据原则',
      title: '是原则，而非技术承诺',
      lead: 'CORE 的设计思路，也是与每个组织一起实施时遵循的方向。',
      principles: {
        collect: {
          title: '只收集工作所需',
          body: '从真实工作出发设计数据，不收集无人使用的信息。',
        },
        visibility: { title: '按角色可见', body: '每个角色看到自身工作所需的内容。' },
        trace: { title: '追踪重要变更', body: '影响工作的变更应能说明是谁、做了什么、何时发生。' },
        configuration: { title: '配置职责分离', body: '设置权限的人不必看到业务数字。' },
        backup: { title: '规划备份与恢复', body: '在正式使用前制定备份策略并进行恢复测试。' },
        availability: { title: '关注系统可用状态', body: '监控作为每次部署的一部分进行规划。' },
        hardening: { title: '上线前加固', body: '承载真实数据的系统在开放前需进一步配置与审查。' },
      },
      goLive: {
        title: '正式上线前需要具备什么',
        lead: '在实施阶段共同确定——并非目前已在运行的服务。',
        items: {
          backup: '备份策略',
          recovery: '恢复测试',
          monitoring: '系统监控',
          incident: '故障处理流程',
        },
        pending: '在实施中确定',
        note: '在双方确认并于实际使用的系统上测得之前，我们不会公布恢复时间或可用性数字。',
      },
    },
    readiness: {
      eyebrow: '当前状态',
      title: '哪些已具备，哪些在规划中',
      lead: '每一层都使用与企业方案页相同的状态体系。',
      layer: '层级',
      status: '状态',
      now: '目前意味着',
      rows: {
        identity: {
          name: '身份',
          now: '目前的登录页仅是用于查看界面的原型——真实身份、SSO 与 MFA 在规划中。',
        },
        access: {
          name: '访问权限',
          now: '原型与演示展示按角色的可见范围——针对真实用户的服务器端执行在后续后端阶段。',
        },
        workflow: { name: '工作流控制', now: '必需信息、审批与条件按实施范围设定。' },
        trace: { name: '追溯', now: '工作历史结构已设计——演示中展示模拟历史。' },
        data: {
          name: '数据分类',
          now: '基础后端对数据分类，并按允许清单构建各视图——已用示例数据测试。',
        },
        backup: { name: '备份 / 恢复', now: '在准备正式使用时制定策略并测试。' },
        observability: { name: '可观测性', now: '随每次生产部署一起规划。' },
        integration: {
          name: '集成',
          now: '结构设计为可连接其他系统——实际范围在实施中确定。',
        },
      },
      notClaim: {
        title: 'PDA BLISS 目前不作的声明',
        items: [
          '目前尚无第三方安全标准对 CORE 的认可。',
          '未公布任何可用性或恢复时间数字。',
          '尚未启用真实身份、SSO 或 MFA。',
          '原型中按角色的界面并非生产环境的权限执行。',
        ],
        close: '只有在具备可核实的证据时，我们才会补充说明。',
      },
    },
    faq: {
      eyebrow: '常见问题',
      title: '关于安全的问题',
      items: {
        warehousePrice: {
          q: '仓库能看到价格吗？',
          a: '不能。仓库视图围绕物品、数量、库位、批次、有效期以及收货 / 拣货工作设计。在演示中，价格根本不在仓库视图的数据里。在生产环境中，这一边界由服务器执行。',
        },
        sameData: {
          q: '所有用户看到的信息都一样吗？',
          a: '不一样。是同一项工作，但每个角色按职责看到不同的视图。实际范围按各组织的实施确定。',
        },
        execAdmin: {
          q: '高管与管理员有什么区别？',
          a: '高管查看运营、异常、瓶颈与风险；管理员负责用户、权限与设置，无需查看业务数字。',
        },
        audit: {
          q: 'CORE 会保留审计记录吗？',
          a: '工作历史结构已设计（谁、角色、部门、操作、前后变化、顺序与来源单据），演示中展示模拟历史。生产环境的存储将随后续后端阶段提供。',
        },
        sso: {
          q: '支持 SSO 吗？',
          a: '目前还没有。真实身份与 SSO 在规划中。目前的登录页仅是用于查看界面的原型。',
        },
        mfa: { q: '支持 MFA 吗？', a: '目前还没有，将与真实身份一起规划。' },
        backup: {
          q: '如何处理备份？',
          a: '备份策略与恢复测试在准备正式使用时共同制定。在双方确认并测试之前，我们不公布任何数字或条款。',
        },
        certification: {
          q: 'CORE 有认证吗？',
          a: '目前还没有。尚无第三方安全标准对 CORE 的认可。只有在具备可核实的证据时我们才会说明。',
        },
        separation: {
          q: '各部门的信息如何分开？',
          a: '所有部门在同一项工作上协作，但只接收职责所需的信息。数据经过分类（业务操作 / 商业 / 财务），每个视图被设计为只接收获准的类别。',
        },
        integration: {
          q: '如果需要系统集成，该怎么做？',
          a: '先沟通需要连接哪些系统、哪些数据、由谁负责——范围、连接方式及集成自身的权限在实施中共同确定。',
        },
      },
    },
    consult: {
      title: '想聊聊权限、边界\n以及您的系统实施？',
      lead: '先从谁该看到什么开始，再围绕真实的职责设计系统。',
      primary: '洽谈安全 / 实施',
      secondary: '查看企业方案',
      demo: '体验 CORE 演示',
    },
  },
};

import type { Localized } from '@/i18n/useCopy';
import type { IndustryPageCopy } from './types';

type Stage = 'received' | 'assigned' | 'vendor' | 'material' | 'done' | 'closed';

interface Signature {
  eyebrow: string;
  title: string;
  lead: string;
  choose: string;
  sites: Record<'a' | 'b' | 'c', string>;
  vendor: string;
  requests: Record<'r1' | 'r2' | 'r3', { title: string; age: string; stuck: string; next: string }>;
  stages: Record<Stage, string>;
  reached: string;
  stuckAt: string;
  nextStep: string;
  intake: { title: string; channels: readonly string[]; one: string };
}

const th: IndustryPageCopy<Signature> = {
  meta: {
    title: 'อสังหาริมทรัพย์ / งานปฏิบัติการ — งานแจ้งซ่อมทุกไซต์ไม่หลุดมือ',
    description:
      'CORE สำหรับงานปฏิบัติการอาคารและไซต์: รับแจ้งปัญหา มอบหมาย ติดตาม Vendor และการจัดซื้อวัสดุ ปิดงานพร้อมเอกสาร และให้ผู้บริหารเห็นงานค้างทุกไซต์ — ไม่ได้แทนระบบ Property & Rental Management',
  },
  hero: {
    eyebrow: 'Property / operational management',
    title: 'ทุกอาคาร ทุกไซต์\nงานแจ้งซ่อมต้องมีเจ้าของ\nจนกว่าจะปิด',
    lead: 'งานปฏิบัติการอาคารไม่ได้จบที่การซ่อม — ต้องมีคนรับเรื่อง มีคนตาม Vendor มีวัสดุ มีเอกสาร และผู้บริหารต้องเห็นว่าไซต์ไหนมีงานค้าง',
    visual: 'กลุ่มอาคารและไซต์ แต่ละแห่งมีงานแจ้งซ่อมเปิดอยู่ และ Vendor ภายนอกเชื่อมเข้ามา',
  },
  reality: {
    title: 'อะไรทำให้งานปฏิบัติการอาคารต่างจากธุรกิจอื่น',
    lead: 'งานเกิดกระจายตามพื้นที่ และหลายงานต้องพึ่งคนนอกองค์กร',
    points: [
      { title: 'งานกระจายหลายไซต์', body: 'แต่ละอาคารมีทีมของตัวเอง แต่ส่วนกลางต้องเห็นทั้งหมด' },
      { title: 'พึ่งพา Vendor', body: 'งานจำนวนมากต้องจ้างผู้รับเหมาหรือซื้อวัสดุก่อนจึงจะเสร็จ' },
      {
        title: 'เสร็จ ไม่เท่ากับปิด',
        body: 'งานซ่อมเสร็จแล้ว แต่เอกสารค่าใช้จ่ายและการยืนยันยังต้องตาม',
      },
    ],
  },
  frictions: {
    title: 'งานมักติดตรงนี้',
    items: [
      'แจ้งซ่อมเข้ามาหลายช่องทาง ทั้งโทร LINE และเดินมาบอก',
      'ไม่รู้ว่าใครรับผิดชอบเรื่องนี้อยู่',
      'งานค้างที่ Vendor แล้วไม่มีใครตาม',
      'ต้องซื้อวัสดุก่อน งานจึงหยุดรอโดยไม่มีใครรู้',
      'งานเสร็จแล้วแต่ยังไม่มีใครปิด',
      'เอกสารต้นทางและค่าใช้จ่ายไม่ครบ ผู้บริหารเห็นปัญหาช้า',
    ],
  },
  departments: {
    title: 'แผนกที่ดูแลงานของแต่ละไซต์',
    roles: {
      operations: 'ทีมอาคารรับเรื่อง มอบหมาย ดำเนินการ และยืนยันงานเสร็จ',
      purchasing: 'จัดซื้อวัสดุและจ้าง Vendor ตามที่อนุมัติ',
      accounting: 'รับเอกสารค่าใช้จ่ายที่ผูกกับงานแต่ละเรื่อง',
      executive: 'เห็นงานค้าง Vendor ที่เลท และไซต์ที่ต้องช่วย',
    },
  },
  workflow: {
    title: 'จากการแจ้งปัญหา ถึงการปิดงาน',
    notes: {
      request: 'ทุกช่องทางเข้าเป็นคำขอเดียวกัน พร้อมไซต์และรายละเอียด',
      assign: 'มีผู้รับผิดชอบชัดเจน',
      service: 'ทีมเข้าตรวจและแก้ไข',
      material: 'ถ้าต้องซื้อวัสดุหรือจ้าง Vendor งานจะแสดงว่ารออะไร',
      complete: 'ยืนยันว่างานเสร็จจริง',
      document: 'เอกสารค่าใช้จ่ายส่งต่อครบ',
      visibility: 'ผู้บริหารเห็นงานค้างของทุกไซต์',
    },
  },
  information: {
    title: 'ข้อมูลที่ทุกงานแจ้งซ่อมต้องมี',
    items: [
      { label: 'ไซต์และตำแหน่ง', why: 'รู้ว่าปัญหาอยู่ที่ไหน' },
      { label: 'ผู้รับผิดชอบ', why: 'ทุกเรื่องต้องมีคนตาม' },
      { label: 'อายุของงาน', why: 'เปิดมานานแค่ไหนแล้ว' },
      { label: 'สิ่งที่รออยู่', why: 'Vendor วัสดุ หรือการอนุมัติ' },
      { label: 'เอกสารต้นทาง', why: 'ใบเสนอราคา ใบสั่งจ้าง ใบส่งงาน' },
    ],
  },
  signals: {
    title: 'สิ่งที่ผู้ดูแลหลายไซต์ต้องเห็น',
    notes: {
      openIssues: 'งานแจ้งซ่อมที่ยังเปิดอยู่ในแต่ละไซต์',
      vendorDelay: 'งานที่ Vendor ยังไม่เข้าหรือยังไม่เสร็จตามนัด',
      overdueMaintenance: 'งานซ่อมบำรุงตามรอบที่เลยกำหนด',
      notClosed: 'งานที่เสร็จแล้วแต่ยังไม่ถูกปิด',
    },
  },
  fit: {
    title: 'CORE ช่วยตรงไหนในงานปฏิบัติการอาคาร',
    lead: 'หลักเดียวกับทุกธุรกิจ แต่ในงานหลายไซต์ หลักเหล่านี้หน้าตาแบบนี้',
  },
  notReplace: {
    title: 'สิ่งที่ CORE ไม่ได้แทน',
    items: [
      'ระบบควบคุมอาคารอัตโนมัติ (BMS) หรืออุปกรณ์ IoT',
      'ระบบประกาศขายหรือให้เช่าอสังหาริมทรัพย์',
    ],
  },
  custom: {
    title: 'อาจต้องกำหนดในการวางระบบ',
    items: [
      'โครงสร้างไซต์ อาคาร และพื้นที่',
      'รอบงานซ่อมบำรุงของแต่ละประเภทอุปกรณ์',
      'วงเงินที่ต้องขออนุมัติก่อนจ้าง Vendor',
    ],
  },
  signature: {
    eyebrow: 'Request journey',
    title: 'สามงานแจ้งซ่อม ติดคนละที่',
    lead: 'เลือกงานเพื่อดูว่ามาถึงไหน ติดอยู่ที่อะไร และขั้นต่อไปคืออะไร',
    choose: 'เลือกงานแจ้งซ่อม',
    sites: { a: 'อาคาร A', b: 'อาคาร B', c: 'ไซต์ C' },
    vendor: 'Vendor ภายนอก',
    requests: {
      r1: {
        title: 'แอร์ชั้น 3 ไม่เย็น',
        age: 'เปิดมา 6 วัน',
        stuck: 'รอ Vendor เข้าซ่อม — เลยวันนัดแล้ว',
        next: 'ติดตาม Vendor หรือเปลี่ยนผู้รับงาน',
      },
      r2: {
        title: 'ไฟทางเดินดับทั้งแถว',
        age: 'เปิดมา 3 วัน',
        stuck: 'รอจัดซื้อหลอดไฟและอุปกรณ์',
        next: 'อนุมัติการจัดซื้อวัสดุ',
      },
      r3: {
        title: 'ท่อน้ำรั่วห้องน้ำล็อบบี้',
        age: 'เปิดมา 9 วัน',
        stuck: 'ซ่อมเสร็จแล้ว แต่ยังไม่มีใครปิดงาน',
        next: 'ยืนยันงานและส่งเอกสารค่าใช้จ่าย',
      },
    },
    stages: {
      received: 'รับแจ้ง',
      assigned: 'มอบหมาย',
      vendor: 'Vendor',
      material: 'วัสดุ',
      done: 'เสร็จ',
      closed: 'ปิดงาน',
    },
    reached: 'ผ่านแล้ว',
    stuckAt: 'ติดอยู่ที่',
    nextStep: 'ขั้นต่อไป',
    intake: {
      title: 'แจ้งมาทางไหนก็เป็นคำขอเดียวกัน',
      channels: ['โทรศัพท์', 'LINE', 'แจ้งที่นิติฯ', 'ทีมตรวจพบเอง'],
      one: 'คำขอเดียว · มีไซต์ · มีเจ้าของ',
    },
  },
};

const en: IndustryPageCopy<Signature> = {
  meta: {
    title: 'Property / operational management — no maintenance request slips through',
    description:
      'CORE for building and site operations: take requests, assign, follow vendors and material purchases, close with documents, and show executives open work at every site. It does not replace Property & Rental Management.',
  },
  hero: {
    eyebrow: 'Property / operational management',
    title: 'Every building, every site —\na request has an owner\nuntil it’s closed',
    lead: 'Building operations don’t end with the repair. Someone takes the request, someone chases the vendor, materials arrive, documents follow, and executives see which site has open work.',
    visual:
      'A cluster of buildings and sites, each with open maintenance requests, and an outside vendor connected in',
  },
  reality: {
    title: 'What makes building operations different',
    lead: 'Work is spread across locations, and much of it depends on people outside the organization.',
    points: [
      {
        title: 'Work across many sites',
        body: 'Each building has its own team, but the centre must see them all.',
      },
      {
        title: 'Vendor dependency',
        body: 'Many jobs need a contractor or materials before they can finish.',
      },
      {
        title: 'Done isn’t closed',
        body: 'The repair is finished, but cost documents and confirmation still need chasing.',
      },
    ],
  },
  frictions: {
    title: 'Where work gets stuck',
    items: [
      'Requests arrive by phone, LINE and in person.',
      'Nobody knows who is responsible for an issue.',
      'Work stalls at a vendor and nobody follows up.',
      'Materials must be bought first, so the job waits unnoticed.',
      'The job is finished but nobody closes it.',
      'Source and cost documents are incomplete; executives see problems late.',
    ],
  },
  departments: {
    title: 'Departments looking after each site’s work',
    roles: {
      operations:
        'The building team takes requests, assigns, does the work and confirms completion.',
      purchasing: 'Buys materials and hires vendors as approved.',
      accounting: 'Receives cost documents tied to each job.',
      executive: 'Sees open work, late vendors and sites that need help.',
    },
  },
  workflow: {
    title: 'From a reported issue to a closed job',
    notes: {
      request: 'Every channel becomes the same request, with site and details.',
      assign: 'A clear owner.',
      service: 'The team inspects and fixes.',
      material: 'If materials or a vendor are needed, the job shows what it waits for.',
      complete: 'Confirm the work is really done.',
      document: 'Cost documents are passed on complete.',
      visibility: 'Executives see open work at every site.',
    },
  },
  information: {
    title: 'Information every request needs',
    items: [
      { label: 'Site and location', why: 'Where the problem is.' },
      { label: 'Owner', why: 'Every issue needs someone chasing it.' },
      { label: 'Age of the request', why: 'How long it has been open.' },
      { label: 'What it is waiting for', why: 'A vendor, materials or approval.' },
      { label: 'Source documents', why: 'Quotation, work order, completion note.' },
    ],
  },
  signals: {
    title: 'What a multi-site manager needs to see',
    notes: {
      openIssues: 'Open requests at each site.',
      vendorDelay: 'Jobs where the vendor hasn’t come or finished as agreed.',
      overdueMaintenance: 'Scheduled maintenance past due.',
      notClosed: 'Finished jobs not yet closed.',
    },
  },
  fit: {
    title: 'Where CORE fits in building operations',
    lead: 'The same principles as every business — this is how they look across sites.',
  },
  notReplace: {
    title: 'What CORE does not replace',
    items: [
      'Building management systems (BMS) or IoT devices',
      'Property listing or leasing portals',
    ],
  },
  custom: {
    title: 'May be defined during implementation',
    items: [
      'Site, building and area structure',
      'Maintenance cycles per equipment type',
      'Approval limits before hiring a vendor',
    ],
  },
  signature: {
    eyebrow: 'Request journey',
    title: 'Three requests, stuck in three places',
    lead: 'Choose a request to see how far it got, what it’s stuck on and what comes next.',
    choose: 'Choose a request',
    sites: { a: 'Building A', b: 'Building B', c: 'Site C' },
    vendor: 'External vendor',
    requests: {
      r1: {
        title: 'Third-floor air-con not cooling',
        age: 'Open 6 days',
        stuck: 'Waiting for the vendor — past the appointment',
        next: 'Chase the vendor or reassign',
      },
      r2: {
        title: 'Corridor lights out',
        age: 'Open 3 days',
        stuck: 'Waiting for bulbs and fittings to be bought',
        next: 'Approve the material purchase',
      },
      r3: {
        title: 'Lobby washroom pipe leak',
        age: 'Open 9 days',
        stuck: 'Repaired, but nobody has closed the job',
        next: 'Confirm the work and send cost documents',
      },
    },
    stages: {
      received: 'Received',
      assigned: 'Assigned',
      vendor: 'Vendor',
      material: 'Materials',
      done: 'Done',
      closed: 'Closed',
    },
    reached: 'Passed',
    stuckAt: 'Stuck at',
    nextStep: 'Next step',
    intake: {
      title: 'However it’s reported, it’s one request',
      channels: ['Phone', 'LINE', 'Front desk', 'Found by the team'],
      one: 'One request · a site · an owner',
    },
  },
};

const zh: IndustryPageCopy<Signature> = {
  meta: {
    title: '物业 / 运营管理——每个站点的报修都不遗漏',
    description:
      '面向楼宇与站点运营的 CORE：接收报修、分派、跟进供应商与材料采购、凭单据关闭工作，并让管理层看到所有站点的未结工作——不替代 Property & Rental Management。',
  },
  hero: {
    eyebrow: 'Property / operational management',
    title: '每栋楼、每个站点\n报修在关闭之前\n都要有负责人',
    lead: '楼宇运营不止于维修——要有人接单、有人跟进供应商、材料到位、单据齐全，管理层还要看到哪个站点有未结工作。',
    visual: '一组楼宇与站点，各自有未关闭的报修，外部供应商与之相连',
  },
  reality: {
    title: '楼宇运营有何不同',
    lead: '工作分散在各个地点，很多工作依赖组织外部的人员。',
    points: [
      { title: '工作分布在多个站点', body: '每栋楼有自己的团队，但总部需要看到全部。' },
      { title: '依赖供应商', body: '很多工作需要先委托承包商或采购材料才能完成。' },
      { title: '完工不等于关闭', body: '维修完成后，费用单据与确认仍需跟进。' },
    ],
  },
  frictions: {
    title: '工作常卡在这里',
    items: [
      '报修从电话、LINE 和当面告知等多个渠道进来。',
      '不知道谁在负责这个问题。',
      '工作卡在供应商那里，无人跟进。',
      '需要先采购材料，工作在无人知晓中停滞。',
      '工作已完成，却没人关闭。',
      '来源单据与费用单据不全，管理层发现问题太晚。',
    ],
  },
  departments: {
    title: '负责各站点工作的部门',
    roles: {
      operations: '楼宇团队接单、分派、处理并确认完工。',
      purchasing: '按审批采购材料并委托供应商。',
      accounting: '接收与每项工作挂钩的费用单据。',
      executive: '看到未结工作、延迟的供应商与需要支援的站点。',
    },
  },
  workflow: {
    title: '从报修到关闭',
    notes: {
      request: '各渠道都成为同一张报修单，包含站点与详情。',
      assign: '明确的负责人。',
      service: '团队检查并处理。',
      material: '需要材料或供应商时，工作会显示在等什么。',
      complete: '确认工作真正完成。',
      document: '费用单据完整移交。',
      visibility: '管理层看到所有站点的未结工作。',
    },
  },
  information: {
    title: '每张报修单都需要的信息',
    items: [
      { label: '站点与位置', why: '问题在哪里。' },
      { label: '负责人', why: '每个问题都要有人跟进。' },
      { label: '报修时长', why: '已经开了多久。' },
      { label: '在等什么', why: '供应商、材料或审批。' },
      { label: '来源单据', why: '报价单、委托单、完工记录。' },
    ],
  },
  signals: {
    title: '多站点管理者需要看到的',
    notes: {
      openIssues: '各站点仍未关闭的报修。',
      vendorDelay: '供应商未按约到场或未完成的工作。',
      overdueMaintenance: '逾期的定期维护。',
      notClosed: '已完工但尚未关闭的工作。',
    },
  },
  fit: {
    title: 'CORE 在楼宇运营中的作用',
    lead: '与所有业务相同的原则——在多站点运营中是这样的。',
  },
  notReplace: {
    title: 'CORE 不替代的',
    items: ['楼宇自控系统（BMS）或物联网设备', '房产挂牌或租赁平台'],
  },
  custom: {
    title: '可能需要在实施中确定',
    items: ['站点、楼宇与区域结构', '各类设备的维护周期', '委托供应商前的审批额度'],
  },
  signature: {
    eyebrow: 'Request journey',
    title: '三张报修单，卡在三个地方',
    lead: '选择一张报修单，看看它进展到哪里、卡在什么、下一步是什么。',
    choose: '选择报修单',
    sites: { a: 'A 栋', b: 'B 栋', c: 'C 站点' },
    vendor: '外部供应商',
    requests: {
      r1: {
        title: '三楼空调不制冷',
        age: '已开 6 天',
        stuck: '等待供应商上门——已过预约时间',
        next: '跟进供应商或改派',
      },
      r2: {
        title: '走廊整排灯不亮',
        age: '已开 3 天',
        stuck: '等待采购灯管与配件',
        next: '审批材料采购',
      },
      r3: {
        title: '大堂洗手间水管漏水',
        age: '已开 9 天',
        stuck: '已修好，但没人关闭工作',
        next: '确认工作并提交费用单据',
      },
    },
    stages: {
      received: '接收',
      assigned: '分派',
      vendor: '供应商',
      material: '材料',
      done: '完工',
      closed: '关闭',
    },
    reached: '已完成',
    stuckAt: '卡在',
    nextStep: '下一步',
    intake: {
      title: '无论从哪里报修，都是同一张单',
      channels: ['电话', 'LINE', '物业前台', '团队巡检发现'],
      one: '一张单 · 有站点 · 有负责人',
    },
  },
};

export const PROPERTY: Localized<IndustryPageCopy<Signature>> = { th, en, 'zh-CN': zh };

import type { Localized } from '@/i18n/useCopy';
import type { IndustryPageCopy } from './types';

interface Signature {
  intake: { title: string; lead: string; channels: readonly string[]; queue: string };
  board: { title: string; teams: readonly string[]; slots: readonly string[]; unassigned: string };
  gate: {
    eyebrow: string;
    title: string;
    lead: string;
    job: string;
    team: string;
    evidence: Record<'photos' | 'checklist' | 'signoff', string>;
    missing: string;
    blocked: string;
    ready: string;
    note: string;
  };
}

const th: IndustryPageCopy<Signature> = {
  meta: {
    title: 'ธุรกิจบริการ — ทุกงานต้องมีคนรับและปิดได้จริง',
    description:
      'CORE สำหรับธุรกิจบริการ: รวมงานจากหลายช่องทาง มอบหมายทีม ติดตามสถานะหน้างาน และปิดงานพร้อมหลักฐาน ให้ออฟฟิศ ทีมภาคสนาม และบัญชีเห็นงานชิ้นเดียวกัน',
  },
  hero: {
    eyebrow: 'Services',
    title: 'ทุกงานบริการ\nต้องมีคนรับ\nและปิดได้พร้อมหลักฐาน',
    lead: 'ธุรกิจบริการขับเคลื่อนด้วยคนและตารางงาน — งานเข้ามาหลายทาง ทีมกระจายอยู่หน้างาน และออฟฟิศต้องรู้สถานะโดยไม่ต้องโทรตาม',
    visual: 'ตารางงานของทีมบริการ: แต่ละทีมมีงานตามช่วงเวลา และมีงานหนึ่งที่ยังไม่มีใครรับ',
  },
  reality: {
    title: 'อะไรทำให้งานบริการต่างจากธุรกิจอื่น',
    lead: 'สินค้าคือเวลาและความสามารถของทีม — งานจึงเดินตามตารางนัดหมาย ไม่ใช่ตามสต็อก',
    points: [
      { title: 'งานเกิดนอกออฟฟิศ', body: 'ทีมอยู่หน้างาน การอัปเดตสถานะต้องง่ายพอที่จะทำจริง' },
      { title: 'ตารางเปลี่ยนตลอด', body: 'นัดเลื่อน ลูกค้าไม่อยู่ งานด่วนแทรก' },
      {
        title: 'หลักฐานคือการส่งมอบ',
        body: 'งานจะปิดได้เมื่อมีรูป รายการตรวจ และการยืนยันจากลูกค้า',
      },
    ],
  },
  frictions: {
    title: 'งานมักติดตรงนี้',
    items: [
      'งานเข้าทางโทรศัพท์ LINE และอีเมล แล้วกระจัดกระจาย',
      'ไม่รู้ว่าใครรับงานนี้ไปแล้ว หรือยังไม่มีใครรับ',
      'ทีมภาคสนามไม่อัปเดตสถานะ ออฟฟิศต้องโทรถาม',
      'งานเสร็จแล้ว แต่เอกสารและหลักฐานยังไม่ครบ',
      'ลูกค้าถามสถานะ แต่ไม่มีใครตอบได้ทันที',
      'หัวหน้าเห็นงานล่าช้าเมื่อลูกค้าตามแล้ว',
    ],
  },
  departments: {
    title: 'ใครแตะงานบริการหนึ่งชิ้นบ้าง',
    roles: {
      operations: 'วางแผน จัดทีม ลงงาน และบันทึกหลักฐาน — หัวใจของงานบริการ',
      sales: 'รับคำขอจากลูกค้า ตอบสถานะ และแจ้งปิดงาน',
      accounting: 'รับเอกสารปิดงานที่ครบเพื่อเรียกเก็บ',
      executive: 'เห็นงานเลยกำหนด งานที่ไม่มีคนรับ และภาระงานของทีม',
      warehouse: 'จ่ายอะไหล่หรือวัสดุเมื่องานต้องใช้',
      purchasing: 'จัดหาอะไหล่ที่ไม่มีในคลัง',
    },
  },
  workflow: {
    title: 'จากคำขอของลูกค้า ถึงการปิดงาน',
    notes: {
      request: 'งานจากทุกช่องทางเข้าคิวเดียว',
      plan: 'จัดวันเวลาและสิ่งที่ต้องเตรียม',
      assign: 'มีชื่อผู้รับผิดชอบชัดเจน',
      execute: 'ทีมอัปเดตสถานะจากหน้างาน',
      evidence: 'รูป รายการตรวจ และลายเซ็นลูกค้า',
      bill: 'เอกสารครบจึงส่งต่อให้บัญชี',
      close: 'ลูกค้ารู้ว่างานจบแล้ว',
    },
  },
  information: {
    title: 'ข้อมูลที่ต้องมีในทุกงาน',
    items: [
      { label: 'ผู้รับผิดชอบ', why: 'งานที่ไม่มีชื่อคน คืองานที่จะหล่น' },
      { label: 'นัดหมายและสถานที่', why: 'ทีมรู้ว่าต้องไปที่ไหน เมื่อไร' },
      { label: 'สถานะหน้างาน', why: 'เริ่มแล้ว รออะไหล่ หรือเสร็จ' },
      { label: 'หลักฐานการทำงาน', why: 'ใช้ปิดงานและยืนยันกับลูกค้า' },
      { label: 'สิ่งที่ลูกค้ารอ', why: 'ตอบได้ทันทีเมื่อลูกค้าถาม' },
    ],
  },
  signals: {
    title: 'สิ่งที่หัวหน้าทีมบริการต้องเห็น',
    notes: {
      overdue: 'งานที่เลยเวลานัดหรือเลยกำหนดเสร็จ',
      unassigned: 'งานที่เข้ามาแล้วแต่ยังไม่มีผู้รับผิดชอบ',
      missingEvidence: 'งานที่ทำเสร็จแต่ปิดไม่ได้เพราะหลักฐานไม่ครบ',
      customerWaiting: 'คำถามจากลูกค้าที่ยังไม่มีคำตอบ',
    },
  },
  fit: {
    title: 'CORE ช่วยตรงไหนในงานบริการ',
    lead: 'หลักเดียวกับทุกธุรกิจ แต่ในงานบริการ หลักเหล่านี้หน้าตาแบบนี้',
  },
  notReplace: {
    title: 'สิ่งที่ CORE ไม่ได้แทน',
    items: ['ระบบ Call Center หรือระบบโทรศัพท์', 'ระบบติดตามตำแหน่งรถหรือ GPS แบบเรียลไทม์'],
  },
  custom: {
    title: 'อาจต้องกำหนดในการวางระบบ',
    items: [
      'รูปแบบหลักฐานที่แต่ละประเภทงานต้องมี',
      'กติกาการจัดคิวและการมอบหมายทีม',
      'การรับงานจากช่องทางภายนอกเข้าสู่คิวเดียว',
    ],
  },
  signature: {
    intake: {
      title: 'งานเข้ามาหลายทาง แต่ต้องอยู่ในคิวเดียว',
      lead: 'ไม่ว่าลูกค้าจะติดต่อมาทางไหน งานต้องถูกบันทึก มีเจ้าของ และมีสถานะ',
      channels: ['โทรศัพท์', 'LINE', 'อีเมล', 'แจ้งที่หน้างาน'],
      queue: 'คิวงานเดียวของทีม',
    },
    board: {
      title: 'ตารางทีม',
      teams: ['ทีม A', 'ทีม B', 'ทีม C'],
      slots: ['เช้า', 'บ่าย', 'เย็น'],
      unassigned: 'ยังไม่มีคนรับ',
    },
    gate: {
      eyebrow: 'Evidence before close',
      title: 'งานเสร็จ ยังไม่เท่ากับปิดงานได้',
      lead: 'CORE ให้งานปิดได้เมื่อหลักฐานครบ — ลองติ๊กหลักฐานทีละข้อ',
      job: 'งานซ่อมระบบปรับอากาศ · ลูกค้า B สาขาบางนา',
      team: 'ทีม B · ช่างผู้รับผิดชอบ',
      evidence: {
        photos: 'รูปก่อนและหลังทำงาน',
        checklist: 'รายการตรวจหลังซ่อม',
        signoff: 'ลูกค้ายืนยันงาน',
      },
      missing: 'ยังขาด',
      blocked: 'ยังปิดงานไม่ได้ — หลักฐานไม่ครบ',
      ready: 'ปิดงานได้ — เอกสารส่งต่อให้บัญชีได้',
      note: 'รูปแบบหลักฐานกำหนดได้ตามประเภทงานขององค์กร',
    },
  },
};

const en: IndustryPageCopy<Signature> = {
  meta: {
    title: 'Services — every job owned, and closed for real',
    description:
      'CORE for service businesses: bring work from every channel into one queue, assign teams, follow field status and close jobs with evidence, so office, field teams and accounting see the same job.',
  },
  hero: {
    eyebrow: 'Services',
    title: 'Every service job\nneeds an owner —\nand evidence to close',
    lead: 'Service businesses run on people and schedules. Work arrives from everywhere, teams are out on site, and the office needs status without phoning around.',
    visual:
      'A service team schedule: each team has jobs across the day, and one job nobody has taken',
  },
  reality: {
    title: 'What makes services different',
    lead: 'What you sell is your team’s time and skill — so work follows the schedule, not stock.',
    points: [
      {
        title: 'Work happens outside the office',
        body: 'Teams are on site; updating status has to be easy enough to actually happen.',
      },
      {
        title: 'The schedule always moves',
        body: 'Appointments slip, customers are out, urgent jobs cut in.',
      },
      {
        title: 'Evidence is the delivery',
        body: 'A job closes with photos, a checklist and the customer’s sign-off.',
      },
    ],
  },
  frictions: {
    title: 'Where work gets stuck',
    items: [
      'Jobs arrive by phone, LINE and email, and scatter.',
      'Nobody knows whether someone has taken a job yet.',
      'Field teams don’t update status, so the office phones them.',
      'The work is done but documents and evidence are incomplete.',
      'A customer asks for status and nobody can answer right away.',
      'Supervisors see delays only once the customer chases.',
    ],
  },
  departments: {
    title: 'Who touches a single service job',
    roles: {
      operations: 'Plans, staffs, does the work and records evidence — the heart of service.',
      sales: 'Takes customer requests, answers status questions and confirms closure.',
      accounting: 'Receives complete close-out documents for billing.',
      executive: 'Sees overdue and unassigned jobs and team load.',
      warehouse: 'Issues parts or materials when a job needs them.',
      purchasing: 'Sources parts that aren’t in stock.',
    },
  },
  workflow: {
    title: 'From customer request to closure',
    notes: {
      request: 'Work from every channel enters one queue.',
      plan: 'Set the time and what to prepare.',
      assign: 'A named owner, clearly.',
      execute: 'The team updates status from site.',
      evidence: 'Photos, checklist and the customer’s signature.',
      bill: 'Complete documents go to accounting.',
      close: 'The customer knows the job is done.',
    },
  },
  information: {
    title: 'Information every job needs',
    items: [
      { label: 'Owner', why: 'A job without a name is a job that gets dropped.' },
      { label: 'Appointment and location', why: 'The team knows where and when.' },
      { label: 'Field status', why: 'Started, waiting for parts, or done.' },
      { label: 'Evidence of work', why: 'To close the job and confirm with the customer.' },
      { label: 'What the customer is waiting for', why: 'Answer at once when they ask.' },
    ],
  },
  signals: {
    title: 'What a service supervisor needs to see',
    notes: {
      overdue: 'Jobs past the appointment or due time.',
      unassigned: 'Jobs that came in with no owner yet.',
      missingEvidence: 'Finished jobs that can’t close without evidence.',
      customerWaiting: 'Customer questions still unanswered.',
    },
  },
  fit: {
    title: 'Where CORE fits in services',
    lead: 'The same principles as every business — this is how they look in services.',
  },
  notReplace: {
    title: 'What CORE does not replace',
    items: ['A call-centre or telephony system', 'Real-time vehicle or GPS tracking'],
  },
  custom: {
    title: 'May be defined during implementation',
    items: [
      'The evidence each job type requires',
      'Queue and team assignment rules',
      'Bringing external channels into one queue',
    ],
  },
  signature: {
    intake: {
      title: 'Work arrives many ways, but belongs in one queue',
      lead: 'However the customer gets in touch, the job is recorded, owned and given a status.',
      channels: ['Phone', 'LINE', 'Email', 'Reported on site'],
      queue: 'One team queue',
    },
    board: {
      title: 'Team schedule',
      teams: ['Team A', 'Team B', 'Team C'],
      slots: ['Morning', 'Afternoon', 'Evening'],
      unassigned: 'Not yet taken',
    },
    gate: {
      eyebrow: 'Evidence before close',
      title: 'Done is not the same as closed',
      lead: 'CORE lets a job close once the evidence is complete — tick each item to try it.',
      job: 'Air-conditioning repair · Customer B, Bang Na branch',
      team: 'Team B · technician in charge',
      evidence: {
        photos: 'Before and after photos',
        checklist: 'Post-repair checklist',
        signoff: 'Customer sign-off',
      },
      missing: 'Missing',
      blocked: 'Can’t close yet — evidence incomplete',
      ready: 'Ready to close — documents can go to accounting',
      note: 'Evidence requirements can be set per job type.',
    },
  },
};

const zh: IndustryPageCopy<Signature> = {
  meta: {
    title: '服务业——每项工作都有人负责，并真正结单',
    description:
      '面向服务业的 CORE：把各渠道的工作汇入同一队列、分派团队、跟进现场状态并凭证据结单，让办公室、外勤团队与财务看到同一项工作。',
  },
  hero: {
    eyebrow: 'Services',
    title: '每项服务工作\n都需要负责人\n并凭证据结单',
    lead: '服务业靠人员与排期运转——工作从各处进来，团队分散在现场，办公室需要不打电话就能知道状态。',
    visual: '服务团队排班：每个团队在各时段都有工作，其中一项还无人接手',
  },
  reality: {
    title: '服务业有何不同',
    lead: '您提供的是团队的时间与技能——因此工作跟着排期走，而不是跟着库存走。',
    points: [
      { title: '工作发生在办公室之外', body: '团队在现场，更新状态必须足够简单才会真正发生。' },
      { title: '排期随时变化', body: '改约、客户不在、紧急工作插队。' },
      { title: '证据就是交付', body: '有照片、检查清单与客户确认，工作才能结单。' },
    ],
  },
  frictions: {
    title: '工作常卡在这里',
    items: [
      '工作通过电话、LINE 和邮件进来，分散各处。',
      '不知道这项工作是否已经有人接手。',
      '外勤团队不更新状态，办公室只能打电话问。',
      '工作做完了，单据与证据却不齐全。',
      '客户询问进度，没人能立即回答。',
      '主管要等客户追问才发现延误。',
    ],
  },
  departments: {
    title: '谁会经手一项服务工作',
    roles: {
      operations: '计划、派人、执行并记录证据——服务工作的核心。',
      sales: '接收客户需求、答复进度并通知结单。',
      accounting: '接收完整的结单单据以便收费。',
      executive: '看到逾期、无人接手的工作与团队负荷。',
      warehouse: '在工作需要时发放备件或材料。',
      purchasing: '采购库存中没有的备件。',
    },
  },
  workflow: {
    title: '从客户需求到结单',
    notes: {
      request: '各渠道的工作进入同一队列。',
      plan: '确定时间与需要准备的东西。',
      assign: '明确指定负责人。',
      execute: '团队从现场更新状态。',
      evidence: '照片、检查清单与客户签名。',
      bill: '单据齐全后移交财务。',
      close: '客户知道工作已完成。',
    },
  },
  information: {
    title: '每项工作都需要的信息',
    items: [
      { label: '负责人', why: '没有名字的工作就是会被遗漏的工作。' },
      { label: '预约与地点', why: '团队知道去哪里、什么时候去。' },
      { label: '现场状态', why: '已开始、等备件或已完成。' },
      { label: '工作证据', why: '用于结单并与客户确认。' },
      { label: '客户在等什么', why: '客户问起时能立即回答。' },
    ],
  },
  signals: {
    title: '服务主管需要看到的',
    notes: {
      overdue: '超过预约或完成时间的工作。',
      unassigned: '已进来但还没有负责人的工作。',
      missingEvidence: '已完成却因证据不全无法结单的工作。',
      customerWaiting: '尚未答复的客户问题。',
    },
  },
  fit: {
    title: 'CORE 在服务业中的作用',
    lead: '与所有业务相同的原则——在服务业中是这样的。',
  },
  notReplace: {
    title: 'CORE 不替代的',
    items: ['呼叫中心或电话系统', '实时车辆或 GPS 定位系统'],
  },
  custom: {
    title: '可能需要在实施中确定',
    items: ['各类工作所需的证据形式', '排队与团队分派规则', '将外部渠道汇入同一队列'],
  },
  signature: {
    intake: {
      title: '工作从多个渠道进来，但应进入同一队列',
      lead: '无论客户通过什么方式联系，工作都要被记录、有负责人、有状态。',
      channels: ['电话', 'LINE', '邮件', '现场报告'],
      queue: '团队的统一队列',
    },
    board: {
      title: '团队排班',
      teams: ['A 组', 'B 组', 'C 组'],
      slots: ['上午', '下午', '傍晚'],
      unassigned: '尚无人接手',
    },
    gate: {
      eyebrow: 'Evidence before close',
      title: '完工不等于可以结单',
      lead: '证据齐全后 CORE 才允许结单——逐项勾选试试看。',
      job: '空调维修 · 客户 B 邦纳分店',
      team: 'B 组 · 负责技师',
      evidence: { photos: '施工前后照片', checklist: '维修后检查清单', signoff: '客户确认' },
      missing: '缺少',
      blocked: '暂不能结单——证据不全',
      ready: '可以结单——单据可移交财务',
      note: '证据要求可按组织的工作类型设定。',
    },
  },
};

export const SERVICES: Localized<IndustryPageCopy<Signature>> = { th, en, 'zh-CN': zh };

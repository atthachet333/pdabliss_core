import type { Localized } from '@/i18n/useCopy';
import type { ConnectionsCopy, IoCopy, ManagerCopy, TodayCopy } from '../common';

/*
 * Positioning: CORE Accounting supports payment and control workflows that
 * are connected to operations. It is NOT a full accounting system — copy must
 * never imply ledgers, financial statements or tax are in scope.
 */

const th = {
  meta: {
    title: 'บัญชีและการเงิน — การจ่ายที่เชื่อมกับงานปฏิบัติการ',
    description:
      'พื้นที่ทำงานบัญชีและการเงินใน PDA BLISS CORE จัดการคำขอจ่าย มัดจำ ส่วนที่เหลือ และความครบถ้วนของเอกสาร โดยเห็นว่างานต้นทางเดินมาถึงขั้นไหน — ไม่ใช่ระบบบัญชีครบวงจร',
  },
  hero: {
    eyebrow: 'Accounting & Finance',
    title: 'บัญชีเห็นว่าต้องจ่ายอะไร เพราะอะไร\nเอกสารครบหรือยัง และงานต้นทางถึงขั้นไหน',
    lead: 'ทุกคำขอจ่ายผูกกับเอกสารต้นทาง — PO ใบรับสินค้า และใบแจ้งหนี้ บัญชีจึงจ่ายเมื่อทุกอย่างพร้อม และย้อนกลับไปถึงต้นทางได้เสมอ',
    docs: ['PO', 'ใบรับสินค้า', 'ใบแจ้งหนี้', 'การอนุมัติ'],
    locked: 'ยังจ่ายไม่ได้',
    ready: 'พร้อมจ่าย',
    visual: 'เอกสารต้นทางถูกตรวจทีละฉบับ จนสถานะการจ่ายเปลี่ยนเป็นพร้อมจ่าย',
  },
  positioning: {
    eyebrow: 'Operational finance',
    title: 'การเงินและการจ่าย\nที่เชื่อมกับกระบวนการปฏิบัติงาน',
    lead: 'พื้นที่นี้ช่วยให้การจ่ายเงินสอดคล้องกับงานจริงของจัดซื้อ คลัง และปฏิบัติการ',
    does: 'CORE ช่วย',
    doesItems: [
      'คำขอจ่ายที่ผูกกับเอกสารต้นทาง',
      'มัดจำและส่วนที่เหลือตามเงื่อนไข PO',
      'ตรวจความครบถ้วนของเอกสารก่อนจ่าย',
      'ติดตามยอดค้างจ่ายและหลักฐานการจ่าย',
    ],
    not: 'ไม่ใช่',
    notItems: ['ระบบบัญชีครบวงจร', 'สมุดบัญชีและงบการเงิน', 'การยื่นภาษี'],
    notNote: 'งานบัญชีเต็มรูปแบบอยู่นอกขอบเขตของพื้นที่นี้',
  },
  request: {
    eyebrow: 'Payment request',
    title: 'คำขอจ่ายที่บอกเหตุผลของตัวเอง',
    lead: 'ไม่ต้องตามหาว่าจ่ายเพื่ออะไร — คำขอจ่ายบอกที่มา ประเภท เอกสารที่แนบ และสถานะการอนุมัติ',
    sample: 'คำขอจ่ายตัวอย่าง',
    fields: [
      { label: 'ที่มา', value: 'PO ตัวอย่าง · จัดซื้อ' },
      { label: 'Supplier', value: 'Supplier A' },
      { label: 'ประเภท', value: 'ส่วนที่เหลือหลังรับสินค้า' },
      { label: 'ยอด', value: 'ตามเงื่อนไข PO' },
      { label: 'สถานะ', value: 'รอตรวจเอกสาร' },
    ],
  },
  deposit: {
    eyebrow: 'Deposit',
    title: 'มัดจำ ก่อนของเข้ามา',
    lead: 'เมื่อเงื่อนไข PO กำหนดมัดจำ จัดซื้อส่งคำขอจ่ายมาให้บัญชีพร้อม PO — บัญชีจ่ายและบันทึกหลักฐาน แล้ว PO เดินต่อ',
    rail: [
      { name: 'PO ออกแล้ว', state: 'เงื่อนไข: มัดจำก่อนส่ง', done: true },
      { name: 'จ่ายมัดจำ', state: 'แนบหลักฐานการจ่าย', done: true },
      { name: 'รับสินค้า', state: 'คลังบันทึกใบรับสินค้า', done: true },
      { name: 'ส่วนที่เหลือ', state: 'รอเอกสารครบ', done: false },
    ],
  },
  goods: {
    eyebrow: 'Goods & document dependency',
    title: 'ส่วนที่เหลือจ่ายเมื่อของมาครบ\nและเอกสารมาครบ',
    lead: 'บัญชีเห็นการรับสินค้าที่คลังบันทึกโดยตรง ถ้ารับบางส่วน ยอดที่จ่ายได้ก็สอดคล้องกับของที่รับจริง',
    remaining: 'ส่วนที่เหลือ',
    states: [
      { label: 'รับสินค้าครบ', note: 'จ่ายส่วนที่เหลือได้เมื่อเอกสารครบ', ok: true },
      { label: 'รับบางส่วน', note: 'รอส่วนที่ขาด หรือจ่ายตามที่รับจริงตามนโยบาย', ok: false },
    ],
  },
  gate: {
    eyebrow: 'Document completeness',
    title: 'จ่ายเมื่อเอกสารครบ — ไม่ใช่เมื่อจำได้',
    lead: 'ลองเปิด–ปิดเอกสารแต่ละฉบับ แล้วดูว่าสถานะการจ่ายเปลี่ยนอย่างไร',
    docs: [
      { name: 'PO', from: 'จัดซื้อ' },
      { name: 'ใบรับสินค้า', from: 'คลังสินค้า' },
      { name: 'ใบแจ้งหนี้', from: 'Supplier' },
      { name: 'การอนุมัติ', from: 'ผู้มีอำนาจ' },
    ],
    present: 'มีแล้ว',
    missing: 'ยังไม่มี',
    locked: 'ยังจ่ายไม่ได้ — ขาด',
    ready: 'พร้อมจ่าย — เอกสารครบ',
  },
  outstanding: {
    eyebrow: 'Outstanding',
    title: 'ยอดค้างจ่าย ที่รู้ว่าค้างเพราะอะไร',
    lead: 'แต่ละรายการบอกสถานะและสิ่งที่ยังขาด จึงตามได้ถูกคน',
    rows: [
      { name: 'คำขอจ่าย · Supplier A', state: 'รอใบแจ้งหนี้', tone: 'attention' },
      { name: 'คำขอจ่าย · Supplier B', state: 'รออนุมัติ', tone: 'calm' },
      { name: 'คำขอจ่าย · Supplier C', state: 'ใกล้ครบกำหนด', tone: 'blocked' },
    ],
  },
  today: {
    title: 'วันนี้บัญชีเห็นอะไร',
    lead: 'สิ่งที่ต้องจ่าย สิ่งที่ยังขาด และสิ่งที่ใกล้กำหนด',
    groups: [
      {
        label: 'รอจ่าย',
        count: 3,
        tone: 'calm',
        items: ['เอกสารครบ รอรอบจ่าย', 'มัดจำตามเงื่อนไข PO'],
      },
      {
        label: 'เอกสารไม่ครบ',
        count: 2,
        tone: 'attention',
        items: ['ขาดใบแจ้งหนี้', 'ขาดใบรับสินค้า'],
      },
      { label: 'ใกล้กำหนด', count: 1, tone: 'blocked', items: ['ครบกำหนดภายใน 3 วัน'] },
    ],
  } satisfies TodayCopy,
  manager: {
    title: 'หัวหน้าการเงินเห็นภาพการจ่ายทั้งหมด',
    lead: 'เจ้าหน้าที่ตรวจเอกสารและจ่ายตามคิว หัวหน้าเห็นรายการรออนุมัติ ยอดค้าง และสิ่งที่ผิดปกติ',
    employee: ['คำขอจ่ายที่ต้องตรวจ', 'เอกสารที่ต้องตามเพิ่ม', 'การจ่ายที่ต้องบันทึกหลักฐาน'],
    manager: ['รายการรออนุมัติตามวงเงิน', 'ยอดค้างจ่ายใกล้กำหนด', 'คำขอที่เอกสารไม่ครบนานผิดปกติ'],
  } satisfies ManagerCopy,
  io: {
    title: 'บัญชีรับคำขอพร้อมหลักฐาน\nแล้วจ่ายอย่างตรวจสอบได้',
    in: ['คำขอจ่ายจากจัดซื้อ', 'ใบรับสินค้าจากคลัง', 'ใบแจ้งหนี้จาก Supplier'],
    do: ['ตรวจความครบถ้วนของเอกสาร', 'ส่งขออนุมัติตามวงเงิน', 'จ่ายและบันทึกหลักฐาน'],
    out: ['สถานะการจ่ายกลับไปที่ PO', 'ยอดค้างที่อัปเดต', 'หลักฐานการจ่ายที่ย้อนดูได้'],
  } satisfies IoCopy,
  preview: {
    title: 'หน้าจอบัญชีและการเงินจริงใน CORE',
    lead: 'คำขอจ่ายและสถานะเอกสาร — แสดงเอกสารและสถานะ ไม่แสดงยอดเงินจริง',
  },
  connections: {
    chain: [
      { at: 'purchasing', what: 'ส่งคำขอจ่ายพร้อม PO' },
      { at: 'warehouse', what: 'บันทึกใบรับสินค้า' },
      { at: 'accounting', what: 'ตรวจเอกสาร จ่าย และบันทึกหลักฐาน' },
      { at: 'executive', what: 'อนุมัติรายการเกินวงเงิน' },
    ],
  } satisfies ConnectionsCopy,
};

export const ACCOUNTING: Localized<typeof th> = {
  th,
  en: {
    meta: {
      title: 'Accounting & Finance — payments connected to operations',
      description:
        'The Accounting & Finance workspace in PDA BLISS CORE handles payment requests, deposits, balances and document completeness, with sight of how far the source work has progressed — not a full accounting system.',
    },
    hero: {
      eyebrow: 'Accounting & Finance',
      title:
        'Finance sees what to pay, why,\nwhether documents are complete — and where the work stands',
      lead: 'Every payment request is tied to its source documents — the PO, the goods receipt and the invoice. Finance pays when everything is ready, and can always trace back to the source.',
      docs: ['PO', 'Goods receipt', 'Invoice', 'Approval'],
      locked: 'Not payable yet',
      ready: 'Ready to pay',
      visual:
        'Source documents are checked one by one until the payment state becomes ready to pay',
    },
    positioning: {
      eyebrow: 'Operational finance',
      title: 'Finance and payments\nconnected to operational processes',
      lead: 'This workspace keeps payments in step with the real work of Purchasing, the Warehouse and Operations.',
      does: 'CORE helps with',
      doesItems: [
        'Payment requests tied to source documents',
        'Deposits and balances per PO terms',
        'Document completeness checks before payment',
        'Outstanding payables and payment evidence',
      ],
      not: 'It is not',
      notItems: [
        'A full accounting system',
        'General ledger and financial statements',
        'Tax filing',
      ],
      notNote: 'Full accounting is outside the scope of this workspace.',
    },
    request: {
      eyebrow: 'Payment request',
      title: 'A payment request that explains itself',
      lead: 'No hunting for what a payment is for — the request shows its origin, type, attached documents and approval status.',
      sample: 'Sample payment request',
      fields: [
        { label: 'Origin', value: 'Sample PO · Purchasing' },
        { label: 'Supplier', value: 'Supplier A' },
        { label: 'Type', value: 'Balance after receipt' },
        { label: 'Amount', value: 'Per PO terms' },
        { label: 'Status', value: 'Documents in review' },
      ],
    },
    deposit: {
      eyebrow: 'Deposit',
      title: 'Deposits, before the goods arrive',
      lead: 'When PO terms require a deposit, Purchasing sends a payment request with the PO — Finance pays and records evidence, and the PO moves on.',
      rail: [
        { name: 'PO issued', state: 'Terms: deposit before shipping', done: true },
        { name: 'Deposit paid', state: 'Payment evidence attached', done: true },
        { name: 'Goods received', state: 'Warehouse records the receipt', done: true },
        { name: 'Balance', state: 'Waiting for complete documents', done: false },
      ],
    },
    goods: {
      eyebrow: 'Goods & document dependency',
      title: 'The balance is paid when the goods\nand the documents are complete',
      lead: 'Finance sees the receipts the warehouse records directly. If goods arrive in part, what can be paid follows what was actually received.',
      remaining: 'Remaining balance',
      states: [
        {
          label: 'Received in full',
          note: 'The balance can be paid once documents are complete',
          ok: true,
        },
        {
          label: 'Partly received',
          note: 'Wait for the rest, or pay for what was received per policy',
          ok: false,
        },
      ],
    },
    gate: {
      eyebrow: 'Document completeness',
      title: 'Pay when documents are complete — not when someone remembers',
      lead: 'Toggle each document and watch how the payment state changes.',
      docs: [
        { name: 'PO', from: 'Purchasing' },
        { name: 'Goods receipt', from: 'Warehouse' },
        { name: 'Invoice', from: 'Supplier' },
        { name: 'Approval', from: 'Approver' },
      ],
      present: 'Present',
      missing: 'Missing',
      locked: 'Not payable yet — missing',
      ready: 'Ready to pay — documents complete',
    },
    outstanding: {
      eyebrow: 'Outstanding',
      title: 'Outstanding payables — and why they are outstanding',
      lead: 'Each item shows its status and what is still missing, so the right person is chased.',
      rows: [
        { name: 'Payment request · Supplier A', state: 'Waiting for invoice', tone: 'attention' },
        { name: 'Payment request · Supplier B', state: 'Awaiting approval', tone: 'calm' },
        { name: 'Payment request · Supplier C', state: 'Due soon', tone: 'blocked' },
      ],
    },
    today: {
      title: 'What Finance sees today',
      lead: 'What to pay, what is missing, and what is due soon.',
      groups: [
        {
          label: 'To pay',
          count: 3,
          tone: 'calm',
          items: ['Documents complete, awaiting run', 'Deposits per PO terms'],
        },
        {
          label: 'Incomplete documents',
          count: 2,
          tone: 'attention',
          items: ['Invoice missing', 'Goods receipt missing'],
        },
        { label: 'Due soon', count: 1, tone: 'blocked', items: ['Due within 3 days'] },
      ],
    },
    manager: {
      title: 'The finance lead sees every payment',
      lead: 'Staff check documents and pay in turn; the lead sees approvals waiting, outstanding balances and anything unusual.',
      employee: [
        'Payment requests to check',
        'Documents to chase',
        'Payments to record evidence for',
      ],
      manager: [
        'Approvals waiting by limit',
        'Outstanding balances due soon',
        'Requests incomplete for too long',
      ],
    },
    io: {
      title: 'Finance takes requests with their evidence\nand pays in a way that can be verified',
      in: [
        'Payment requests from Purchasing',
        'Goods receipts from the warehouse',
        'Invoices from suppliers',
      ],
      do: ['Check document completeness', 'Route approvals by limit', 'Pay and record evidence'],
      out: [
        'Payment status back to the PO',
        'Updated outstanding balances',
        'Traceable payment evidence',
      ],
    },
    preview: {
      title: 'The real Accounting & Finance screen in CORE',
      lead: 'Payment requests and document status — documents and states only, no real amounts.',
    },
    connections: {
      chain: [
        { at: 'purchasing', what: 'Sends payment requests with the PO' },
        { at: 'warehouse', what: 'Records the goods receipt' },
        { at: 'accounting', what: 'Checks documents, pays and records evidence' },
        { at: 'executive', what: 'Approves items above limit' },
      ],
    },
  },
  'zh-CN': {
    meta: {
      title: '财务会计——与运营相连的付款',
      description:
        'PDA BLISS CORE 财务会计工作空间处理付款申请、定金、尾款与单据完整性，并能看到源头工作进行到哪一步——并非完整的会计系统。',
    },
    hero: {
      eyebrow: 'Accounting & Finance',
      title: '付什么，为什么付\n单据是否齐全\n源头工作到了哪一步',
      lead: '每一项付款申请都关联源单据——采购单、收货单与发票。财务在一切就绪时付款，并始终可以追溯到源头。',
      docs: ['采购单', '收货单', '发票', '审批'],
      locked: '暂不可付款',
      ready: '可付款',
      visual: '逐份核对源单据，直到付款状态变为可付款',
    },
    positioning: {
      eyebrow: 'Operational finance',
      title: '与运营流程相连的\n财务与付款',
      lead: '这个工作空间让付款与采购、仓库和运营的真实工作保持一致。',
      does: 'CORE 帮助处理',
      doesItems: [
        '关联源单据的付款申请',
        '按采购单条款处理定金与尾款',
        '付款前检查单据完整性',
        '跟踪应付余额与付款凭证',
      ],
      not: '它不是',
      notItems: ['完整的会计系统', '总账与财务报表', '税务申报'],
      notNote: '完整的会计工作不在本工作空间范围内。',
    },
    request: {
      eyebrow: 'Payment request',
      title: '自带说明的付款申请',
      lead: '无需追查付款用途——申请会显示来源、类型、附件单据与审批状态。',
      sample: '示例付款申请',
      fields: [
        { label: '来源', value: '示例采购单 · 采购部' },
        { label: '供应商', value: '供应商 A' },
        { label: '类型', value: '收货后尾款' },
        { label: '金额', value: '按采购单条款' },
        { label: '状态', value: '单据审核中' },
      ],
    },
    deposit: {
      eyebrow: 'Deposit',
      title: '货到之前的定金',
      lead: '采购单条款要求定金时，采购部会连同采购单提交付款申请——财务付款并记录凭证，采购单继续推进。',
      rail: [
        { name: '采购单已下达', state: '条款：发货前付定金', done: true },
        { name: '已付定金', state: '已附付款凭证', done: true },
        { name: '已收货', state: '仓库记录收货单', done: true },
        { name: '尾款', state: '等待单据齐全', done: false },
      ],
    },
    goods: {
      eyebrow: 'Goods & document dependency',
      title: '货物与单据都齐全后\n再支付尾款',
      lead: '财务直接看到仓库记录的收货。若部分到货，可支付的金额会与实际收货保持一致。',
      remaining: '尾款',
      states: [
        { label: '已全部到货', note: '单据齐全后即可支付尾款', ok: true },
        { label: '部分到货', note: '等待其余部分，或按政策按实收支付', ok: false },
      ],
    },
    gate: {
      eyebrow: 'Document completeness',
      title: '单据齐全才付款——而不是靠记忆',
      lead: '逐一切换每份单据，看看付款状态如何变化。',
      docs: [
        { name: '采购单', from: '采购部' },
        { name: '收货单', from: '仓库' },
        { name: '发票', from: '供应商' },
        { name: '审批', from: '审批人' },
      ],
      present: '已有',
      missing: '缺少',
      locked: '暂不可付款——缺少',
      ready: '可付款——单据齐全',
    },
    outstanding: {
      eyebrow: 'Outstanding',
      title: '应付余额，并知道为何未付',
      lead: '每一项都显示状态与仍缺少的内容，便于找到对的人跟进。',
      rows: [
        { name: '付款申请 · 供应商 A', state: '等待发票', tone: 'attention' },
        { name: '付款申请 · 供应商 B', state: '待审批', tone: 'calm' },
        { name: '付款申请 · 供应商 C', state: '即将到期', tone: 'blocked' },
      ],
    },
    today: {
      title: '财务今天看到什么',
      lead: '要付的款、缺少的内容以及即将到期的事项。',
      groups: [
        {
          label: '待付款',
          count: 3,
          tone: 'calm',
          items: ['单据齐全，等待付款批次', '按采购单条款的定金'],
        },
        { label: '单据不全', count: 2, tone: 'attention', items: ['缺少发票', '缺少收货单'] },
        { label: '即将到期', count: 1, tone: 'blocked', items: ['3 天内到期'] },
      ],
    },
    manager: {
      title: '财务主管看到全部付款情况',
      lead: '专员核对单据并按顺序付款，主管看到待审批事项、应付余额与异常情况。',
      employee: ['需要核对的付款申请', '需要追补的单据', '需要记录凭证的付款'],
      manager: ['按额度待审批的事项', '即将到期的应付余额', '单据长期不全的申请'],
    },
    io: {
      title: '财务接收附有凭据的申请\n并以可核查的方式付款',
      in: ['采购部的付款申请', '仓库的收货单', '供应商的发票'],
      do: ['检查单据完整性', '按额度提交审批', '付款并记录凭证'],
      out: ['回传到采购单的付款状态', '更新后的应付余额', '可追溯的付款凭证'],
    },
    preview: {
      title: 'CORE 中真实的财务会计界面',
      lead: '付款申请与单据状态——只显示单据与状态，不显示真实金额。',
    },
    connections: {
      chain: [
        { at: 'purchasing', what: '连同采购单提交付款申请' },
        { at: 'warehouse', what: '记录收货单' },
        { at: 'accounting', what: '核对单据、付款并记录凭证' },
        { at: 'executive', what: '审批超额事项' },
      ],
    },
  },
};

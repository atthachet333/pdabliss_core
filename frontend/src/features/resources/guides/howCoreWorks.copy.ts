import type { Localized } from '@/i18n/useCopy';

type Stage = { title: string; p: string; p2?: string; example?: string };

const th = {
  intro:
    'คู่มือนี้คือฉบับอ่านของหน้า How CORE Works — เดินตามคำสั่งซื้อ SO-1042 ทีละขั้น และอธิบายว่าแต่ละขั้นมีไว้ทำไม ถ้าอยากเห็นแบบโต้ตอบ ให้เปิดหน้า How CORE Works หรือลองใน Demo',
  map: {
    caption: 'แปดขั้นของงานหนึ่งชิ้น — ข้อยกเว้นเป็นขั้นที่ไม่ควรเกิด แต่ต้องถูกเห็นเมื่อเกิด',
    steps: [
      { label: 'งานหนึ่งชิ้น', note: 'SO-1042' },
      { label: 'เจ้าของงาน', note: 'ใครรับผิดชอบ' },
      { label: 'สถานะ', note: 'อยู่ตรงไหน' },
      { label: 'ส่งต่อ', note: 'พร้อมข้อมูล' },
      { label: 'อนุมัติ', note: 'ตามเงื่อนไข' },
      { label: 'ข้อยกเว้น', note: 'ถูกยกขึ้นมา' },
      { label: 'ย้อนรอย', note: 'ใคร ทำอะไร' },
      { label: 'ปิดงาน', note: 'ครบทุกแผนก' },
    ],
  },
  stages: {
    item: {
      title: 'งานหนึ่งชิ้น',
      p: 'จุดเริ่มคือการมองงานเป็น “ชิ้น” ที่เดินผ่านหลายแผนก ไม่ใช่เอกสารแยกกันของแต่ละแผนก คำสั่งซื้อหนึ่งใบมีทั้งงานขาย การตรวจของ การสั่งซื้อ การรับของ และเอกสารบัญชีอยู่ในเส้นทางเดียวกัน',
      p2: 'เมื่อทุกแผนกมองงานชิ้นเดียวกัน คำถามเปลี่ยนจาก “เอกสารนี้อยู่ไหน” เป็น “งานนี้ถึงขั้นไหนแล้ว”',
      example:
        'บริษัท ตัวอย่าง จำกัด สั่งน้ำยาทำความสะอาด 5 ลิตร 120 ชิ้น (SO-1042) ในคลังมี 20 ชิ้น งานชิ้นนี้จะผ่านฝ่ายขาย จัดซื้อ คลังสินค้า และบัญชี ก่อนส่งมอบได้',
    },
    owner: {
      title: 'เจ้าของงาน',
      p: 'ในแต่ละขั้น งานมีเจ้าของที่ชัดเจนหนึ่งเดียว งานที่ “ทุกคนรับผิดชอบ” มักกลายเป็นงานที่ไม่มีใครรับผิดชอบ และเป็นสาเหตุอันดับแรกของงานตกหล่น',
      p2: 'เจ้าของไม่ได้แปลว่าทำคนเดียว แต่แปลว่ารู้ว่าขั้นต่อไปเป็นหน้าที่ของตัวเอง และคนอื่นรู้ว่าต้องถามใคร',
    },
    state: {
      title: 'สถานะ',
      p: 'สถานะคือตำแหน่งปัจจุบันของงานที่ทุกแผนกเห็นเหมือนกัน สถานะที่ดีบอกว่างาน “รออะไร” ไม่ใช่แค่ว่า “กำลังทำ”',
      p2: 'เปรียบเทียบ “กำลังดำเนินการ” กับ “รอรับของ 20 ชิ้นจาก Supplier ตาม PO-2215” — แบบหลังทำให้ไม่ต้องมีใครโทรถาม',
    },
    handoff: {
      title: 'การส่งต่องาน',
      p: 'เมื่อเจ้าของเปลี่ยน การส่งต่อที่ดีไม่ใช่ข้อความว่า “ส่งแล้วนะ” แต่เป็นการที่ข้อมูลซึ่งขั้นต่อไปต้องใช้เดินทางไปพร้อมกับงาน',
      parts: [
        'ผู้ส่งต่อ และผู้รับงาน',
        'สถานะก่อนและหลังการส่งต่อ',
        'ข้อมูลที่ต้องมี',
        'สิ่งที่ผู้รับต้องทำต่อ',
      ],
      example:
        'ฝ่ายขายเห็นว่าของขาด 100 ชิ้น จึงส่งต่อให้จัดซื้อ — จัดซื้อได้รับรายการสินค้า จำนวนที่ขาด และวันที่ลูกค้าต้องการ โดยไม่ต้องถามกลับ',
    },
    approval: {
      title: 'การอนุมัติ',
      p: 'การอนุมัติเป็นส่วนหนึ่งของงาน ไม่ใช่ปุ่มที่แยกออกมา งานที่ต้องอนุมัติจะหยุดรอที่ขั้นนั้น และทุกคนเห็นว่ารอใคร รอมานานแค่ไหน',
      p2: 'เงื่อนไขกำหนดได้ตามองค์กร เช่น ต้องอนุมัติเมื่อมีการจ่ายมัดจำ หรือเมื่อมูลค่าเกินระดับที่กำหนด — ขั้นตอนจริงกำหนดตามขอบเขตการวางระบบ',
      example:
        'Supplier ต้องการมัดจำก่อนส่งของตาม PO-2215 คำขอจ่ายไปรอที่บัญชี ซึ่งตรวจ PO และเอกสารประกอบ เมื่ออนุมัติแล้ว Supplier จึงยืนยันคำสั่งซื้อ',
    },
    exception: {
      title: 'ข้อยกเว้น',
      p: 'งานปกติควรไหล — สิ่งผิดปกติควรถูกเห็น ข้อยกเว้นคือสิ่งที่ไม่เป็นไปตามปกติ ซึ่งถูกยกขึ้นมาพร้อมผู้รับผิดชอบ แทนที่จะรอให้มีคนสังเกตเอง',
      p2: 'ข้อยกเว้นที่ดีมีสามส่วน: เกิดอะไรขึ้น ใครรับผิดชอบ และกระทบงานใด เมื่อแก้แล้ว ข้อยกเว้นจะถูกปิดและยังอยู่ในประวัติ',
      example:
        'คลังรับของ 80 จาก 100 ชิ้น — ระบบตรวจพบยอดค้างรับ 20 ชิ้น จัดซื้อเป็นผู้รับผิดชอบติดตาม และผู้บริหารเห็นว่า SO-1042 อาจส่งช้า เมื่อของส่วนที่เหลือมาถึง ข้อยกเว้นถูกปิด',
    },
    trace: {
      title: 'การย้อนรอย',
      p: 'ทุกการเปลี่ยนแปลงสำคัญควรบอกได้ว่าใคร บทบาทใด แผนกใด ทำอะไร ก่อนและหลังเป็นอย่างไร เกิดขึ้นลำดับใด และอ้างอิงเอกสารใด',
      p2: 'การย้อนรอยไม่ได้มีไว้หาคนผิด แต่มีไว้ตอบคำถามภายหลังได้โดยไม่ต้องพึ่งความจำ เช่น Lot นี้รับเข้าเมื่อไร หรือใครอนุมัติการจ่ายนี้',
    },
    completion: {
      title: 'การปิดงาน',
      p: 'งานปิดเมื่อทุกแผนกทำส่วนของตัวเองครบ ไม่ใช่เมื่อแผนกสุดท้ายกดปุ่ม — ของถูกส่งมอบ เอกสารครบ และข้อยกเว้นทั้งหมดถูกปิด',
      p2: 'ใน Demo งานชิ้นนี้มีการส่งต่อ 7 ครั้ง ผ่าน 4 แผนก มีข้อยกเว้น 1 รายการ และมีการปิดรับสินค้าที่ถูกป้องกันไว้ 1 ครั้ง — ทั้งหมดอยู่ในประวัติงาน',
    },
  } satisfies Record<string, Stage & { parts?: string[] }>,
  links: { full: 'ดูแบบโต้ตอบใน How CORE Works', demo: 'ลองใน CORE Demo' },
  cta: {
    title: 'ลองเดินงานชิ้นนี้ด้วยตัวเอง',
    body: 'Demo ใช้งานชิ้นเดียวกันนี้ — สลับบทบาทได้ระหว่างทาง ไม่ต้องสมัคร',
    primary: 'เปิด CORE Demo',
    secondary: 'ดู How CORE Works',
  },
};

export const HOW_CORE_WORKS_GUIDE: Localized<typeof th> = {
  th,
  en: {
    intro:
      'This is the reading version of How CORE Works — following order SO-1042 step by step and explaining why each step exists. For the interactive version, open How CORE Works or try the demo.',
    map: {
      caption:
        'The eight stages of one work item — an exception should not happen, but must be seen when it does',
      steps: [
        { label: 'Work item', note: 'SO-1042' },
        { label: 'Owner', note: 'Who is responsible' },
        { label: 'State', note: 'Where it is' },
        { label: 'Handoff', note: 'With the information' },
        { label: 'Approval', note: 'Under conditions' },
        { label: 'Exception', note: 'Raised, not hidden' },
        { label: 'Trace', note: 'Who did what' },
        { label: 'Completion', note: 'Every department done' },
      ],
    },
    stages: {
      item: {
        title: 'The work item',
        p: 'The starting point is seeing work as a “piece” that travels through several departments, not as separate documents in each one. One customer order carries the sale, the stock check, the purchase, the receipt and the accounting documents on one route.',
        p2: 'When every department looks at the same piece of work, the question changes from “where is that document?” to “how far has this work got?”',
        example:
          'Example Co., Ltd. orders 120 units of 5 L cleaning solution (SO-1042). The warehouse holds 20. This work will pass through Sales, Purchasing, Warehouse and Accounting before it can be delivered.',
      },
      owner: {
        title: 'The owner',
        p: 'At every step the work has one clear owner. Work that “everyone is responsible for” tends to become work nobody is responsible for — the first cause of work falling through.',
        p2: 'Owning does not mean working alone. It means knowing the next step is yours, and everyone else knowing whom to ask.',
      },
      state: {
        title: 'The state',
        p: 'The state is where the work is right now, seen the same way by every department. A good state says what the work is waiting on, not just that it is “in progress”.',
        p2: 'Compare “in progress” with “awaiting 20 units from the supplier on PO-2215” — the second means nobody has to call and ask.',
      },
      handoff: {
        title: 'The handoff',
        p: 'When the owner changes, a good handoff is not a message saying “sent it”. It is the information the next step needs, travelling with the work.',
        parts: [
          'Who handed it on, and who received it',
          'The state before and after',
          'The required information',
          'What the receiver does next',
        ],
        example:
          'Sales sees a 100-unit shortage and hands the work to Purchasing — Purchasing receives the item, the missing quantity and the customer’s date without having to ask back.',
      },
      approval: {
        title: 'The approval',
        p: 'Approval is part of the work, not a separate button. Work that needs approval waits at that step, and everyone can see whom it is waiting on and for how long.',
        p2: 'Conditions follow the organization — for example, approval when a deposit is paid, or above a set value. The actual steps are defined by the implementation scope.',
        example:
          'The supplier needs a deposit before shipping PO-2215. The payment request waits with Accounting, which checks the PO and supporting documents. Once approved, the supplier confirms the order.',
      },
      exception: {
        title: 'The exception',
        p: 'Normal work should flow — anomalies should be seen. An exception is something not going as normal, raised with a responsible owner instead of waiting for someone to notice.',
        p2: 'A good exception has three parts: what happened, who is responsible, and which work it affects. When resolved, it closes and stays in the history.',
        example:
          'The warehouse receives 80 of 100 units — the system detects 20 outstanding, Purchasing owns the follow-up, and executives see that SO-1042 may be late. When the balance arrives, the exception closes.',
      },
      trace: {
        title: 'The trace',
        p: 'Every important change should say who, in which role and department, did what, what it was before and after, in what order, and which document it refers to.',
        p2: 'Trace is not for finding someone to blame. It is for answering questions later without relying on memory — when was this lot received, who approved this payment.',
      },
      completion: {
        title: 'Completion',
        p: 'Work is complete when every department has finished its part, not when the last department clicks a button — goods delivered, documents complete, and every exception closed.',
        p2: 'In the demo this work item has 7 handoffs across 4 departments, 1 exception and 1 prevented attempt to close receiving — all of it in the work history.',
      },
    },
    links: { full: 'See it interactively on How CORE Works', demo: 'Try the CORE demo' },
    cta: {
      title: 'Walk this work item yourself',
      body: 'The demo uses this same work item — switch roles along the way, no sign-up.',
      primary: 'Open the CORE demo',
      secondary: 'See How CORE Works',
    },
  },
  'zh-CN': {
    intro:
      '本指南是“CORE 如何运作”的阅读版——逐步跟随订单 SO-1042，说明每一步为何存在。想看互动版本，请打开“CORE 如何运作”页面或体验演示。',
    map: {
      caption: '一项工作的八个阶段——异常不应发生，但发生时必须被看到',
      steps: [
        { label: '工作项', note: 'SO-1042' },
        { label: '负责人', note: '谁负责' },
        { label: '状态', note: '在哪里' },
        { label: '交接', note: '连同信息' },
        { label: '审批', note: '按条件' },
        { label: '异常', note: '被凸显' },
        { label: '追溯', note: '谁做了什么' },
        { label: '完成', note: '所有部门完成' },
      ],
    },
    stages: {
      item: {
        title: '工作项',
        p: '起点是把工作看成一个在多个部门之间流动的“项”，而不是各部门各自的单据。一张客户订单在同一条路线上包含销售、库存检查、采购、收货和财务单据。',
        p2: '当所有部门看着同一项工作，问题就从“那份单据在哪里”变成“这项工作进行到哪一步了”。',
        example:
          '示例有限公司订购 120 件 5 升清洁剂（SO-1042），仓库有 20 件。这项工作要经过销售部、采购部、仓库和财务会计，才能交付。',
      },
      owner: {
        title: '负责人',
        p: '每一步工作都有一个明确的负责人。“人人负责”的工作往往变成无人负责——这是工作遗漏的首要原因。',
        p2: '负责并不是独自完成，而是知道下一步是自己的事，其他人也知道该问谁。',
      },
      state: {
        title: '状态',
        p: '状态是工作当前所处的位置，所有部门看到的一样。好的状态说明工作在“等什么”，而不只是“进行中”。',
        p2: '比较“进行中”和“按 PO-2215 等待供应商的 20 件货”——后者让任何人都不必打电话询问。',
      },
      handoff: {
        title: '交接',
        p: '负责人变更时，好的交接不是一句“已经发了”，而是下一步需要的信息随工作一起传递。',
        parts: ['交出方与接收方', '交接前后的状态', '必需信息', '接收方接下来要做什么'],
        example:
          '销售部发现缺货 100 件，把工作交给采购部——采购部收到商品、缺少的数量和客户要求的日期，无需反问。',
      },
      approval: {
        title: '审批',
        p: '审批是工作的一部分，而不是单独的按钮。需要审批的工作会停在那一步，所有人都能看到在等谁、等了多久。',
        p2: '条件按组织设定，例如支付定金时需要审批，或金额超过设定标准时需要审批——具体步骤按实施范围确定。',
        example:
          '供应商要求在按 PO-2215 发货前支付定金。付款申请在财务会计处等待，财务检查采购单与附件，审批通过后供应商确认订单。',
      },
      exception: {
        title: '异常',
        p: '正常的工作应顺畅流动——异常应被看见。异常是不按常规进行的情况，会连同负责人一起被凸显，而不是等人自己发现。',
        p2: '好的异常有三部分：发生了什么、谁负责、影响哪项工作。解决后异常关闭，但仍保留在历史中。',
        example:
          '仓库收到 80 / 100 件——系统发现待收 20 件，由采购部负责跟进，管理层看到 SO-1042 可能延迟。剩余货物到达后，异常关闭。',
      },
      trace: {
        title: '追溯',
        p: '每一次重要变更都应说明是谁、什么角色、哪个部门、做了什么、前后有何不同、发生顺序以及引用的单据。',
        p2: '追溯不是为了找人问责，而是为了日后不靠记忆就能回答问题——这个批次何时收货、谁批准了这笔付款。',
      },
      completion: {
        title: '完成',
        p: '当所有部门都完成各自的部分，工作才算完成，而不是最后一个部门点下按钮——货物已交付、单据齐全、所有异常已关闭。',
        p2: '在演示中，这项工作经过 7 次交接、4 个部门、1 个异常，以及 1 次被阻止的关闭收货——全部记录在工作历史中。',
      },
    },
    links: { full: '在“CORE 如何运作”中查看互动版', demo: '体验 CORE 演示' },
    cta: {
      title: '亲自走一遍这项工作',
      body: '演示使用的正是这项工作——过程中可切换角色，无需注册。',
      primary: '打开 CORE 演示',
      secondary: '查看 CORE 如何运作',
    },
  },
};

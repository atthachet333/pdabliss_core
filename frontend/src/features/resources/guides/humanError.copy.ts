import type { Localized } from '@/i18n/useCopy';

export const PRINCIPLES = ['prevent', 'detect', 'alert', 'control', 'trace'] as const;
export type Principle = (typeof PRINCIPLES)[number];
export const MISTAKE_ROWS = [
  { id: 'missingLot', principle: 'prevent' },
  { id: 'wrongQty', principle: 'detect' },
  { id: 'nearExpiry', principle: 'alert' },
  { id: 'supplierLate', principle: 'alert' },
  { id: 'missingDocs', principle: 'control' },
  { id: 'skippedApproval', principle: 'control' },
] as const;
type MistakeId = (typeof MISTAKE_ROWS)[number]['id'];

type PrincipleText = {
  name: string;
  when: string;
  title: string;
  p: string;
  example: string;
  limit: string;
  ask: string;
};

const th = {
  intro: {
    p1: 'คนทำผิดพลาดได้เสมอ — เหนื่อย ถูกขัดจังหวะ เพิ่งเริ่มงาน หรือแค่พิมพ์ผิด การออกแบบระบบที่ดีจึงไม่ได้ตั้งต้นจากการคาดหวังว่าคนจะไม่พลาด แต่ตั้งต้นจากคำถามว่า ทำอย่างไรให้พลาดยากขึ้น และเมื่อพลาดแล้ว เห็นได้เร็วขึ้น',
    p2: 'ความผิดพลาดที่ถูกจับได้ตรงจุดที่เกิด แก้ง่ายกว่าความผิดพลาดที่ไหลไปถึงลูกค้าหรือถึงงบการเงินมาก CORE จึงใช้ห้าหลักการเดียวกันทั้งระบบ แต่ละหลักการทำงานคนละช่วงของงาน',
    boundary:
      'ไม่มีระบบใดทำให้ความผิดพลาดหายไปทั้งหมด — สิ่งที่ระบบทำได้คือลดโอกาส จับได้เร็วขึ้น และทำให้ย้อนดูได้ว่าเกิดอะไรขึ้น',
  },
  map: {
    caption: 'ห้าหลักการทำงานคนละช่วง: ก่อนขั้นจบ ตอนเทียบผล ตามเวลา ที่ประตูสำคัญ และหลังเกิดเหตุ',
  },
  principles: {
    prevent: {
      name: 'ป้องกัน',
      when: 'ก่อนขั้นจะจบ',
      title: 'ป้องกัน — ทำต่อไม่ได้ ถ้าข้อมูลที่จำเป็นยังไม่ครบ',
      p: 'หลักการแรกคือไม่ปล่อยให้ขั้นหนึ่งจบโดยขาดข้อมูลที่ขั้นถัดไปต้องใช้ ระบบไม่ได้ตำหนิใคร แค่ไม่ให้ขั้นนั้นปิดจนกว่าจะครบ พร้อมบอกว่าขาดอะไร',
      example:
        'ใน Demo คลังปิดรับสินค้าไม่ได้จนกว่าจะระบุ Lot และวันหมดอายุ ระบบแสดงข้อความ “ยังปิดรับไม่ได้ — ต้องระบุ Lot และวันหมดอายุก่อน” ติดกับปุ่ม และบันทึกความพยายามนั้นไว้ในประวัติ',
      limit:
        'ป้องกันได้เฉพาะสิ่งที่กำหนดว่าจำเป็น และถ้ากำหนดช่องบังคับมากเกินไป คนจะกรอกเพื่อให้ผ่าน ไม่ใช่เพื่อให้ถูก — เลือกเฉพาะข้อมูลที่ถ้าขาดแล้วสร้างปัญหาต่อจริง',
      ask: 'ข้อมูลอะไรในงานของคุณ ที่ถ้าขาดตอนนี้ จะกลายเป็นปัญหาของแผนกถัดไป?',
    },
    detect: {
      name: 'ตรวจพบ',
      when: 'ตอนเทียบผลกับสิ่งที่คาด',
      title: 'ตรวจพบ — เห็นส่วนต่างทันทีที่เกิด',
      p: 'การตรวจพบคือการเทียบสิ่งที่เกิดขึ้นกับสิ่งที่ควรเป็น ทันทีที่บันทึก ไม่ใช่ตอนสิ้นเดือน ส่วนต่างที่เห็นวันนี้ยังแก้ได้ง่าย',
      example:
        'PO สั่ง 100 ชิ้น คลังรับเข้า 80 ชิ้น — CORE เห็นยอดค้างรับ 20 ชิ้นทันที แจ้งจัดซื้อ และงานที่รอของชิ้นนี้ก็รู้ว่าอาจล่าช้า',
      limit:
        'ตรวจพบได้เมื่อมีสิ่งให้เทียบ ถ้าตัวอ้างอิงผิดตั้งแต่ต้น เช่น PO ระบุจำนวนผิด การเทียบก็จะผ่าน — ข้อมูลต้นทางที่ถูกจึงสำคัญเท่ากับการตรวจ',
      ask: 'ตัวเลขใดที่ควรตรงกันระหว่างสองแผนก แต่วันนี้รู้ว่าไม่ตรงก็ต่อเมื่อสายไปแล้ว?',
    },
    alert: {
      name: 'แจ้งเตือน',
      when: 'เมื่อเวลาผ่านไป',
      title: 'แจ้งเตือน — บอกคนที่ทำอะไรได้ ก่อนที่จะสายเกินไป',
      p: 'ความผิดพลาดบางอย่างไม่ได้เกิดจากการทำผิด แต่เกิดจากสิ่งที่ควรเกิดแล้วยังไม่เกิด การแจ้งเตือนผูกกับเวลา และส่งถึงคนที่แก้ได้ ไม่ใช่ทุกคน',
      example:
        'เลยวันที่คาดว่าจะได้รับของตาม PO แล้ว จัดซื้อได้รับแจ้งก่อนที่ฝ่ายขายต้องโทรถาม หรือ Lot เก่าใกล้หมดอายุ คลังได้รับคำแนะนำให้จ่ายก่อนตาม FEFO',
      limit:
        'การแจ้งเตือนที่มากเกินไปจะถูกมองข้าม แจ้งเตือนที่ดีมีน้อย ชัด และส่งถึงคนที่ลงมือได้ — ถ้าทุกอย่างเป็นเรื่องด่วน ก็ไม่มีอะไรด่วน',
      ask: 'อะไรที่ถ้าช้าไปหนึ่งวันจะกระทบลูกค้า และใครควรรู้เป็นคนแรก?',
    },
    control: {
      name: 'ควบคุม',
      when: 'ที่ประตูสำคัญ',
      title: 'ควบคุม — งานที่ย้อนกลับยากต้องผ่านเงื่อนไขก่อน',
      p: 'การควบคุมวางไว้ตรงจุดที่ผลกระทบสูงหรือย้อนกลับยาก เช่น การจ่ายเงิน การยืนยันกับ Supplier หรือการปิดงาน งานจะเดินต่อเมื่อเงื่อนไขครบเท่านั้น',
      example:
        'คำขอจ่ายเงินที่ยังไม่มีใบรับสินค้า ไปไม่ถึงการอนุมัติ และงานที่กำหนดให้ต้องผ่านผู้อนุมัติ จะไม่เดินต่อจนกว่าจะผ่านขั้นที่กำหนด',
      limit:
        'การควบคุมทุกจุดทำให้งานช้า ควรวางเฉพาะจุดที่ผลกระทบสูง — ขั้นตอนจริงกำหนดตามขอบเขตการวางระบบของแต่ละองค์กร',
      ask: 'การกระทำใดในองค์กรของคุณ ที่ถ้าทำผิดแล้วแก้คืนยากที่สุด?',
    },
    trace: {
      name: 'ย้อนรอย',
      when: 'หลังเกิดเหตุ',
      title: 'ย้อนรอย — รู้ว่าเกิดอะไรขึ้น เพื่อแก้ที่ Process',
      p: 'เมื่อมีอะไรผิดปกติ การย้อนรอยบอกได้ว่าใคร บทบาทใด ทำอะไร ก่อนและหลังเป็นอย่างไร และเกิดขึ้นลำดับใด โดยไม่ต้องพึ่งความจำของใคร',
      example:
        'Lot นี้มาจากการรับครั้งไหน ใครอนุมัติการจ่ายนี้ ขั้นไหนเป็นจุดที่งานเริ่มช้า — คำถามเหล่านี้ตอบได้จากประวัติงาน',
      limit:
        'การย้อนรอยอธิบายสิ่งที่เกิดแล้ว ไม่ได้ป้องกันสิ่งที่จะเกิด คุณค่าของมันคือทำให้องค์กรเรียนรู้และปรับ Process ไม่ใช่หาคนผิด',
      ask: 'ถ้ามีปัญหาเกิดขึ้นวันนี้ จะรู้ได้ไหมว่ามันเริ่มจากขั้นไหน?',
    },
  } satisfies Record<Principle, PrincipleText>,
  labels: { example: 'ตัวอย่าง', limit: 'ขีดจำกัด', ask: 'ลองถามกับ Process ของคุณ' },
  table: {
    title: 'ความผิดพลาดที่พบบ่อย กับหลักการที่ช่วย',
    caption: 'หกกรณีเดียวกับหน้า Solutions — แต่ละกรณีมีหลักการหลักหนึ่งข้อ',
    mistake: 'ความผิดพลาด',
    principle: 'หลักการ',
    action: 'สิ่งที่เกิดขึ้น',
    rows: {
      missingLot: {
        mistake: 'รับสินค้าโดยไม่บันทึก Lot หรือวันหมดอายุ',
        action: 'รับเข้าไม่สำเร็จจนกว่าจะบันทึกครบ',
      },
      wrongQty: {
        mistake: 'PO สั่ง 100 หน่วย คลังรับเข้า 80 หน่วย',
        action: 'พักส่วนต่าง 20 หน่วยไว้ตรวจ และแจ้งจัดซื้อ',
      },
      nearExpiry: {
        mistake: 'Lot เก่าใกล้หมดอายุ แต่ยังไม่มีใครจ่าย',
        action: 'แจ้งคลังล่วงหน้า และแนะนำให้จ่ายก่อนตาม FEFO',
      },
      supplierLate: {
        mistake: 'เลยวันที่คาดว่าจะได้รับ แต่ไม่มีใครรู้',
        action: 'แจ้งจัดซื้อ และบอกงานที่ได้รับผลกระทบ',
      },
      missingDocs: {
        mistake: 'ขอจ่ายเงินโดยยังไม่มีใบรับสินค้า',
        action: 'ยังไปถึงการอนุมัติไม่ได้จนกว่าเอกสารครบ',
      },
      skippedApproval: {
        mistake: 'ส่งงานต่อโดยยังไม่ผ่านผู้อนุมัติที่กำหนด',
        action: 'งานไม่เดินต่อจนกว่าจะผ่านขั้นที่กำหนด',
      },
    } satisfies Record<MistakeId, { mistake: string; action: string }>,
  },
  design: {
    title: 'ออกแบบเพื่อช่วยคน ไม่ใช่เพื่อจับผิดคน',
    p: 'ระบบที่ใช้หลักการเหล่านี้ได้ดีมีลักษณะร่วมกันไม่กี่ข้อ ซึ่งใช้ได้แม้คุณจะยังไม่ได้ใช้ CORE',
    items: [
      'จับที่ต้นทาง — ตรวจตอนบันทึก ดีกว่าตรวจตอนสิ้นเดือน',
      'บอกให้ชัดว่าขาดอะไร และต้องทำอะไรต่อ ในข้อความเดียว',
      'ให้แก้ไปข้างหน้าได้ โดยประวัติยังอยู่ครบ',
      'ใช้การย้อนรอยเป็นข้อมูลปรับ Process ไม่ใช่หลักฐานลงโทษ',
      'เริ่มจากจุดที่ผลกระทบสูงไม่กี่จุด แล้วค่อยขยาย',
    ],
  },
  links: {
    demo: 'ลองการป้องกันในมุมมองคลัง (Demo)',
    solutions: 'Human Error ในหน้า Solutions',
    workflow: 'การป้องกัน Human Error ใน How CORE Works',
  },
  cta: {
    title: 'ลองดูการป้องกันด้วยตัวเอง',
    body: 'ใน Demo ลองปิดรับสินค้าโดยยังไม่ระบุ Lot แล้วดูว่าเกิดอะไรขึ้น',
    primary: 'เปิด Demo ในมุมมองคลัง',
    secondary: 'คุยกับทีม PDA BLISS',
  },
};

export const HUMAN_ERROR_GUIDE: Localized<typeof th> = {
  th,
  en: {
    intro: {
      p1: 'People will always make mistakes — tired, interrupted, new to the job, or just a typo. Good system design does not start from expecting people never to slip. It starts from asking how to make mistakes harder to make, and quicker to see when they happen.',
      p2: 'A mistake caught where it happens is far easier to fix than one that reaches a customer or the financial statements. So CORE uses the same five principles everywhere, each acting at a different moment of the work.',
      boundary:
        'No system makes every mistake disappear. What a system can do is lower the chance, catch mistakes sooner, and make it possible to look back at what happened.',
    },
    map: {
      caption:
        'Five principles at five moments: before a step closes, when results are compared, over time, at important gates, and afterwards',
    },
    principles: {
      prevent: {
        name: 'Prevent',
        when: 'Before a step closes',
        title: 'Prevent — no moving on without the required information',
        p: 'The first principle is not letting a step finish without the information the next step needs. The system blames nobody; it simply will not close the step until it is complete, and says what is missing.',
        example:
          'In the demo, the warehouse cannot close receiving until the lot and expiry date are recorded. A message appears beside the action — receiving cannot close yet; record the lot and expiry first — and the attempt is kept in the history.',
        limit:
          'It only prevents what is defined as required, and too many mandatory fields make people type to get past, not to be right. Choose the information whose absence really causes trouble later.',
        ask: 'What information in your work, if missing now, becomes the next department’s problem?',
      },
      detect: {
        name: 'Detect',
        when: 'When results are compared',
        title: 'Detect — see the difference the moment it happens',
        p: 'Detection compares what happened with what should have happened, at the moment it is recorded — not at month end. A difference seen today is still easy to fix.',
        example:
          'The PO orders 100 units; the warehouse receives 80. CORE sees the 20 outstanding immediately, tells Purchasing, and the work waiting on these goods knows it may be late.',
        limit:
          'Detection needs something to compare against. If the reference is wrong from the start — a PO with the wrong quantity — the comparison passes. Correct source data matters as much as the check.',
        ask: 'Which numbers should match between two departments, yet today you only learn they don’t when it is too late?',
      },
      alert: {
        name: 'Alert',
        when: 'As time passes',
        title: 'Alert — tell the person who can act, before it is too late',
        p: 'Some mistakes are not wrong actions but things that should have happened by now and haven’t. Alerts are tied to time and go to the person who can fix it, not to everyone.',
        example:
          'The expected receipt date on a PO has passed: Purchasing is told before Sales has to call. Or an older lot is nearing expiry: the warehouse is advised to issue it first, by FEFO.',
        limit:
          'Too many alerts get ignored. Good alerts are few, clear and sent to someone who can act — if everything is urgent, nothing is.',
        ask: 'What, if one day late, affects the customer — and who should know first?',
      },
      control: {
        name: 'Control',
        when: 'At important gates',
        title: 'Control — work that is hard to undo passes conditions first',
        p: 'Controls sit where the impact is high or hard to reverse: paying money, confirming with a supplier, closing work. The work moves on only when the conditions are met.',
        example:
          'A payment request without a goods receipt cannot reach approval, and work that must pass an approver does not move on until that step is passed.',
        limit:
          'Controlling every step slows everything down. Place controls only where the impact is high — the actual steps are set by each organization’s implementation scope.',
        ask: 'Which action in your organization is hardest to put right once it is done wrong?',
      },
      trace: {
        name: 'Trace',
        when: 'Afterwards',
        title: 'Trace — know what happened, so the process can be fixed',
        p: 'When something goes wrong, trace shows who, in which role, did what, what it was before and after, and in what order — without relying on anyone’s memory.',
        example:
          'Which receipt did this lot come from? Who approved this payment? At which step did the work start to slow? The work history answers these.',
        limit:
          'Trace explains what already happened; it does not prevent what comes next. Its value is helping the organization learn and adjust the process — not finding someone to blame.',
        ask: 'If a problem happened today, could you tell which step it started from?',
      },
    },
    labels: { example: 'Example', limit: 'Limit', ask: 'Ask of your own process' },
    table: {
      title: 'Common mistakes, and the principle that helps',
      caption: 'The same six cases as the Solutions page — each with one main principle',
      mistake: 'Mistake',
      principle: 'Principle',
      action: 'What happens',
      rows: {
        missingLot: {
          mistake: 'Goods received without recording the lot or expiry',
          action: 'Receiving cannot complete until they are recorded',
        },
        wrongQty: {
          mistake: 'The PO orders 100 units; the warehouse receives 80',
          action: 'The 20-unit difference is held for checking and Purchasing is told',
        },
        nearExpiry: {
          mistake: 'An older lot is nearing expiry, but nobody has issued it',
          action: 'The warehouse is told in advance and advised to issue it first by FEFO',
        },
        supplierLate: {
          mistake: 'The expected date has passed, and nobody knows',
          action: 'Purchasing is told, along with the work affected',
        },
        missingDocs: {
          mistake: 'Payment requested before there is a goods receipt',
          action: 'It cannot reach approval until the documents are complete',
        },
        skippedApproval: {
          mistake: 'Work handed on before the required approver has passed it',
          action: 'The work does not move on until that step is passed',
        },
      },
    },
    design: {
      title: 'Design to help people, not to catch them out',
      p: 'Systems that use these principles well share a few traits — useful even if you never use CORE.',
      items: [
        'Catch at the source — checking at entry beats checking at month end',
        'Say clearly what is missing and what to do next, in one message',
        'Let people fix forward while the history stays complete',
        'Use trace as feedback on the process, not as evidence for punishment',
        'Start with a few high-impact points, then extend',
      ],
    },
    links: {
      demo: 'Try prevention in the warehouse view (demo)',
      solutions: 'Human error on Solutions',
      workflow: 'Human error prevention on How CORE Works',
    },
    cta: {
      title: 'See prevention for yourself',
      body: 'In the demo, try to close receiving without a lot and see what happens.',
      primary: 'Open the demo as Warehouse',
      secondary: 'Talk to the PDA BLISS team',
    },
  },
  'zh-CN': {
    intro: {
      p1: '人总会出错——疲惫、被打断、刚上手，或只是打错字。好的系统设计不是从“期望人不出错”出发，而是从“如何让错误更难发生、发生后更快被发现”出发。',
      p2: '在发生处就被抓住的差错，比流到客户或财务报表的差错容易处理得多。所以 CORE 在整个系统中使用同样的五个原则，每个原则作用于工作的不同时刻。',
      boundary:
        '没有任何系统能让所有差错消失。系统能做的是降低发生的可能、更早发现差错，并让人可以回看发生了什么。',
    },
    map: {
      caption: '五个原则作用于五个时刻：步骤结束前、比对结果时、随时间推移、在重要关口，以及事后',
    },
    principles: {
      prevent: {
        name: '预防',
        when: '步骤结束前',
        title: '预防——必需信息不全就无法继续',
        p: '第一个原则是不让一个步骤在缺少下一步所需信息的情况下结束。系统不责怪任何人，只是在信息齐全前不让该步骤关闭，并说明缺什么。',
        example:
          '在演示中，仓库在登记批次和有效期之前无法关闭收货。操作旁会出现提示——尚无法关闭收货，请先登记批次和有效期——这次尝试也会记录在历史中。',
        limit:
          '它只能预防被定义为必需的内容。必填项过多，人们会为了通过而填写，而不是为了正确。只选择那些缺失后真的会造成后续问题的信息。',
        ask: '您工作中的哪些信息，如果现在缺失，会变成下一个部门的问题？',
      },
      detect: {
        name: '发现',
        when: '比对结果时',
        title: '发现——差异一出现就看到',
        p: '发现是在记录的那一刻，把实际发生的与应该发生的进行比对——而不是到月底。今天看到的差异仍然容易纠正。',
        example:
          '采购单订购 100 件，仓库收到 80 件。CORE 立即看到待收 20 件，通知采购部，等待这批货的工作也知道可能延迟。',
        limit:
          '发现需要有比对的参照。如果参照本身一开始就错了——例如采购单数量写错——比对就会通过。正确的源头数据与检查同样重要。',
        ask: '哪些数字本应在两个部门之间一致，但如今要等到太晚才知道不一致？',
      },
      alert: {
        name: '提醒',
        when: '随时间推移',
        title: '提醒——在为时已晚之前告诉能采取行动的人',
        p: '有些差错不是做错了，而是本该发生却还没发生。提醒与时间挂钩，并发给能解决问题的人，而不是所有人。',
        example:
          '采购单的预计到货日已过：采购部在销售部不得不打电话询问之前就收到通知。或者旧批次临近到期：仓库被建议按 FEFO 先出。',
        limit:
          '提醒太多就会被忽视。好的提醒数量少、内容清楚，并发给能行动的人——如果一切都紧急，就没有什么是紧急的。',
        ask: '哪些事情晚一天就会影响客户？谁应该最先知道？',
      },
      control: {
        name: '管控',
        when: '在重要关口',
        title: '管控——难以撤回的工作要先满足条件',
        p: '管控放在影响大或难以撤回的地方：付款、向供应商确认、关闭工作。只有条件满足，工作才会继续。',
        example: '没有收货单的付款申请无法进入审批；规定须经审批人的工作，在通过该步骤前不会继续。',
        limit:
          '每一步都管控会让一切变慢。只在影响大的地方设置管控——具体步骤按各组织的实施范围确定。',
        ask: '在您的组织中，哪项操作一旦做错最难纠正？',
      },
      trace: {
        name: '追溯',
        when: '事后',
        title: '追溯——知道发生了什么，才能改进流程',
        p: '出现异常时，追溯能显示是谁、什么角色、做了什么、前后有何不同、按什么顺序——无需依赖任何人的记忆。',
        example:
          '这个批次来自哪次收货？谁批准了这笔付款？工作从哪一步开始变慢？工作历史可以回答这些问题。',
        limit:
          '追溯解释已经发生的事，并不能预防接下来的事。它的价值在于帮助组织学习并调整流程——而不是找人问责。',
        ask: '如果今天出了问题，您能知道它是从哪一步开始的吗？',
      },
    },
    labels: { example: '示例', limit: '局限', ask: '试着问问您的流程' },
    table: {
      title: '常见差错，以及对应的原则',
      caption: '与解决方案页相同的六种情况——每种对应一个主要原则',
      mistake: '差错',
      principle: '原则',
      action: '会发生什么',
      rows: {
        missingLot: { mistake: '收货时未登记批次或有效期', action: '登记齐全前无法完成收货' },
        wrongQty: {
          mistake: '采购单订购 100 单位，仓库收到 80 单位',
          action: '将 20 单位差异暂存待查，并通知采购部',
        },
        nearExpiry: {
          mistake: '旧批次临近到期，但无人出货',
          action: '提前通知仓库，并建议按 FEFO 先出',
        },
        supplierLate: {
          mistake: '已过预计到货日，却无人知道',
          action: '通知采购部，并说明受影响的工作',
        },
        missingDocs: { mistake: '尚无收货单就申请付款', action: '单据齐全前无法进入审批' },
        skippedApproval: {
          mistake: '未经规定的审批人就交接工作',
          action: '通过规定步骤前，工作不会继续',
        },
      },
    },
    design: {
      title: '为帮助人而设计，而不是为挑错而设计',
      p: '用好这些原则的系统有几个共同点——即使不使用 CORE 也同样适用。',
      items: [
        '在源头抓住——录入时检查胜过月底检查',
        '用一条信息说清缺什么、接下来做什么',
        '允许向前修正，同时保留完整历史',
        '把追溯当作改进流程的依据，而不是惩罚的证据',
        '先从少数影响大的关口开始，再逐步扩展',
      ],
    },
    links: {
      demo: '在仓库视图中体验预防（演示）',
      solutions: '解决方案页中的人为差错',
      workflow: '“CORE 如何运作”中的人为差错预防',
    },
    cta: {
      title: '亲自看看预防如何运作',
      body: '在演示中，试着在未登记批次的情况下关闭收货，看看会发生什么。',
      primary: '以仓库角色打开演示',
      secondary: '与 PDA BLISS 团队沟通',
    },
  },
};

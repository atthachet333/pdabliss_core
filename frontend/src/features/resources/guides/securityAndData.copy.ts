import type { Localized } from '@/i18n/useCopy';

const th = {
  intro:
    'คู่มือนี้อธิบายแนวคิดด้านความปลอดภัยของ CORE ด้วยภาษาธรรมดา สำหรับคนที่ไม่ได้ทำงานด้านเทคนิค ถ้าต้องการสถานะของแต่ละส่วนแบบครบ ให้ดูที่ Security & Trust Center',
  center: 'ดู Security & Trust Center ฉบับเต็ม',
  boundaries: {
    title: 'ทำไมขอบเขตการมองเห็นจึงสำคัญ',
    p1: 'ลองนึกถึงกุญแจในอาคาร แต่ละคนมีกุญแจห้องที่ตัวเองทำงาน ไม่ใช่กุญแจทุกห้อง ไม่ใช่เพราะไม่ไว้ใจ แต่เพราะยิ่งมีกุญแจทุกห้องมากคน ความเสี่ยงก็ยิ่งมาก และยิ่งยากที่จะรู้ว่าใครเข้าห้องไหน',
    p2: 'ข้อมูลในองค์กรก็เช่นกัน เมื่อแต่ละบทบาทเห็นเฉพาะสิ่งที่จำเป็นต่อหน้าที่ งานชัดขึ้น ข้อมูลอ่อนไหวถูกเปิดน้อยลง และการแยกหน้าที่มีความหมาย',
    key: 'ความปลอดภัยไม่ได้เริ่มจาก Firewall แต่เริ่มจากการที่คนเห็นเฉพาะสิ่งที่จำเป็นต่อหน้าที่',
  },
  enforcement: {
    title: 'หน้าจอ กับ Server: ใครเป็นคนกั้น',
    p1: 'การซ่อนข้อมูลบนหน้าจอเหมือนการคว่ำเอกสารไว้บนโต๊ะ — คนส่วนใหญ่จะไม่พลิก แต่เอกสารยังอยู่บนโต๊ะ ขอบเขตที่แท้จริงคือการไม่ยื่นเอกสารนั้นให้ตั้งแต่แรก',
    p2: 'ในระบบที่ออกแบบถูก Server จะตรวจสิทธิ์ทุกครั้งก่อนส่งข้อมูล และส่งเฉพาะสิ่งที่บทบาทนั้นได้รับอนุญาต หน้าจอมีหน้าที่จัดสิ่งที่ได้รับให้ใช้งานง่าย ไม่ใช่หน้าที่ปิดบัง',
    flow: [
      { label: 'ผู้ใช้ขอข้อมูล', note: 'ในบทบาทของตัวเอง' },
      { label: 'Server ตรวจสิทธิ์', note: 'บทบาทนี้รับอะไรได้' },
      { label: 'ส่งเฉพาะที่อนุญาต', note: 'ส่วนอื่นไม่ถูกส่งเลย' },
      { label: 'หน้าจอแสดงผล', note: 'จัดให้ใช้งานง่าย' },
    ],
    caption: 'ขอบเขตอยู่ที่ Server — หน้าจอแสดงเฉพาะสิ่งที่ได้รับมาแล้ว',
    now: 'วันนี้: เว็บไซต์ Demo และต้นแบบแสดงแนวทางนี้ และ Backend พื้นฐานมีการจัดประเภทข้อมูลพร้อมตัวอย่าง Allow-list ที่ทดสอบกับข้อมูลตัวอย่าง การตรวจสิทธิ์ผู้ใช้จริงทุกคำขอที่ Server อยู่ในระยะ Backend ถัดไป',
  },
  trace: {
    title: 'การย้อนรอย: ความจำขององค์กร',
    p: 'เมื่อมีคำถามว่า “ใครเปลี่ยนสิ่งนี้ และเมื่อไร” องค์กรไม่ควรต้องพึ่งความจำของใคร ประวัติงานที่ดีบอกได้ว่า',
    items: [
      'ใคร และอยู่ในบทบาทและแผนกใด',
      'ทำอะไร ก่อนและหลังเป็นอย่างไร',
      'เกิดขึ้นลำดับใดในงานชิ้นนั้น',
      'อ้างอิงเอกสารใด',
    ],
    p2: 'CORE ออกแบบโครงสร้างประวัติงานนี้ไว้แล้ว และ Demo แสดงประวัติจำลอง การจัดเก็บในระบบจริงมาพร้อม Backend ระยะถัดไป',
  },
  readiness: {
    title: 'ก่อนใช้งานจริง ต้องพร้อมอะไรบ้าง',
    p: 'ระบบที่ใช้กับข้อมูลจริงต้องมีสิ่งที่ไม่ได้อยู่บนหน้าจอ ส่วนนี้กำหนดร่วมกันในขั้นตอนวางระบบ — ยังไม่ใช่บริการที่เปิดใช้งานอยู่ในวันนี้',
    items: [
      'การยืนยันตัวตนจริง — วันนี้หน้าเข้าสู่ระบบเป็นต้นแบบสำหรับตรวจหน้าจอเท่านั้น',
      'นโยบายสำรองข้อมูล และการทดสอบกู้คืนว่าทำได้จริง',
      'การเฝ้าระวังระบบ',
      'ขั้นตอนรับมือเมื่อเกิดเหตุขัดข้อง',
    ],
  },
  claims: {
    title: 'สิ่งที่ PDA BLISS ยังไม่อ้าง',
    p: 'ความน่าเชื่อถือเริ่มจากการไม่พูดเกินจริง วันนี้เรายังไม่อ้างสิ่งเหล่านี้',
    items: [
      'การรับรองมาตรฐานความปลอดภัยจากหน่วยงานภายนอก',
      'ตัวเลขความพร้อมใช้งาน หรือเวลากู้คืนระบบ',
      'การยืนยันตัวตนจริง SSO หรือ MFA ที่เปิดใช้งาน',
      'การบังคับสิทธิ์ของระบบจริงจากหน้าจอต้นแบบ',
    ],
    close: 'เราจะเพิ่มเมื่อมีหลักฐานที่ตรวจสอบได้เท่านั้น',
  },
  ask: {
    title: 'คำถามที่ควรถามผู้ให้บริการระบบใดก็ตาม',
    p: 'ไม่ว่าคุณจะเลือก CORE หรือระบบอื่น คำถามเหล่านี้ช่วยแยกคำโฆษณาออกจากสิ่งที่มีจริง',
    items: [
      'สิทธิ์ถูกบังคับที่ไหน — ที่หน้าจอ หรือที่ Server',
      'ขอดูได้ไหมว่าบทบาทหนึ่งได้รับข้อมูลอะไรบ้าง',
      'ประวัติการเปลี่ยนแปลงเก็บอะไร นานเท่าไร และใครแก้ไขได้',
      'การสำรองข้อมูลทำอย่างไร และเคยทดสอบกู้คืนจริงหรือยัง',
      'ใบรับรองที่อ้างถึง มีหลักฐานให้ตรวจได้หรือไม่',
    ],
  },
  links: { center: 'Security & Trust Center', enterprise: 'สำหรับองค์กร' },
  cta: {
    title: 'อยากคุยเรื่องสิทธิ์และการวางระบบ?',
    body: 'เริ่มจากว่าใครในองค์กรควรเห็นอะไร แล้วค่อยออกแบบระบบให้ตรงกับความรับผิดชอบจริง',
    primary: 'พูดคุยเรื่อง Security / Implementation',
    secondary: 'ดู Security & Trust Center',
  },
};

export const SECURITY_AND_DATA_GUIDE: Localized<typeof th> = {
  th,
  en: {
    intro:
      'This guide explains CORE’s approach to security in plain language, for readers who do not work in technology. For the status of every part in full, see the Security & Trust Center.',
    center: 'See the full Security & Trust Center',
    boundaries: {
      title: 'Why visibility boundaries matter',
      p1: 'Think of keys in a building. Each person has keys to the rooms they work in, not to every room. Not out of distrust — but the more people hold every key, the greater the risk, and the harder it is to know who entered which room.',
      p2: 'Information in an organization works the same way. When each role sees only what its work needs, work is clearer, sensitive information is less exposed, and separation of duties means something.',
      key: 'Security does not start with a firewall. It starts with people seeing only what their work requires.',
    },
    enforcement: {
      title: 'Screen or server: who draws the line',
      p1: 'Hiding information on screen is like turning a document face down on a desk — most people won’t flip it, but the document is still on the desk. The real boundary is never handing it over in the first place.',
      p2: 'In a well-designed system, the server checks permission before sending anything and sends only what that role is allowed to receive. The screen’s job is to make what it received easy to use, not to conceal.',
      flow: [
        { label: 'A user asks', note: 'In their own role' },
        { label: 'The server checks', note: 'What this role may receive' },
        { label: 'Only permitted data is sent', note: 'The rest is never sent' },
        { label: 'The screen shows it', note: 'Arranged for the work' },
      ],
      caption:
        'The boundary sits on the server — the screen shows only what has already been received',
      now: 'Today: this website, the demo and the prototype illustrate this approach, and the backend foundation classifies data with sample allow-lists tested on sample data. Server-side checks for real users on every request come in the next backend phases.',
    },
    trace: {
      title: 'Trace: the organization’s memory',
      p: 'When someone asks “who changed this, and when?”, an organization should not depend on anyone’s memory. A good work history says:',
      items: [
        'Who, and in which role and department',
        'What they did, and what it was before and after',
        'In what order, within that work item',
        'Which document it refers to',
      ],
      p2: 'CORE’s work-history structure is designed, and the demo shows a simulated history. Storing it in production arrives with the next backend phases.',
    },
    readiness: {
      title: 'What must be ready before live use',
      p: 'A system holding real data needs things that are not on any screen. These are defined together during implementation — not services running today.',
      items: [
        'Real identity — today’s sign-in page is a prototype for reviewing screens only',
        'A backup policy, and recovery tested to actually work',
        'Monitoring',
        'Procedures for when something goes wrong',
      ],
    },
    claims: {
      title: 'What PDA BLISS does not claim yet',
      p: 'Credibility starts with not overstating. Today we do not claim:',
      items: [
        'Third-party security certification',
        'Availability or recovery-time figures',
        'Live real identity, SSO or MFA',
        'Production permission enforcement from prototype screens',
      ],
      close: 'We will add to this only when there is verifiable evidence.',
    },
    ask: {
      title: 'Questions to ask any system provider',
      p: 'Whether you choose CORE or another system, these questions separate marketing from what actually exists.',
      items: [
        'Where are permissions enforced — on the screen, or on the server?',
        'Can you show exactly what one role receives?',
        'What does the change history keep, for how long, and who can alter it?',
        'How are backups made, and has a recovery actually been tested?',
        'For any certification mentioned, is there evidence to check?',
      ],
    },
    links: { center: 'Security & Trust Center', enterprise: 'For organizations' },
    cta: {
      title: 'Want to talk about access and implementation?',
      body: 'Start with who in your organization should see what, then design the system around real responsibility.',
      primary: 'Talk about security / implementation',
      secondary: 'See the Security & Trust Center',
    },
  },
  'zh-CN': {
    intro:
      '本指南用通俗的语言说明 CORE 的安全思路，写给非技术背景的读者。如需了解各部分的完整状态，请查看安全与信任中心。',
    center: '查看完整的安全与信任中心',
    boundaries: {
      title: '为什么可见边界很重要',
      p1: '想想大楼里的钥匙。每个人只拿自己工作房间的钥匙，而不是所有房间的钥匙。这不是不信任——而是拿着全部钥匙的人越多，风险越大，也越难知道谁进了哪个房间。',
      p2: '组织中的信息也是如此。当每个角色只看到工作所需的内容，工作更清楚，敏感信息暴露更少，职责分离也才有意义。',
      key: '安全不是从防火墙开始，而是从每个人只看到工作所需开始。',
    },
    enforcement: {
      title: '界面还是服务器：由谁来划界',
      p1: '在界面上隐藏信息，就像把文件反扣在桌上——大多数人不会翻看，但文件仍在桌上。真正的边界是一开始就不把文件交出去。',
      p2: '在设计良好的系统中，服务器每次发送前都会检查权限，只发送该角色获准接收的内容。界面的职责是让收到的信息易于使用，而不是遮掩。',
      flow: [
        { label: '用户请求', note: '以自己的角色' },
        { label: '服务器检查权限', note: '该角色可接收什么' },
        { label: '只发送获准内容', note: '其余内容根本不发送' },
        { label: '界面显示', note: '按工作需要排列' },
      ],
      caption: '边界在服务器端——界面只显示已经收到的内容',
      now: '目前：本网站、演示与原型展示了这一思路，基础后端也已对数据分类，并有用示例数据测试的允许清单示例。针对真实用户、对每个请求的服务器端检查将在后续后端阶段提供。',
    },
    trace: {
      title: '追溯：组织的记忆',
      p: '当有人问“谁改了这个、什么时候改的”，组织不应依赖任何人的记忆。好的工作历史能说明：',
      items: [
        '是谁，属于哪个角色和部门',
        '做了什么，前后有何不同',
        '在这项工作中的发生顺序',
        '引用了哪份单据',
      ],
      p2: 'CORE 的工作历史结构已经设计完成，演示中展示模拟历史。生产环境中的存储将随后续后端阶段提供。',
    },
    readiness: {
      title: '正式使用前需要准备好什么',
      p: '承载真实数据的系统需要一些不在界面上的东西。这些在实施阶段共同确定——并非目前已在运行的服务。',
      items: [
        '真实身份验证——目前的登录页仅是用于查看界面的原型',
        '备份策略，以及经过实际测试的恢复',
        '系统监控',
        '出现故障时的处理流程',
      ],
    },
    claims: {
      title: 'PDA BLISS 目前不作的声明',
      p: '可信始于不夸大。目前我们不声明：',
      items: [
        '第三方安全标准的认可',
        '可用性或恢复时间数字',
        '已启用的真实身份、SSO 或 MFA',
        '由原型界面实现的生产环境权限执行',
      ],
      close: '只有在具备可核实的证据时，我们才会补充说明。',
    },
    ask: {
      title: '应向任何系统供应商提出的问题',
      p: '无论您选择 CORE 还是其他系统，这些问题都能区分宣传与真实存在的东西。',
      items: [
        '权限在哪里执行——在界面上，还是在服务器端？',
        '能否展示某个角色具体收到哪些数据？',
        '变更历史记录什么、保留多久、谁能修改？',
        '备份如何进行？是否真正测试过恢复？',
        '提到的任何认可，是否有可供核实的证据？',
      ],
    },
    links: { center: '安全与信任中心', enterprise: '面向组织' },
    cta: {
      title: '想聊聊权限与系统实施吗？',
      body: '先从组织中谁该看到什么开始，再围绕真实的职责设计系统。',
      primary: '洽谈安全 / 实施',
      secondary: '查看安全与信任中心',
    },
  },
};

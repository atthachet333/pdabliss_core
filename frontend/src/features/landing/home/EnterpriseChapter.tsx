import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { ChapterMark } from './ChapterMark';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Architectural layers, foundation first. */
const LAYERS = [
  { en: 'Department-ready' },
  { en: 'Role-ready' },
  { en: 'Workflow-ready' },
  { en: 'Approval-ready' },
  { en: 'Audit-ready' },
  { en: 'Integration-ready' },
  { en: 'API-ready' },
  { en: 'Automation-ready' },
] as const;

const th = {
  layers: [
    'แยกพื้นที่ทำงานตามแผนก',
    'สิทธิ์และมุมมองตามบทบาท',
    'ขั้นตอนงานที่องค์กรกำหนดเอง',
    'ลำดับการอนุมัติหลายระดับ',
    'ประวัติการเปลี่ยนแปลงที่ย้อนดูได้',
    'เชื่อมต่อกับระบบที่องค์กรใช้อยู่',
    'โครงสร้างข้อมูลที่เปิดต่อได้',
    'งานซ้ำที่ระบบช่วยทำแทนได้',
  ],
  titleA: 'เริ่มจากกระบวนการที่องค์กรใช้วันนี้',
  titleB: 'และขยายไปพร้อมกับความซับซ้อนในวันข้างหน้า',
  lead: 'ไม่ต้องเปลี่ยนทั้งองค์กรในวันเดียว — เริ่มจากแผนกและงานที่สำคัญที่สุด แล้วเพิ่มแผนก บทบาท และขั้นตอนเมื่อองค์กรพร้อม บนโครงสร้างเดียวกัน',
  layersLabel: 'ชั้นโครงสร้างของ CORE',
  note: '“ready” หมายถึงโครงสร้างที่ CORE ถูกออกแบบมาเพื่อรองรับ — ความสามารถแต่ละส่วนเปิดใช้ตามแผนการพัฒนา และตามความต้องการของแต่ละองค์กร ไม่ใช่การรับรองมาตรฐานจากหน่วยงานภายนอก',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    layers: [
      'Workspaces separated by department',
      'Permissions and views by role',
      'Work steps your organization defines',
      'Multi-level approval sequences',
      'Change history you can look back on',
      'Connections to the systems you already use',
      'A data structure open to extension',
      'Repetitive work the system can take on',
    ],
    titleA: 'Start from the processes you use today',
    titleB: 'and grow with tomorrow’s complexity',
    lead: 'There is no need to change the whole organization in a day — start with the most important departments and work, then add departments, roles and steps when you are ready, on the same structure.',
    layersLabel: 'CORE structural layers',
    note: '“Ready” describes the structure CORE is designed to support — each capability is enabled according to the development roadmap and each organization’s needs. It is not a certification from any external body.',
  },
  'zh-CN': {
    layers: [
      '按部门划分的工作空间',
      '按角色设定的权限与视图',
      '由企业自定义的工作步骤',
      '多级审批顺序',
      '可追溯的变更历史',
      '与现有系统的连接',
      '可扩展的数据结构',
      '由系统代劳的重复性工作',
    ],
    titleA: '从企业今天使用的流程开始',
    titleB: '随着未来的复杂度一同扩展',
    lead: '无需在一天之内改变整个组织——从最重要的部门和工作开始，在准备好时再基于同一结构增加部门、角色与步骤。',
    layersLabel: 'CORE 的结构层',
    note: '“ready” 指 CORE 在设计上支持的结构——各项能力按开发规划及各企业需求启用，并非外部机构的标准认证。',
  },
};

const CX = 190;
const BASE_Y = 520;

function Plate({ i, spread }: { i: number; spread: MotionValue<number> }) {
  // Each plate rises by its index × the current spacing.
  const y = useTransform(spread, (s) => -i * s);
  const top = i === LAYERS.length - 1;
  return (
    <motion.g style={{ y }}>
      <path
        d={`M ${CX} ${BASE_Y - 70} L ${CX + 140} ${BASE_Y} L ${CX} ${BASE_Y + 70} L ${CX - 140} ${BASE_Y} Z`}
        fill="var(--color-brand-primary)"
        fillOpacity={0.04 + i * 0.022}
        stroke="var(--color-brand-glow)"
        strokeOpacity={top ? 0.8 : 0.25 + i * 0.05}
      />
      <path
        d={`M ${CX - 140} ${BASE_Y} L ${CX - 140} ${BASE_Y + 8} L ${CX} ${BASE_Y + 78} L ${CX + 140} ${BASE_Y + 8} L ${CX + 140} ${BASE_Y}`}
        fill="none"
        stroke="var(--color-brand-glow)"
        strokeOpacity="0.12"
      />
      <line
        x1={CX + 140}
        y1={BASE_Y}
        x2={CX + 175}
        y2={BASE_Y}
        stroke="var(--color-text-muted)"
        strokeOpacity="0.4"
      />
      <text
        x={CX + 182}
        y={BASE_Y + 5}
        fontSize="15"
        fill="var(--color-text-secondary)"
        letterSpacing="0.5"
      >
        {LAYERS[i]!.en}
      </text>
    </motion.g>
  );
}

/**
 * Chapter 09 — growth without replacement. An isometric stack of
 * architectural layers separates as the visitor scrolls past (native scroll,
 * no pin). The words describe what CORE is structured to support, not
 * certifications or finished integrations.
 */
export function EnterpriseChapter() {
  const c = useCopy(COPY);
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const spread = useTransform(scrollYProgress, [0, 1], reduce ? [52, 52] : [20, 52]);

  return (
    <section
      ref={ref}
      id="enterprise"
      aria-labelledby="enterprise-title"
      className="relative overflow-x-clip py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--color-surface-dark),#071119_60%,var(--color-surface-dark))]"
      />
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <svg aria-hidden viewBox="0 0 520 620" className="mx-auto w-full max-w-[30rem]">
              {LAYERS.map((_, i) => (
                <Plate key={i} i={i} spread={spread} />
              ))}
            </svg>
          </div>

          <div className="order-1 lg:order-2">
            <ChapterMark id="enterprise" />
            <h2 id="enterprise-title" className="mt-6 text-h1 text-text-primary">
              {c.titleA}
              <span className="block text-text-secondary">{c.titleB}</span>
            </h2>
            <p className="mt-6 text-body-lg text-text-secondary">{c.lead}</p>
            <ol aria-label={c.layersLabel} className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {LAYERS.map((l, i) => (
                <li key={l.en} className="flex gap-3">
                  <span className="mt-0.5 text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-label font-medium text-text-primary">{l.en}</span>
                    <span className="block text-caption text-text-secondary">{c.layers[i]}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-8 border-l border-border-strong pl-5 text-caption text-text-muted">
              {c.note}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { ChapterMark } from './ChapterMark';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Architectural layers, foundation first. */
const LAYERS = [
  { en: 'Department-ready', th: 'แยกพื้นที่ทำงานตามแผนก' },
  { en: 'Role-ready', th: 'สิทธิ์และมุมมองตามบทบาท' },
  { en: 'Workflow-ready', th: 'ขั้นตอนงานที่องค์กรกำหนดเอง' },
  { en: 'Approval-ready', th: 'ลำดับการอนุมัติหลายระดับ' },
  { en: 'Audit-ready', th: 'ประวัติการเปลี่ยนแปลงที่ย้อนดูได้' },
  { en: 'Integration-ready', th: 'เชื่อมต่อกับระบบที่องค์กรใช้อยู่' },
  { en: 'API-ready', th: 'โครงสร้างข้อมูลที่เปิดต่อได้' },
  { en: 'Automation-ready', th: 'งานซ้ำที่ระบบช่วยทำแทนได้' },
] as const;

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
              เริ่มจากกระบวนการที่องค์กรใช้วันนี้
              <span className="block text-text-secondary">
                และขยายไปพร้อมกับความซับซ้อนในวันข้างหน้า
              </span>
            </h2>
            <p className="mt-6 text-body-lg text-text-secondary">
              ไม่ต้องเปลี่ยนทั้งองค์กรในวันเดียว — เริ่มจากแผนกและงานที่สำคัญที่สุด แล้วเพิ่มแผนก
              บทบาท และขั้นตอนเมื่อองค์กรพร้อม บนโครงสร้างเดียวกัน
            </p>
            <ol
              aria-label="ชั้นโครงสร้างของ CORE"
              className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2"
            >
              {LAYERS.map((l, i) => (
                <li key={l.en} className="flex gap-3">
                  <span className="mt-0.5 text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-label font-medium text-text-primary">{l.en}</span>
                    <span className="block text-caption text-text-secondary">{l.th}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-8 border-l border-border-strong pl-5 text-caption text-text-muted">
              “ready” หมายถึงโครงสร้างที่ CORE ถูกออกแบบมาเพื่อรองรับ —
              ความสามารถแต่ละส่วนเปิดใช้ตามแผนการพัฒนา และตามความต้องการของแต่ละองค์กร
              ไม่ใช่การรับรองมาตรฐานจากหน่วยงานภายนอก
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

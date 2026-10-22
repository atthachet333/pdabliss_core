import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { useScrollStage } from './useScrollStage';

/* ------------------------------------------------------------------------ */
/* Story                                                                     */
/* ------------------------------------------------------------------------ */

const STAGES = [
  {
    key: 'TEAM',
    name: 'ธุรกิจที่กำลังเติบโต',
    en: 'Growing Business',
    body: 'ทีมเล็กที่ทำงานใกล้ชิดกัน — แต่เริ่มมีงานที่ต้องส่งต่อ ติดตาม และจดจำมากกว่าที่คนไม่กี่คนจะถือไว้ได้',
  },
  {
    key: 'DEPARTMENTS',
    name: 'องค์กรหลายแผนก',
    en: 'Multi-Department Organization',
    body: 'แต่ละแผนกเริ่มมีวิธีทำงาน เอกสาร และไฟล์ของตัวเอง ข้อมูลชุดเดียวกันถูกเก็บไว้หลายที่',
  },
  {
    key: 'CONNECTED OPERATIONS',
    name: 'ธุรกิจที่งานเดินผ่านหลายมือ',
    en: 'Operational Business',
    body: 'งานหนึ่งชิ้นผ่านหลายแผนก มีการอนุมัติ กำหนดเวลา และการส่งต่อ ที่ต้องไม่หลุดระหว่างทาง',
  },
  {
    key: 'ORGANIZATION',
    name: 'องค์กรที่ต้องการมาตรฐานและภาพรวม',
    en: 'Enterprise Organization',
    body: 'ผู้บริหารต้องเห็นภาพเดียวกันทั้งองค์กร และต้องมีมาตรฐาน — โดยไม่ทำให้แต่ละแผนกทำงานช้าลง',
  },
] as const;

const SIGNALS = [
  'กำลังเติบโต และงานเริ่มซับซ้อนขึ้นทุกไตรมาส',
  'มีหลายแผนกที่ต้องทำงานต่อกัน',
  'งานหนึ่งชิ้นถูกส่งต่อระหว่างทีม',
  'มีขั้นตอนอนุมัติก่อนดำเนินการ',
  'ผู้บริหารต้องการเห็นสถานะโดยไม่ต้องถามทีละคน',
  'ต้องการมาตรฐานการทำงานที่ทุกคนใช้ร่วมกัน',
  'ความผิดพลาดเล็ก ๆ เริ่มมีต้นทุนสูงขึ้น',
];

/* ------------------------------------------------------------------------ */
/* Organization evolution (SVG, 600×600)                                     */
/* ------------------------------------------------------------------------ */

const C = 300;
const HUBS = [
  { x: 170, y: 200, label: 'ฝ่ายขาย' },
  { x: 430, y: 200, label: 'ปฏิบัติการ' },
  { x: 430, y: 410, label: 'คลังสินค้า' },
  { x: 170, y: 410, label: 'จัดซื้อ · บัญชี' },
];
/** Three people per department; the first three also form the early team. */
const MEMBERS = HUBS.flatMap((h, hi) =>
  [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + hi * 0.7 + 0.4;
    return { hub: hi, x: h.x + Math.cos(a) * 46, y: h.y + Math.sin(a) * 46 };
  }),
);
const TEAM = [
  { x: C - 38, y: C + 12 },
  { x: C + 34, y: C + 20 },
  { x: C - 2, y: C - 34 },
];

function OrgEvolution({
  stage,
  reduce,
  className,
}: {
  stage: number;
  reduce: boolean;
  className?: string;
}) {
  const t = { duration: reduce ? 0 : 0.9, ease: EASE_CORE };
  const showHubs = stage >= 1;
  const linked = stage >= 2;
  const org = stage >= 3;
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      <defs>
        <radialGradient id="org-core">
          <stop offset="0%" stopColor="#3ef0c0" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#19c39a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#19c39a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Organization boundary */}
      <motion.circle
        cx={C}
        cy={C}
        r={262}
        fill="none"
        stroke="#2bb5a8"
        strokeDasharray="3 9"
        initial={false}
        animate={{ opacity: org ? 0.45 : 0, scale: org ? 1 : 0.9 }}
        transition={t}
        style={{ transformOrigin: '300px 300px' }}
      />
      {/* Executive layer */}
      <motion.g initial={false} animate={{ opacity: org ? 1 : 0, y: org ? 0 : 12 }} transition={t}>
        <line
          x1={C}
          y1={84}
          x2={C}
          y2={C - 40}
          stroke="#3ef0c0"
          strokeOpacity="0.35"
          strokeDasharray="2 6"
        />
        <circle cx={C} cy={70} r={11} fill="#0c1822" stroke="#b9f5e4" strokeOpacity="0.7" />
        <text x={C} y={44} textAnchor="middle" fill="#a3b8b2" fontSize="15">
          ผู้บริหาร
        </text>
      </motion.g>

      {/* Hub-to-hub handoffs */}
      {HUBS.map((h, i) => {
        const n = HUBS[(i + 1) % HUBS.length]!;
        const mx = (h.x + n.x) / 2 + (n.y - h.y) * 0.18;
        const my = (h.y + n.y) / 2 - (n.x - h.x) * 0.18;
        return (
          <motion.path
            key={`l${i}`}
            d={`M ${h.x} ${h.y} Q ${mx} ${my} ${n.x} ${n.y}`}
            fill="none"
            stroke="#7fd6ff"
            strokeWidth="1.4"
            initial={false}
            animate={{ pathLength: linked ? 1 : 0, opacity: linked ? 0.55 : 0 }}
            transition={{ ...t, delay: reduce ? 0 : i * 0.08 }}
          />
        );
      })}
      {/* CORE spokes */}
      {HUBS.map((h, i) => (
        <motion.line
          key={`s${i}`}
          x1={C}
          y1={C}
          x2={h.x}
          y2={h.y}
          stroke="#3ef0c0"
          strokeWidth="1.2"
          initial={false}
          animate={{ pathLength: org ? 1 : 0, opacity: org ? 0.5 : 0 }}
          transition={{ ...t, delay: reduce ? 0 : 0.2 + i * 0.06 }}
        />
      ))}

      {/* Department hubs */}
      {HUBS.map((h, i) => (
        <motion.g
          key={`h${i}`}
          initial={false}
          animate={{ opacity: showHubs ? 1 : 0, scale: showHubs ? 1 : 0.4 }}
          transition={{ ...t, delay: reduce ? 0 : i * 0.06 }}
          style={{ transformOrigin: `${h.x}px ${h.y}px` }}
        >
          <circle
            cx={h.x}
            cy={h.y}
            r={60}
            fill="#19c39a"
            fillOpacity="0.04"
            stroke="#2bb5a8"
            strokeOpacity="0.35"
          />
          <circle cx={h.x} cy={h.y} r={9} fill="#0c1822" stroke="#3ef0c0" strokeWidth="1.5" />
          <text
            x={h.x}
            y={h.y + (h.y < C ? -74 : 88)}
            textAnchor="middle"
            fill="#a3b8b2"
            fontSize="15"
          >
            {h.label}
          </text>
        </motion.g>
      ))}

      {/* People: a team first, then distributed across departments */}
      {MEMBERS.map((m, i) => {
        const inTeam = i < 3;
        const pos = stage === 0 ? (inTeam ? TEAM[i]! : { x: C, y: C }) : m;
        const visible = stage === 0 ? inTeam : true;
        return (
          <motion.circle
            key={`m${i}`}
            r={6}
            fill="#e8fff7"
            initial={false}
            animate={{ cx: pos.x, cy: pos.y, opacity: visible ? 0.9 : 0 }}
            transition={{ ...t, delay: reduce ? 0 : (i % 3) * 0.05 }}
          />
        );
      })}
      {/* Early team ties */}
      <motion.path
        d={`M ${TEAM[0]!.x} ${TEAM[0]!.y} L ${TEAM[1]!.x} ${TEAM[1]!.y} L ${TEAM[2]!.x} ${TEAM[2]!.y} Z`}
        fill="none"
        stroke="#b9f5e4"
        strokeOpacity="0.35"
        initial={false}
        animate={{ opacity: stage === 0 ? 1 : 0 }}
        transition={t}
      />

      {/* CORE */}
      <motion.g
        initial={false}
        animate={{ opacity: org ? 1 : 0, scale: org ? 1 : 0.6 }}
        transition={{ ...t, delay: reduce ? 0 : 0.15 }}
        style={{ transformOrigin: '300px 300px' }}
      >
        <circle cx={C} cy={C} r={70} fill="url(#org-core)" />
        <circle cx={C} cy={C} r={30} fill="#0a1620" stroke="#3ef0c0" strokeWidth="1.5" />
        <text x={C} y={C + 5} textAnchor="middle" fill="#3ef0c0" fontSize="13" letterSpacing="3">
          CORE
        </text>
      </motion.g>
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* Chapter                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Chapter 02 — Who CORE is for. Desktop: a short pinned scene (native scroll)
 * where a team grows into departments, connected operations and finally an
 * organization with CORE at its centre. Phones: the four stages stacked, each
 * with its own small diagram.
 */
export function WhoForChapter() {
  const pinRef = useRef<HTMLDivElement>(null);
  const { stage, reduce } = useScrollStage(pinRef, STAGES.length);

  return (
    <section id="who-for" aria-labelledby="who-for-title" className="relative overflow-x-clip">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_70%_20%,rgb(25_195_154/0.07),transparent_70%),linear-gradient(180deg,#050b12,#06101a_50%,#050b12)]"
      />
      <Container className="pt-20 sm:pt-28">
        <ChapterMark id="who-for" />
        <h2 id="who-for-title" className="mt-6 max-w-3xl text-h1 text-text-primary">
          CORE ถูกสร้างขึ้นสำหรับองค์กร
          <span className="block text-text-secondary">ที่งานเริ่มเดินผ่านหลายแผนก</span>
        </h2>
        <p className="mt-5 max-w-xl text-body-lg text-text-secondary">
          ไม่ได้วัดจากขนาดรายได้ — แต่จากจำนวนแผนก งานที่ต้องส่งต่อกัน
          และความต้องการเห็นภาพเดียวกันทั้งองค์กร
        </p>
      </Container>

      {/* Desktop: pinned evolution */}
      <div ref={pinRef} className="relative hidden lg:block lg:h-[250vh]">
        <div className="sticky top-0 flex h-svh items-center">
          <Container className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-12">
            <ol aria-label="ลำดับการเติบโตขององค์กร" className="space-y-1">
              {STAGES.map((s, i) => {
                const on = i === stage;
                return (
                  <li
                    key={s.key}
                    aria-current={on ? 'step' : undefined}
                    className={cn(
                      'border-l py-4 pl-6 transition-[border-color,opacity] duration-500',
                      on ? 'border-brand-glow opacity-100' : 'border-border-soft opacity-45',
                    )}
                  >
                    <p className="text-caption font-semibold tracking-[0.22em] text-brand-glow">
                      {s.key}
                    </p>
                    <h3 className="mt-1 text-h3 text-text-primary">{s.name}</h3>
                    <p className="text-caption tracking-[0.12em] text-text-muted uppercase">
                      {s.en}
                    </p>
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows,opacity] duration-500',
                        on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <p className="overflow-hidden pt-2 text-label text-text-secondary">
                        {s.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <OrgEvolution
              stage={stage}
              reduce={reduce}
              className="mx-auto aspect-square w-full max-w-[min(38rem,72svh)]"
            />
          </Container>
        </div>
      </div>

      {/* Phones / tablets: stacked stages */}
      <Container className="mt-12 lg:hidden">
        <ol aria-label="ลำดับการเติบโตขององค์กร" className="space-y-12">
          {STAGES.map((s, i) => (
            <li key={s.key} className="grid items-center gap-5 sm:grid-cols-[1fr_14rem]">
              <div>
                <p className="text-caption font-semibold tracking-[0.22em] text-brand-glow">
                  {s.key}
                </p>
                <h3 className="mt-1 text-h3 text-text-primary">{s.name}</h3>
                <p className="text-caption tracking-[0.12em] text-text-muted uppercase">{s.en}</p>
                <p className="mt-2 text-label text-text-secondary">{s.body}</p>
              </div>
              <OrgEvolution
                stage={i}
                reduce
                className="mx-auto aspect-square w-full max-w-[14rem] sm:order-last"
              />
            </li>
          ))}
        </ol>
      </Container>

      {/* Fit signals */}
      <Container className="pt-16 pb-24 sm:pb-32 lg:pt-8">
        <div
          id="fit"
          className="grid scroll-mt-28 gap-10 border-t border-border-soft pt-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
        >
          <div>
            <p className="text-caption font-semibold tracking-[0.2em] text-brand-glow uppercase">
              Fit
            </p>
            <h3 className="mt-3 text-h2 text-text-primary">CORE เหมาะกับองค์กรของคุณ ถ้า…</h3>
            <p className="mt-3 text-label text-text-muted">
              ไม่จำเป็นต้องเป็นองค์กรใหญ่ — ถ้ามีหลายข้อด้านขวา CORE ถูกออกแบบมาเพื่อคุณ
            </p>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {SIGNALS.map((s, i) => (
              <li key={s} className="flex items-start gap-4 border-b border-border-soft py-4">
                <span className="mt-0.5 text-caption text-text-muted tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-label text-text-primary">{s}</span>
                <Check className="mt-1 size-4 shrink-0 text-brand-glow" aria-hidden />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

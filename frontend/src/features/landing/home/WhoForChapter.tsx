import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useId, useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { useScrollStage } from './useScrollStage';

/* ------------------------------------------------------------------------ */
/* Story                                                                     */
/* ------------------------------------------------------------------------ */

const STAGE_KEYS = ['TEAM', 'DEPARTMENTS', 'CONNECTED OPERATIONS', 'ORGANIZATION'] as const;

const th = {
  stages: [
    {
      name: 'ธุรกิจที่กำลังเติบโต',
      en: 'Growing Business',
      body: 'ทีมเล็กที่ทำงานใกล้ชิดกัน — แต่เริ่มมีงานที่ต้องส่งต่อ ติดตาม และจดจำมากกว่าที่คนไม่กี่คนจะถือไว้ได้',
    },
    {
      name: 'องค์กรหลายแผนก',
      en: 'Multi-Department Organization',
      body: 'แต่ละแผนกเริ่มมีวิธีทำงาน เอกสาร และไฟล์ของตัวเอง ข้อมูลชุดเดียวกันถูกเก็บไว้หลายที่',
    },
    {
      name: 'ธุรกิจที่งานเดินผ่านหลายมือ',
      en: 'Operational Business',
      body: 'งานหนึ่งชิ้นผ่านหลายแผนก มีการอนุมัติ กำหนดเวลา และการส่งต่อ ที่ต้องไม่หลุดระหว่างทาง',
    },
    {
      name: 'องค์กรที่ต้องการมาตรฐานและภาพรวม',
      en: 'Enterprise Organization',
      body: 'ผู้บริหารต้องเห็นภาพเดียวกันทั้งองค์กร และต้องมีมาตรฐาน — โดยไม่ทำให้แต่ละแผนกทำงานช้าลง',
    },
  ],
  signals: [
    'กำลังเติบโต และงานเริ่มซับซ้อนขึ้นทุกไตรมาส',
    'มีหลายแผนกที่ต้องทำงานต่อกัน',
    'งานหนึ่งชิ้นถูกส่งต่อระหว่างทีม',
    'มีขั้นตอนอนุมัติก่อนดำเนินการ',
    'ผู้บริหารต้องการเห็นสถานะโดยไม่ต้องถามทีละคน',
    'ต้องการมาตรฐานการทำงานที่ทุกคนใช้ร่วมกัน',
    'ความผิดพลาดเล็ก ๆ เริ่มมีต้นทุนสูงขึ้น',
  ],
  hubs: ['ฝ่ายขาย', 'ปฏิบัติการ', 'คลังสินค้า', 'จัดซื้อ · บัญชี'],
  executive: 'ผู้บริหาร',
  titleA: 'CORE ถูกสร้างขึ้นสำหรับองค์กร',
  titleB: 'ที่งานเริ่มเดินผ่านหลายแผนก',
  lead: 'ไม่ได้วัดจากขนาดรายได้ — แต่จากจำนวนแผนก งานที่ต้องส่งต่อกัน และความต้องการเห็นภาพเดียวกันทั้งองค์กร',
  stagesLabel: 'ลำดับการเติบโตขององค์กร',
  fitTitle: 'CORE เหมาะกับองค์กรของคุณ ถ้า…',
  fitNote: 'ไม่จำเป็นต้องเป็นองค์กรใหญ่ — ถ้ามีหลายข้อด้านขวา CORE ถูกออกแบบมาเพื่อคุณ',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    stages: [
      {
        name: 'A growing business',
        en: 'Growing Business',
        body: 'A small team working closely together — but there is starting to be more to hand over, track and remember than a few people can hold.',
      },
      {
        name: 'A multi-department organization',
        en: 'Multi-Department Organization',
        body: 'Each department develops its own ways of working, documents and files. The same data ends up stored in many places.',
      },
      {
        name: 'Work that passes through many hands',
        en: 'Operational Business',
        body: 'One piece of work moves through several departments, with approvals, deadlines and handoffs that must not slip along the way.',
      },
      {
        name: 'An organization that needs standards and one picture',
        en: 'Enterprise Organization',
        body: 'Leaders need the same picture across the whole organization, and shared standards — without slowing any department down.',
      },
    ],
    signals: [
      'You are growing, and work gets more complex every quarter',
      'Several departments need to work in sequence',
      'One piece of work is handed between teams',
      'Approvals are needed before work goes ahead',
      'Leaders want status without asking people one by one',
      'You want standard ways of working that everyone shares',
      'Small mistakes are starting to cost more',
    ],
    hubs: ['Sales', 'Operations', 'Warehouse', 'Purchasing · Accounting'],
    executive: 'Executive',
    titleA: 'CORE is built for organizations',
    titleB: 'where work now runs through many departments',
    lead: 'It is not about revenue — it is about how many departments you have, how much work they hand to each other, and the need for one shared picture.',
    stagesLabel: 'How an organization grows',
    fitTitle: 'CORE fits your organization if…',
    fitNote: 'You don’t need to be large — if several of these apply, CORE was designed for you.',
  },
  'zh-CN': {
    stages: [
      {
        name: '成长中的企业',
        en: 'Growing Business',
        body: '小团队紧密协作——但需要交接、跟踪和记住的事情，开始超出少数人能承担的范围。',
      },
      {
        name: '多部门组织',
        en: 'Multi-Department Organization',
        body: '各部门逐渐形成自己的工作方式、单据和文件，同一份数据被存放在多个地方。',
      },
      {
        name: '工作经过多人之手的企业',
        en: 'Operational Business',
        body: '一项工作要经过多个部门，涉及审批、时限与交接，途中不能有任何遗漏。',
      },
      {
        name: '需要标准与全局视图的组织',
        en: 'Enterprise Organization',
        body: '管理层需要看到全公司一致的画面，也需要统一的标准——同时不拖慢任何部门。',
      },
    ],
    signals: [
      '企业在成长，工作每个季度都更复杂',
      '多个部门需要前后衔接地工作',
      '一项工作会在团队之间交接',
      '执行前需要经过审批',
      '管理层希望不必逐个询问就能掌握状态',
      '需要所有人共同遵循的工作标准',
      '小错误的代价开始越来越高',
    ],
    hubs: ['销售部', '运营部', '仓库', '采购 · 财务'],
    executive: '管理层',
    titleA: 'CORE 专为这样的企业打造',
    titleB: '工作开始流经多个部门',
    lead: '衡量标准不是营收规模，而是部门数量、需要相互交接的工作，以及对全公司统一视图的需求。',
    stagesLabel: '企业的成长阶段',
    fitTitle: '如果符合以下情况，CORE 适合贵公司……',
    fitNote: '不一定是大企业——只要符合右侧多项，CORE 就是为您设计的。',
  },
};

/* ------------------------------------------------------------------------ */
/* Organization evolution (SVG, 600×600)                                     */
/* ------------------------------------------------------------------------ */

const C = 300;
const HUBS = [
  { x: 170, y: 200 },
  { x: 430, y: 200 },
  { x: 430, y: 410 },
  { x: 170, y: 410 },
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
  // EP19: unique per instance — the scene renders twice (desktop / phone), and a duplicate
  // id can resolve to the hidden copy, which some browsers do not paint.
  const glowId = useId();
  const c = useCopy(COPY);
  const t = { duration: reduce ? 0 : 0.9, ease: EASE_CORE };
  const showHubs = stage >= 1;
  const linked = stage >= 2;
  const org = stage >= 3;
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      <defs>
        <radialGradient id={glowId}>
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
          {c.executive}
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
            {c.hubs[i]}
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
        <circle cx={C} cy={C} r={70} fill={`url(#${glowId})`} />
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
  const { stage, reduce } = useScrollStage(pinRef, STAGE_KEYS.length);
  const c = useCopy(COPY);
  const stages = STAGE_KEYS.map((key, i) => ({ key, ...c.stages[i]! }));

  return (
    <section id="who-for" aria-labelledby="who-for-title" className="relative overflow-x-clip">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_70%_20%,rgb(25_195_154/0.07),transparent_70%),linear-gradient(180deg,#050b12,#06101a_50%,#050b12)]"
      />
      <Container className="pt-20 sm:pt-28">
        <ChapterMark id="who-for" />
        <h2 id="who-for-title" className="mt-6 max-w-3xl text-h1 text-text-primary">
          {c.titleA}
          <span className="block text-text-secondary">{c.titleB}</span>
        </h2>
        <p className="mt-5 max-w-xl text-body-lg text-text-secondary">{c.lead}</p>
      </Container>

      {/* Desktop: pinned evolution */}
      <div ref={pinRef} className="relative hidden lg:block lg:h-[250vh]">
        <div className="sticky top-0 flex h-svh items-center">
          <Container className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-12">
            <ol aria-label={c.stagesLabel} className="space-y-1">
              {stages.map((s, i) => {
                const on = i === stage;
                return (
                  <li
                    key={s.key}
                    aria-current={on ? 'step' : undefined}
                    className={cn(
                      'border-l py-4 pl-6 transition-colors duration-500',
                      // EP19: inactive stages are quieter by colour, not faded below AA contrast.
                      on ? 'border-brand-glow' : 'border-border-soft',
                    )}
                  >
                    <p
                      className={cn(
                        'text-caption font-semibold tracking-[0.22em] transition-colors duration-500',
                        on ? 'text-brand-glow' : 'text-text-muted',
                      )}
                    >
                      {s.key}
                    </p>
                    <h3
                      className={cn(
                        'mt-1 text-h3 transition-colors duration-500',
                        on ? 'text-text-primary' : 'text-text-secondary',
                      )}
                    >
                      {s.name}
                    </h3>
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
        <ol aria-label={c.stagesLabel} className="space-y-12">
          {stages.map((s, i) => (
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
            <h3 className="mt-3 text-h2 text-text-primary">{c.fitTitle}</h3>
            <p className="mt-3 text-label text-text-muted">{c.fitNote}</p>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {c.signals.map((s, i) => (
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

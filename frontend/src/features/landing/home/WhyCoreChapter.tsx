import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { useScrollStage } from './useScrollStage';

const WORKSPACES = ['ฝ่ายขาย', 'ปฏิบัติการ', 'คลังสินค้า', 'ผู้บริหาร', 'บัญชี', 'จัดซื้อ'];

/* Geometry (viewBox 800×520). A: one system, sliced into stacked menus. B: six workspaces around CORE. */
const A = WORKSPACES.map((_, i) => ({ x: 230, y: 50 + i * 70, w: 340, h: 70 }));
const B = [-90, -30, 30, 90, 150, 210].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const cx = 400 + Math.cos(a) * 240;
  const cy = 260 + Math.sin(a) * 196;
  return { x: cx - 88, y: cy - 38, w: 176, h: 76, cx, cy };
});
const USERS_A = WORKSPACES.map((_, i) => ({ x: i % 2 ? 690 : 110, y: 95 + i * 62 }));

/** One slice of the system, morphing from monolith (A) to workspace (B) with scroll. */
function Slice({ i, t }: { i: number; t: MotionValue<number> }) {
  const a = A[i]!;
  const b = B[i]!;
  const range = [0.2, 0.75];
  const x = useTransform(t, range, [a.x, b.x]);
  const y = useTransform(t, range, [a.y, b.y]);
  const w = useTransform(t, range, [a.w, b.w]);
  const h = useTransform(t, range, [a.h, b.h]);
  return (
    <motion.rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={10}
      fill="#0c1822"
      stroke="#2bb5a8"
      strokeOpacity="0.45"
    />
  );
}

function Philosophy({ t, state }: { t: MotionValue<number> | null; state: 'A' | 'B' }) {
  return (
    <svg viewBox="0 0 800 520" className="w-full" aria-hidden>
      <defs>
        <radialGradient id="why-core-glow">
          <stop offset="0%" stopColor="#3ef0c0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#19c39a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {t ? <MorphLayers t={t} /> : <StaticLayers state={state} />}
    </svg>
  );
}

function MorphLayers({ t }: { t: MotionValue<number> }) {
  const aFade = useTransform(t, [0.15, 0.4], [1, 0]);
  const bFade = useTransform(t, [0.55, 0.8], [0, 1]);
  return (
    <>
      <motion.g style={{ opacity: bFade }}>
        <circle cx={400} cy={260} r={120} fill="url(#why-core-glow)" />
        {B.map((b, i) => (
          <line
            key={i}
            x1={400}
            y1={260}
            x2={b.cx}
            y2={b.cy}
            stroke="#3ef0c0"
            strokeOpacity="0.35"
          />
        ))}
      </motion.g>
      {WORKSPACES.map((_, i) => (
        <Slice key={i} i={i} t={t} />
      ))}
      <motion.g style={{ opacity: aFade }}>
        <MenuRows />
        <UsersSearching />
      </motion.g>
      <motion.g style={{ opacity: bFade }}>
        <WorkspaceLabels />
        <circle cx={400} cy={260} r={44} fill="#0a1620" stroke="#3ef0c0" strokeWidth="1.5" />
        <text x={400} y={266} textAnchor="middle" fill="#3ef0c0" fontSize="16" letterSpacing="4">
          CORE
        </text>
      </motion.g>
    </>
  );
}

function StaticLayers({ state }: { state: 'A' | 'B' }) {
  const geo = state === 'A' ? A : B;
  return (
    <>
      {state === 'B' && (
        <>
          <circle cx={400} cy={260} r={120} fill="url(#why-core-glow)" />
          {B.map((b, i) => (
            <line
              key={i}
              x1={400}
              y1={260}
              x2={b.cx}
              y2={b.cy}
              stroke="#3ef0c0"
              strokeOpacity="0.35"
            />
          ))}
        </>
      )}
      {geo.map((g, i) => (
        <rect
          key={i}
          x={g.x}
          y={g.y}
          width={g.w}
          height={g.h}
          rx={10}
          fill="#0c1822"
          stroke="#2bb5a8"
          strokeOpacity="0.45"
        />
      ))}
      {state === 'A' ? (
        <>
          <MenuRows />
          <UsersSearching />
        </>
      ) : (
        <>
          <WorkspaceLabels />
          <circle cx={400} cy={260} r={44} fill="#0a1620" stroke="#3ef0c0" strokeWidth="1.5" />
          <text x={400} y={266} textAnchor="middle" fill="#3ef0c0" fontSize="16" letterSpacing="4">
            CORE
          </text>
        </>
      )}
    </>
  );
}

function MenuRows() {
  return (
    <g>
      {A.map((a, i) => (
        <g key={i}>
          {[0, 1, 2].map((k) => (
            <rect
              key={k}
              x={a.x + 20 + k * 104}
              y={a.y + 28}
              width={84 - k * 14}
              height={12}
              rx={3}
              fill="#a3b8b2"
              fillOpacity="0.14"
            />
          ))}
        </g>
      ))}
      <text x={400} y={34} textAnchor="middle" fill="#758c86" fontSize="15">
        ระบบเดียว · เมนูรวมทุกแผนก
      </text>
    </g>
  );
}

function UsersSearching() {
  return (
    <g>
      {USERS_A.map((u, i) => {
        const a = A[i]!;
        const tx = u.x < 400 ? a.x + 10 : a.x + a.w - 10;
        const ty = a.y + 35;
        const mid = u.x < 400 ? 170 : 630;
        return (
          <g key={i}>
            <path
              d={`M ${u.x} ${u.y} C ${mid} ${u.y + 40}, ${mid} ${ty - 40}, ${tx} ${ty}`}
              fill="none"
              stroke="#a3b8b2"
              strokeOpacity="0.35"
              strokeDasharray="3 5"
            />
            <circle cx={u.x} cy={u.y} r={7} fill="#e8fff7" fillOpacity="0.85" />
          </g>
        );
      })}
    </g>
  );
}

function WorkspaceLabels() {
  return (
    <g>
      {B.map((b, i) => (
        <g key={i}>
          <circle cx={b.x + 20} cy={b.y + 38} r={6} fill="#e8fff7" />
          <text x={b.x + 34} y={b.y + 43} fill="#eef6f3" fontSize="16">
            {WORKSPACES[i]}
          </text>
        </g>
      ))}
    </g>
  );
}

const STATEMENTS = [
  { text: 'CORE ไม่ได้เริ่มจากคำถามว่า', strong: 'องค์กรต้องมีเมนูอะไรบ้าง', tone: 'muted' },
  { text: 'แต่เริ่มจากคำถามว่า', strong: 'แต่ละแผนกต้องทำงานอย่างไรให้ดีที่สุด', tone: 'brand' },
  { text: 'โดยที่ทุกแผนก', strong: 'ยังทำงานอยู่บนข้อมูลชุดเดียวกัน', tone: 'plain' },
] as const;

/**
 * Chapter 04 — why CORE exists. Editorial statements, then (desktop, pinned)
 * one large system visibly re-forms into six workspaces connected through
 * CORE. A different starting point — not a judgement of other systems.
 */
export function WhyCoreChapter() {
  const pinRef = useRef<HTMLDivElement>(null);
  const { progress, stage, reduce } = useScrollStage(pinRef, 2);
  const showCore = stage === 1;

  return (
    <section id="why-core" aria-labelledby="why-core-title" className="relative overflow-x-clip">
      {/* Deep black with a single spotlight: the most editorial chapter. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_35%_at_50%_8%,rgb(185_245_228/0.06),transparent_70%),linear-gradient(180deg,#050b12,#03070b_30%,#03070b_70%,#050b12)]"
      />
      <Container className="pt-24 sm:pt-32">
        <ChapterMark id="why-core" align="center" />
        <h2 id="why-core-title" className="sr-only">
          แนวคิดของ CORE: เริ่มจากวิธีทำงานของแต่ละแผนก บนข้อมูลชุดเดียวกัน
        </h2>
        <div className="mx-auto mt-14 max-w-4xl space-y-14 text-center sm:space-y-20">
          {STATEMENTS.map((s, i) => (
            <motion.p
              key={s.strong}
              initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(6px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '0px 0px -18% 0px' }}
              transition={{ duration: 1, ease: EASE_CORE, delay: i * 0.05 }}
              className="text-h2 leading-[1.35]"
            >
              <span className="block text-body-lg text-text-muted sm:text-h3">{s.text}</span>
              <span
                className={cn(
                  'mt-2 block text-[clamp(1.875rem,1.2rem+3vw,3.75rem)] leading-[1.3] font-semibold',
                  s.tone === 'muted' && 'text-text-muted',
                  s.tone === 'brand' && 'text-gradient-brand',
                  s.tone === 'plain' && 'text-text-primary',
                )}
              >
                {s.strong}
              </span>
            </motion.p>
          ))}
        </div>
      </Container>

      {/* Desktop: the philosophy re-forms with scroll */}
      <div ref={pinRef} className="relative mt-16 hidden lg:block lg:h-[230vh]">
        <div className="sticky top-0 flex h-svh items-center">
          <Container className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] items-center gap-12">
            <div className="relative min-h-56">
              {[
                {
                  on: !showCore,
                  k: 'ONE LARGE SYSTEM',
                  t: 'ระบบแบบรวมศูนย์',
                  b: 'ทุกคนเข้าระบบเดียวกัน แล้วค้นหาเมนูของงานตัวเองจากโครงสร้างที่ออกแบบให้ทั้งองค์กร',
                },
                {
                  on: showCore,
                  k: 'CORE',
                  t: 'พื้นที่ทำงานของแต่ละแผนก เชื่อมกันผ่าน CORE',
                  b: 'แต่ละคนเริ่มจากงานของแผนกตัวเอง ขณะที่ข้อมูลและขั้นตอนทั้งหมดยังเป็นชุดเดียวกันทั้งองค์กร',
                },
              ].map((p) => (
                <div
                  key={p.k}
                  aria-hidden={!p.on}
                  className={cn(
                    'absolute inset-0 transition-[opacity,transform] duration-700',
                    p.on
                      ? 'translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-3 opacity-0',
                  )}
                >
                  <p className="text-caption font-semibold tracking-[0.22em] text-brand-glow">
                    {p.k}
                  </p>
                  <h3 className="mt-3 text-h2 text-text-primary">{p.t}</h3>
                  <p className="mt-4 text-body-lg text-text-secondary">{p.b}</p>
                </div>
              ))}
            </div>
            <Philosophy t={reduce ? null : progress} state={showCore || reduce ? 'B' : 'A'} />
          </Container>
        </div>
      </div>

      {/* Phones / tablets: both philosophies, side by side in time */}
      <Container className="mt-14 pb-24 lg:hidden">
        <div className="grid gap-10 sm:grid-cols-2">
          <figure>
            <Philosophy t={null} state="A" />
            <figcaption className="mt-3">
              <span className="block text-caption font-semibold tracking-[0.2em] text-text-muted">
                ONE LARGE SYSTEM
              </span>
              <span className="text-label text-text-secondary">
                ทุกคนเข้าระบบเดียวกัน แล้วค้นหาเมนูของงานตัวเอง
              </span>
            </figcaption>
          </figure>
          <figure>
            <Philosophy t={null} state="B" />
            <figcaption className="mt-3">
              <span className="block text-caption font-semibold tracking-[0.2em] text-brand-glow">
                CORE
              </span>
              <span className="text-label text-text-secondary">
                ทุกแผนกเริ่มจากพื้นที่ทำงานของตัวเอง เชื่อมกันผ่าน CORE
              </span>
            </figcaption>
          </figure>
        </div>
      </Container>
      <div className="hidden h-24 lg:block" />
    </section>
  );
}

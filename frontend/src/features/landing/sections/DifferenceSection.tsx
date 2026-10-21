import { Building2, CheckCircle2, Orbit } from 'lucide-react';
import { Container, SectionHeader } from '@/components/ui/Section';
import { Reveal, RevealItem } from '@/motion/Reveal';

const PILLARS = [
  { en: 'Department-centric', th: 'ออกแบบจากหน้างานของแต่ละแผนก' },
  { en: 'Role-centric', th: 'เห็นเฉพาะสิ่งที่บทบาทของคุณต้องใช้' },
  { en: 'Task-centric', th: 'เปิดมาแล้วรู้ทันทีว่าต้องทำอะไรต่อ' },
  { en: 'Workflow-centric', th: 'งานเดินตามขั้นตอนที่ควบคุมได้' },
];

function CompanyDiagram() {
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" aria-hidden>
      <rect
        x="40"
        y="18"
        width="160"
        height="114"
        rx="14"
        fill="var(--color-surface-overlay)"
        stroke="var(--color-border-strong)"
      />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={56 + c * 46}
            y={36 + r * 30}
            width="38"
            height="22"
            rx="5"
            fill="var(--color-surface-highlight)"
            opacity={0.55 + ((r + c) % 3) * 0.15}
          />
        )),
      )}
    </svg>
  );
}

function CoreDiagram() {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return { x: 120 + 82 * Math.cos(a), y: 75 + 54 * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" aria-hidden>
      {pts.map((p, i) => (
        <line
          key={`l${i}`}
          x1={p.x}
          y1={p.y}
          x2="120"
          y2="75"
          stroke="var(--color-brand-primary)"
          strokeOpacity="0.45"
        />
      ))}
      <circle
        cx="120"
        cy="75"
        r="20"
        fill="var(--color-brand-deep)"
        stroke="var(--color-brand-glow)"
        strokeWidth="1.5"
      />
      <circle
        cx="120"
        cy="75"
        r="30"
        fill="none"
        stroke="var(--color-brand-glow)"
        strokeOpacity="0.2"
      />
      {pts.map((p, i) => (
        <rect
          key={`n${i}`}
          x={p.x - 19}
          y={p.y - 12}
          width="38"
          height="24"
          rx="7"
          fill="var(--color-surface-overlay)"
          stroke="var(--color-border-brand)"
        />
      ))}
    </svg>
  );
}

export function DifferenceSection() {
  return (
    <section aria-labelledby="difference-title" className="relative py-24 sm:py-32">
      <Container>
        <SectionHeader
          id="difference-title"
          eyebrow="What makes CORE different"
          title={
            <>
              สองผลิตภัณฑ์ <span className="text-gradient-brand">สองมุมมองของการทำงาน</span>
            </>
          }
          lead="PDA ONE และ PDA BLISS CORE ถูกออกแบบมาเพื่อโจทย์ที่ต่างกัน — หนึ่งมองจากภาพรวมของบริษัท อีกหนึ่งมองจากหน้างานของแต่ละแผนก"
        />

        <Reveal stagger className="mt-14 grid gap-5 lg:grid-cols-2">
          <RevealItem className="rounded-card border border-border-soft bg-surface-base/70 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-surface-overlay">
                <Building2 className="size-5 text-text-secondary" aria-hidden />
              </span>
              <div>
                <p className="text-h3 text-text-primary">PDA ONE</p>
                <p className="text-caption text-text-muted">Company management</p>
              </div>
            </div>
            <div className="mx-auto mt-6 max-w-xs opacity-90">
              <CompanyDiagram />
            </div>
            <p className="mt-6 text-body text-text-secondary">
              ระบบบริหารจัดการธุรกิจที่มองจากมุมของบริษัท
              ครอบคลุมงานหลายด้านภายในองค์กรไว้ในที่เดียว
              เหมาะกับการบริหารภาพรวมของบริษัทและงานบัญชี
            </p>
          </RevealItem>

          <RevealItem className="relative overflow-hidden rounded-card border border-border-brand bg-gradient-to-b from-brand-deep/25 to-surface-base p-6 shadow-glow-md sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.28),transparent_70%)]"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-primary/15">
                <Orbit className="size-5 text-brand-glow" aria-hidden />
              </span>
              <div>
                <p className="text-h3 text-text-primary">PDA BLISS CORE</p>
                <p className="text-caption text-brand-soft">Department operations</p>
              </div>
            </div>
            <div className="relative mx-auto mt-6 max-w-xs">
              <CoreDiagram />
            </div>
            <p className="relative mt-6 text-body text-text-secondary">
              แพลตฟอร์มปฏิบัติการที่มองจากหน้างานของแต่ละแผนก
              ทุกคนเข้าสู่พื้นที่ทำงานของงานตัวเองโดยตรง
              และทุกแผนกเชื่อมกันผ่านเวิร์กโฟลว์และข้อมูลชุดเดียว
            </p>
          </RevealItem>
        </Reveal>

        <Reveal stagger className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <RevealItem
              key={p.en}
              className="flex gap-3 rounded-2xl border border-border-soft bg-surface-raised/40 p-5"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-glow" aria-hidden />
              <div>
                <p className="text-label font-semibold text-text-primary">{p.en}</p>
                <p className="mt-1 text-label text-text-secondary">{p.th}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

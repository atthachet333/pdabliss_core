import { ArrowUpRight, EyeOff, FileText, Target } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PageHero } from '@/components/layout/PageHero';
import { LinkButton } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { DEPARTMENTS } from '@/config/departments';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal } from '@/motion/Reveal';

export default function DepartmentsPage() {
  usePageMeta('แผนก', 'พื้นที่ทำงานเฉพาะของฝ่ายขาย คลังสินค้า จัดซื้อ ปฏิบัติการ บัญชี รายงาน และผู้บริหาร ใน PDA BLISS CORE');
  const { hash } = useLocation();

  // Support deep links from the CORE Universe nodes (/departments#warehouse).
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <>
      <PageHero
        eyebrow="Departments"
        title="ทุกแผนกเข้าสู่ระบบปฏิบัติการของงานตัวเอง"
        lead="แต่ละพื้นที่ทำงานมีเมนู ตัวชี้วัด และขอบเขตข้อมูลของตัวเอง — แต่ทุกแผนกอ่านและเขียนข้อมูลชุดเดียวกันผ่าน CORE"
      />
      <Container className="space-y-6 pb-24">
        {DEPARTMENTS.map((dept, i) => {
          const Icon = dept.icon;
          return (
            <Reveal key={dept.id}>
              <article
                id={dept.id}
                aria-labelledby={`${dept.id}-title`}
                className="grid scroll-mt-28 gap-8 rounded-card border border-border-soft bg-surface-base/80 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]"
              >
                <div>
                  <div className="flex items-center gap-4">
                    <span className="flex size-14 items-center justify-center rounded-2xl border border-border-brand bg-brand-primary/10">
                      <Icon className="size-6 text-brand-glow" aria-hidden />
                    </span>
                    <div>
                      <p className="text-caption text-text-muted tabular">0{i + 1} · {dept.nameEn}</p>
                      <h2 id={`${dept.id}-title`} className="text-h2 text-text-primary">
                        {dept.nameTh}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-5 text-body-lg text-text-secondary">{dept.purpose}</p>
                  {dept.workspace && (
                    <div className="mt-6">
                      <LinkButton to={dept.workspace} variant="secondary">
                        เปิดพื้นที่ทำงานเดโม
                        <ArrowUpRight className="size-4" aria-hidden />
                      </LinkButton>
                    </div>
                  )}
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border-soft bg-surface-raised/50 p-5">
                    <dt className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <Target className="size-4 text-brand-glow" aria-hidden />
                      สิ่งที่เห็นเป็นอันดับแรก
                    </dt>
                    <dd className="mt-3">
                      <ul className="space-y-1.5 text-label text-text-secondary">
                        {dept.focus.map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-border-soft bg-surface-raised/50 p-5">
                    <dt className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <FileText className="size-4 text-brand-glow" aria-hidden />
                      เอกสารที่เกี่ยวข้อง
                    </dt>
                    <dd className="mt-3 flex flex-wrap gap-1.5">
                      {dept.documents.map((d) => (
                        <span key={d} className="rounded-md border border-border-soft bg-surface-overlay px-2 py-0.5 text-caption text-text-secondary">
                          {d}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-border-soft bg-surface-raised/50 p-5 sm:col-span-2">
                    <dt className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <EyeOff className="size-4 text-brand-glow" aria-hidden />
                      ขอบเขตการมองเห็นข้อมูล
                    </dt>
                    <dd className="mt-2 text-label text-text-secondary">{dept.visibility}</dd>
                  </div>
                </dl>
              </article>
            </Reveal>
          );
        })}
      </Container>
    </>
  );
}

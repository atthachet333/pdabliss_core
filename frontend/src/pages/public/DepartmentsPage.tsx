import { ArrowUpRight, EyeOff, FileText, Target } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PageHero } from '@/components/layout/PageHero';
import { LinkButton } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { useDepartments } from '@/config/departments';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal } from '@/motion/Reveal';

const th = {
  metaTitle: 'แผนก',
  metaDescription:
    'พื้นที่ทำงานเฉพาะของฝ่ายขาย คลังสินค้า จัดซื้อ ปฏิบัติการ บัญชี รายงาน และผู้บริหาร ใน PDA BLISS CORE',
  title: 'ทุกแผนกเข้าสู่ระบบปฏิบัติการของงานตัวเอง',
  lead: 'แต่ละพื้นที่ทำงานมีเมนู ตัวชี้วัด และขอบเขตข้อมูลของตัวเอง — แต่ทุกแผนกอ่านและเขียนข้อมูลชุดเดียวกันผ่าน CORE',
  demo: 'เปิดพื้นที่ทำงานเดโม',
  focus: 'สิ่งที่เห็นเป็นอันดับแรก',
  documents: 'เอกสารที่เกี่ยวข้อง',
  visibility: 'ขอบเขตการมองเห็นข้อมูล',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    metaTitle: 'Departments',
    metaDescription:
      'Dedicated workspaces for Sales, Warehouse, Purchasing, Operations, Accounting, Reports and Executives in PDA BLISS CORE.',
    title: 'Every department enters an operating system built for its own work',
    lead: 'Each workspace has its own menus, indicators and data scope — yet every department reads and writes the same data through CORE.',
    demo: 'Open the demo workspace',
    focus: 'What they see first',
    documents: 'Related documents',
    visibility: 'Data visibility',
  },
  'zh-CN': {
    metaTitle: '部门',
    metaDescription: 'PDA BLISS CORE 为销售、仓库、采购、运营、财务、报表与管理层提供专属工作空间。',
    title: '每个部门都进入为自身工作打造的运营系统',
    lead: '每个工作空间都有自己的菜单、指标与数据范围——而所有部门都通过 CORE 读写同一套数据。',
    demo: '打开演示工作空间',
    focus: '首先看到的内容',
    documents: '相关单据',
    visibility: '数据可见范围',
  },
};

export default function DepartmentsPage() {
  const c = useCopy(COPY);
  const departments = useDepartments();
  const { locale } = useLocale();
  usePageMeta(c.metaTitle, c.metaDescription);
  const { hash } = useLocation();

  // Support deep links from the CORE Universe nodes (/departments#warehouse).
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <>
      <PageHero eyebrow="Departments" title={c.title} lead={c.lead} />
      <Container className="space-y-6 pb-24">
        {departments.map((dept, i) => {
          const Icon = dept.icon;
          return (
            <Reveal key={dept.id}>
              <article
                id={dept.id}
                aria-labelledby={`${dept.id}-title`}
                className="grid scroll-mt-28 gap-8 rounded-card border border-border-soft bg-surface-base/80 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]"
              >
                <div>
                  {/* Department scene — decorative; the text carries the meaning. */}
                  <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-2xl border border-border-soft bg-surface-dark">
                    <img
                      src={dept.image.lg}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={960}
                      height={540}
                      className="size-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-base/70 via-transparent to-transparent" />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex size-14 items-center justify-center rounded-2xl border border-border-brand bg-brand-primary/10">
                      <Icon className="size-6 text-brand-glow" aria-hidden />
                    </span>
                    <div>
                      <p className="text-caption text-text-muted tabular">
                        0{i + 1}
                        {locale !== 'en' && ` · ${dept.nameEn}`}
                      </p>
                      <h2 id={`${dept.id}-title`} className="text-h2 text-text-primary">
                        {dept.name}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-5 text-body-lg text-text-secondary">{dept.purpose}</p>
                  {dept.workspace && (
                    <div className="mt-6">
                      <LinkButton to={dept.workspace} variant="secondary">
                        {c.demo}
                        <ArrowUpRight className="size-4" aria-hidden />
                      </LinkButton>
                    </div>
                  )}
                </div>
                <dl className="grid content-start gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border-soft bg-surface-raised/50 p-5">
                    <dt className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <Target className="size-4 text-brand-glow" aria-hidden />
                      {c.focus}
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
                      {c.documents}
                    </dt>
                    <dd className="mt-3 flex flex-wrap gap-1.5">
                      {dept.documents.map((d) => (
                        <span
                          key={d}
                          className="rounded-md border border-border-soft bg-surface-overlay px-2 py-0.5 text-caption text-text-secondary"
                        >
                          {d}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-border-soft bg-surface-raised/50 p-5 sm:col-span-2">
                    <dt className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <EyeOff className="size-4 text-brand-glow" aria-hidden />
                      {c.visibility}
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

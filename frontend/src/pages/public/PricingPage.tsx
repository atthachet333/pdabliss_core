import { PageHero } from '@/components/layout/PageHero';
import { Badge, Container } from '@/components/ui/Section';
import { usePlans } from '@/features/landing/plans';
import { PlansGrid } from '@/features/landing/sections/PlansGrid';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

const th = {
  metaTitle: 'ราคา',
  metaDescription:
    'โครงสร้างแพ็กเกจตัวอย่างของ PDA BLISS CORE — ทุกแพ็กเกจสำหรับหนึ่งบริษัทต่อหนึ่งพื้นที่ทำงาน',
  title: 'แพ็กเกจสำหรับหนึ่งบริษัท ในหนึ่งพื้นที่ทำงาน CORE',
  lead: 'เลือกตามจำนวนผู้ใช้ แผนกที่ต้องการเปิดใช้ และระดับการควบคุมเวิร์กโฟลว์',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    metaTitle: 'Pricing',
    metaDescription:
      'Sample package structure for PDA BLISS CORE — every package covers one company in one workspace.',
    title: 'Packages for one company, in one CORE workspace',
    lead: 'Choose by number of users, the departments you want to enable and the level of workflow control.',
  },
  'zh-CN': {
    metaTitle: '价格',
    metaDescription: 'PDA BLISS CORE 方案结构示例——每个方案对应一家公司、一个工作空间。',
    title: '一家公司，一个 CORE 工作空间',
    lead: '按用户数量、需要启用的部门以及工作流管控程度进行选择。',
  },
};

export default function PricingPage() {
  const c = useCopy(COPY);
  const { plans, dimensions, disclaimer, ui } = usePlans();
  usePageMeta(c.metaTitle, c.metaDescription);
  return (
    <>
      <PageHero eyebrow="Pricing" title={c.title} lead={c.lead}>
        <div className="mt-6">
          <Badge tone="warning">
            {disclaimer} — {ui.notRealPrice}
          </Badge>
        </div>
      </PageHero>
      <Container className="pb-16">
        <PlansGrid />
      </Container>
      <Container className="pb-24">
        <h2 className="text-h3 text-text-primary">{ui.compare}</h2>
        <div className="mt-5 overflow-x-auto rounded-card border border-border-soft">
          <table className="w-full min-w-[44rem] text-left text-label">
            <caption className="sr-only">
              {disclaimer}: {ui.compareCaption}
            </caption>
            <thead className="bg-surface-raised">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-medium text-text-muted">
                  {ui.capability}
                </th>
                {plans.map((p) => (
                  <th key={p.id} scope="col" className="px-5 py-3.5 font-semibold text-text-primary">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimensions.map((dim) => (
                <tr key={dim.key} className="border-t border-border-soft">
                  <th scope="row" className="px-5 py-3 font-medium text-text-secondary">
                    {dim.label}
                  </th>
                  {plans.map((p) => (
                    <td key={p.id} className="px-5 py-3 text-text-primary">
                      {p.limits.find((l) => l.key === dim.key)?.value ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  );
}

import { PageHero } from '@/components/layout/PageHero';
import { Badge, Container } from '@/components/ui/Section';
import { PLAN_DIMENSIONS, PLAN_DISCLAIMER, PLANS } from '@/features/landing/plans';
import { PlansGrid } from '@/features/landing/sections/PlansSection';
import { usePageMeta } from '@/lib/usePageMeta';

export default function PricingPage() {
  usePageMeta('ราคา', 'โครงสร้างแพ็กเกจตัวอย่างของ PDA BLISS CORE — ทุกแพ็กเกจสำหรับหนึ่งบริษัทต่อหนึ่งพื้นที่ทำงาน');
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="แพ็กเกจสำหรับหนึ่งบริษัท ในหนึ่งพื้นที่ทำงาน CORE"
        lead="เลือกตามจำนวนผู้ใช้ แผนกที่ต้องการเปิดใช้ และระดับการควบคุมเวิร์กโฟลว์"
      >
        <div className="mt-6">
          <Badge tone="warning">{PLAN_DISCLAIMER} — ยังไม่ใช่ราคาจริง</Badge>
        </div>
      </PageHero>
      <Container className="pb-16">
        <PlansGrid />
      </Container>
      <Container className="pb-24">
        <h2 className="text-h3 text-text-primary">เปรียบเทียบโครงสร้างแพ็กเกจ</h2>
        <div className="mt-5 overflow-x-auto rounded-card border border-border-soft">
          <table className="w-full min-w-[44rem] text-left text-label">
            <caption className="sr-only">{PLAN_DISCLAIMER}: เปรียบเทียบความสามารถของแต่ละแพ็กเกจ</caption>
            <thead className="bg-surface-raised">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-medium text-text-muted">
                  ความสามารถ
                </th>
                {PLANS.map((p) => (
                  <th key={p.id} scope="col" className="px-5 py-3.5 font-semibold text-text-primary">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_DIMENSIONS.map((dim) => (
                <tr key={dim} className="border-t border-border-soft">
                  <th scope="row" className="px-5 py-3 font-medium text-text-secondary">
                    {dim}
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-5 py-3 text-text-primary">
                      {p.limits.find((l) => l.label === dim)?.value ?? '—'}
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

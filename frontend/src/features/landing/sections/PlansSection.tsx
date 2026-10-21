import { Building2, Check } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { Badge, Container, SectionHeader } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { PLAN_DISCLAIMER, PLANS } from '../plans';

export function PlansGrid() {
  return (
    <Reveal stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((plan) => (
        <RevealItem
          key={plan.id}
          className={cn(
            'relative flex flex-col rounded-card border p-6',
            plan.highlight
              ? 'border-border-brand bg-gradient-to-b from-brand-deep/30 to-surface-base shadow-glow-md'
              : 'border-border-soft bg-surface-base/80',
          )}
        >
          {plan.highlight && (
            <span className="absolute -top-3 left-6 rounded-full bg-brand-primary px-3 py-0.5 text-caption font-semibold text-text-inverse">
              เหมาะกับธุรกิจส่วนใหญ่
            </span>
          )}
          <h3 className="text-h3 text-text-primary">{plan.name}</h3>
          <p className="mt-2 min-h-[3.25rem] text-label text-text-secondary">{plan.audience}</p>
          <div className="mt-5 rounded-xl border border-dashed border-border-strong px-4 py-3">
            <p className="text-caption text-text-muted">ราคา</p>
            <p className="mt-0.5 text-label font-medium text-text-primary">อยู่ระหว่างกำหนด</p>
          </div>
          <ul className="mt-5 flex-1 space-y-2.5">
            {plan.limits.map((l) => (
              <li key={l.label} className="flex gap-2.5 text-label">
                <Check
                  className={cn(
                    'mt-1 size-4 shrink-0',
                    l.value === '—' ? 'text-text-muted/40' : 'text-brand-glow',
                  )}
                  aria-hidden
                />
                <span>
                  <span className="text-text-muted">{l.label}: </span>
                  <span className="text-text-primary">{l.value === '—' ? 'ไม่รวม' : l.value}</span>
                </span>
              </li>
            ))}
          </ul>
          <LinkButton
            to="/contact"
            variant={plan.highlight ? 'primary' : 'secondary'}
            className="mt-6 w-full"
          >
            สอบถามแพ็กเกจ
          </LinkButton>
        </RevealItem>
      ))}
    </Reveal>
  );
}

export function PlansSection() {
  return (
    <section aria-labelledby="plans-title" className="relative py-24 sm:py-32">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            id="plans-title"
            eyebrow="Subscription"
            title="แพ็กเกจที่เติบโตไปพร้อมกับองค์กร"
            lead="ทุกแพ็กเกจสำหรับ 1 บริษัทต่อ 1 พื้นที่ทำงาน CORE — แตกต่างกันที่จำนวนผู้ใช้ แผนกที่เปิดใช้ และความสามารถในการควบคุม"
          />
          <div className="flex flex-wrap gap-2">
            <Badge tone="warning">{PLAN_DISCLAIMER}</Badge>
            <Badge tone="neutral">
              <Building2 className="size-3.5" aria-hidden />1 บริษัท / พื้นที่ทำงาน
            </Badge>
          </div>
        </div>
        <div className="mt-12">
          <PlansGrid />
        </div>
        <p className="mt-6 text-caption text-text-muted">
          {PLAN_DISCLAIMER} — รายละเอียด ขีดจำกัด และราคาจริงจะประกาศเมื่อเปิดให้บริการเชิงพาณิชย์
        </p>
      </Container>
    </section>
  );
}

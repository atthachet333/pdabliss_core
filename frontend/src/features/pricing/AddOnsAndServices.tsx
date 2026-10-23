import {
  BookOpen,
  Check,
  DatabaseZap,
  FileText,
  GraduationCap,
  HardDrive,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Map,
  Minus,
  MonitorPlay,
  Plug,
  Plus,
  Presentation,
  Settings2,
  Users,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { PRICING } from './copy';
import { ADDON_AVAILABILITY, ADDON_IDS, PLANS, type AddonId, type Availability } from './plans';
import { SECTION } from './state';

const ADDON_ICON: Record<AddonId, LucideIcon> = {
  department: LayoutGrid,
  users: Users,
  storage: HardDrive,
  api: Plug,
  workflow: Workflow,
  report: FileText,
  dashboard: LayoutDashboard,
  automation: Zap,
  onlineTraining: MonitorPlay,
  onsiteTraining: Presentation,
  implementation: Wrench,
  support: LifeBuoy,
};

const AVAIL_ICON: Record<Availability, LucideIcon> = {
  included: Check,
  addon: Plus,
  scope: Settings2,
  no: Minus,
};

/** Visual add-on cards: what it adds, who needs it, and where it is already included. */
export function AddOns() {
  const c = useCopy(PRICING);
  const a = c.addons;
  return (
    <Section id={SECTION.addons} labelledBy="addons-title" className="scroll-mt-20">
      <SectionHead id="addons-title" eyebrow={a.eyebrow} title={a.title} lead={a.lead} />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADDON_IDS.map((id) => {
          const Icon = ADDON_ICON[id];
          const item = a.items[id];
          return (
            <li
              key={id}
              data-addon-card={id}
              className="flex flex-col rounded-[1.5rem] border border-border-soft bg-surface-base/70 p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border-brand/50 bg-brand-primary/10">
                  <Icon className="size-5 text-brand-glow" aria-hidden />
                </span>
                <h3 className="text-body font-semibold text-text-primary">{item.name}</h3>
              </div>
              <dl className="mt-4 space-y-2 text-label">
                <div>
                  <dt className="text-caption text-text-muted">{a.adds}</dt>
                  <dd className="text-text-secondary">{item.adds}</dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">{a.who}</dt>
                  <dd className="text-text-secondary">{item.who}</dd>
                </div>
              </dl>
              {/* Where it is included, an add-on, or in project scope — grouped, in words. */}
              <ul className="mt-auto space-y-1.5 border-t border-border-soft pt-4 text-caption">
                {(['included', 'addon', 'scope'] as const).map((status) => {
                  const plans = PLANS.filter((p) => ADDON_AVAILABILITY[id][p.id] === status);
                  if (!plans.length) return null;
                  const S = AVAIL_ICON[status];
                  return (
                    <li key={status} data-status={status} className="flex items-start gap-2">
                      <S aria-hidden className="mt-px size-3.5 shrink-0 text-brand-glow" />
                      <span>
                        <span className="text-text-muted">{c.values.availability[status]}: </span>
                        <span className="font-medium text-text-primary">
                          {plans.map((p) => p.name).join(' · ')}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Onboarding services and support levels — CORE does not end at sign-up. */
export function Onboarding() {
  const c = useCopy(PRICING);
  const s = c.services;
  const tiles = [
    {
      icon: DatabaseZap,
      title: s.migration.title,
      body: s.migration.body,
      note: s.migration.note,
      key: 'migration',
    },
    { icon: Settings2, title: s.setup.title, body: s.setup.body, key: 'setup' },
    { icon: BookOpen, title: s.guide.title, body: s.guide.body, key: 'guide' },
    {
      icon: GraduationCap,
      title: s.training.title,
      body: s.training.body,
      chips: s.training.kinds,
      key: 'training',
    },
    {
      icon: Wrench,
      title: s.implementation.title,
      body: s.implementation.body,
      key: 'implementation',
    },
    { icon: Map, title: s.mapping.title, body: s.mapping.body, key: 'mapping' },
  ];
  return (
    <Section id={SECTION.onboarding} labelledBy="onboarding-title" className="scroll-mt-20">
      <SectionHead id="onboarding-title" eyebrow={s.eyebrow} title={s.title} lead={s.lead} />
      <ul className="mt-10 grid gap-px overflow-hidden rounded-[1.75rem] border border-border-soft bg-border-soft sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.key} data-service={t.key} className="bg-surface-base p-6">
            <t.icon className="size-6 text-brand-glow" aria-hidden />
            <h3 className="mt-4 text-body font-semibold text-text-primary">{t.title}</h3>
            <p className="mt-1.5 text-label text-text-secondary">{t.body}</p>
            {t.chips && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {t.chips.map((k) => (
                  <li
                    key={k}
                    className="rounded-full border border-border-soft px-2.5 py-1 text-caption text-text-secondary"
                  >
                    {k}
                  </li>
                ))}
              </ul>
            )}
            {t.note && <p className="mt-3 text-caption text-text-muted">{t.note}</p>}
          </li>
        ))}
      </ul>

      {/* Support levels rise with the package */}
      <div className="mt-10">
        <h3 className="text-body-lg font-semibold text-text-primary">{s.supportTitle}</h3>
        <p className="mt-1 text-label text-text-secondary">{s.supportBase}</p>
        <ol className="mt-5 grid items-end gap-3 sm:grid-cols-4">
          {PLANS.map((p, i) => (
            <li
              key={p.id}
              data-support={p.support}
              style={{ ['--rise' as string]: `${5 + i * 1.5}rem` }}
              className="flex flex-col justify-end rounded-2xl border border-border-soft bg-[linear-gradient(to_top,rgb(25_195_154/0.1),transparent)] p-4 sm:min-h-[var(--rise)]"
            >
              <span className="text-caption text-text-muted">{p.name}</span>
              <span className="mt-0.5 text-label font-medium text-text-primary">
                {c.values.support[p.support]}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

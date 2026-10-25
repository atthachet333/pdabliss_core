import { Check, Minus, Plus, Settings2, Star } from 'lucide-react';
import { useState } from 'react';
import { useMediaQuery } from '@/components/core/hooks';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/ui/Segmented';
import { PRICING, type PricingCopy } from './copy';
import { ADDON_AVAILABILITY, PLANS, type Availability, type PlanFacts, type PlanId } from './plans';
import { SECTION, usePricing } from './state';
import { departmentAllowance, executiveText, storageText, usersText } from './text';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';
import { disclosureItem, disclosureTrigger } from '@/components/ui/overlay';

type Kind = 'yes' | 'no' | 'addon' | 'scope' | 'text';
interface Cell {
  kind: Kind;
  text: string;
}
type RowKey = keyof PricingCopy['compare']['rows'];
type GroupKey = keyof PricingCopy['compare']['groups'];

/** Every comparison cell is derived from plans.ts. */
function buildGroups(
  c: PricingCopy,
): { key: GroupKey; rows: { key: RowKey; cell: (p: PlanFacts) => Cell }[] }[] {
  const v = c.values;
  const text = (t: string): Cell => ({ kind: 'text', text: t });
  const yes = (t = v.included): Cell => ({ kind: 'yes', text: t });
  const avail = (a: Availability): Cell =>
    a === 'included'
      ? yes(v.availability.included)
      : a === 'no'
        ? { kind: 'no', text: v.availability.no }
        : a === 'addon'
          ? { kind: 'addon', text: v.availability.addon }
          : { kind: 'scope', text: v.availability.scope };

  return [
    {
      key: 'organization',
      rows: [
        { key: 'company', cell: () => text(v.company) },
        { key: 'branches', cell: () => yes(v.allBranches) },
        { key: 'users', cell: (p) => text(usersText(p, v)) },
      ],
    },
    {
      key: 'departments',
      rows: [
        { key: 'deptLimit', cell: (p) => text(departmentAllowance(p, v)) },
        {
          key: 'executive',
          cell: (p) =>
            p.executiveAccess
              ? yes(executiveText(p, v))
              : { kind: 'no', text: executiveText(p, v) },
        },
        { key: 'moreDepartments', cell: (p) => avail(ADDON_AVAILABILITY.department[p.id]) },
      ],
    },
    {
      key: 'workflow',
      rows: [
        { key: 'workflow', cell: (p) => text(v.workflow[p.workflow]) },
        { key: 'approval', cell: (p) => text(v.approval[p.approval]) },
        { key: 'automation', cell: (p) => avail(p.automation) },
        { key: 'customRoles', cell: (p) => avail(p.customRoles) },
        {
          key: 'audit',
          cell: (p) =>
            p.audit === 'none' ? { kind: 'no', text: v.audit.none } : yes(v.audit[p.audit]),
        },
        { key: 'notifications', cell: (p) => text(v.notifications[p.notifications]) },
      ],
    },
    {
      key: 'warehouse',
      rows: [
        // Core warehouse controls follow Warehouse access in every package.
        { key: 'warehouseCore', cell: () => yes(v.whenWarehouse) },
        { key: 'warehouseRules', cell: (p) => avail(p.automation) },
      ],
    },
    {
      key: 'reporting',
      rows: [
        { key: 'reports', cell: (p) => text(v.reports[p.reports]) },
        { key: 'customReports', cell: (p) => avail(p.customReports) },
        { key: 'customDashboard', cell: (p) => avail(p.customDashboard) },
      ],
    },
    {
      key: 'integration',
      rows: [
        { key: 'api', cell: (p) => avail(p.api) },
        {
          key: 'importExport',
          cell: (p) => (p.advancedImportExport ? yes() : { kind: 'no', text: v.availability.no }),
        },
      ],
    },
    {
      key: 'storage',
      rows: [
        { key: 'storage', cell: (p) => text(storageText(p, v)) },
        { key: 'moreStorage', cell: (p) => avail(ADDON_AVAILABILITY.storage[p.id]) },
      ],
    },
    {
      key: 'support',
      rows: [
        { key: 'guide', cell: () => yes() },
        { key: 'channels', cell: () => yes() },
        { key: 'supportLevel', cell: (p) => text(v.support[p.support]) },
      ],
    },
    {
      key: 'services',
      rows: [
        { key: 'migration', cell: () => yes() },
        {
          key: 'training',
          cell: (p) => text(p.cta === 'quote' ? v.trainingEnterprise : v.training),
        },
        { key: 'implementation', cell: (p) => avail(ADDON_AVAILABILITY.implementation[p.id]) },
      ],
    },
  ];
}

const ICON = { yes: Check, no: Minus, addon: Plus, scope: Settings2 } as const;

function CellView({ cell, align = 'left' }: { cell: Cell; align?: 'left' | 'right' }) {
  const Icon = cell.kind === 'text' ? null : ICON[cell.kind];
  return (
    <span
      data-kind={cell.kind}
      className={cn(
        'inline-flex items-start gap-1.5',
        align === 'right' && 'justify-end text-right',
        cell.kind === 'no' ? 'text-text-muted' : 'text-text-primary',
      )}
    >
      {Icon && (
        <Icon
          aria-hidden
          className={cn(
            'mt-0.5 size-4 shrink-0',
            cell.kind === 'no' ? 'text-text-muted' : 'text-brand-glow',
          )}
        />
      )}
      <span>{cell.text}</span>
    </span>
  );
}

/** Grouped comparison: one area at a time; a table on wide screens, one plan at a time on phones. */
export function Comparison() {
  const c = useCopy(PRICING);
  const k = c.compare;
  const wide = useMediaQuery('(min-width: 48rem)');
  const { plan: selected } = usePricing();
  const [mobilePlan, setMobilePlan] = useState<PlanId | null>(null);
  const shown = mobilePlan ?? selected;
  const groups = buildGroups(c);
  const [open, setOpen] = useState<readonly GroupKey[]>(['organization', 'departments']);
  const allOpen = open.length === groups.length;

  return (
    <Section id={SECTION.compare} labelledBy="compare-title" className="scroll-mt-20">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHead id="compare-title" eyebrow={k.eyebrow} title={k.title} lead={k.lead} />
        <button
          type="button"
          onClick={() => setOpen(allOpen ? [] : groups.map((g) => g.key))}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-border-strong px-4 text-label text-text-secondary hover:text-text-primary sm:self-auto"
        >
          {allOpen ? k.collapseAll : k.expandAll}
        </button>
      </div>

      {!wide && (
        <div className="sticky top-16 z-20 -mx-4 mt-8 bg-surface-base/90 px-4 py-2 backdrop-blur-md">
          <Segmented<PlanId>
            label={k.plan}
            size="sm"
            value={shown}
            onChange={setMobilePlan}
            options={PLANS.map((p) => ({ value: p.id, label: p.name }))}
            className="grid w-full grid-cols-2"
          />
        </div>
      )}

      <div className="mt-8 space-y-3">
        {groups.map((g) => {
          const isOpen = open.includes(g.key);
          const panelId = `compare-${g.key}`;
          return (
            <section
              key={g.key}
              aria-labelledby={`${panelId}-h`}
              className={disclosureItem(isOpen, 'overflow-hidden')}
            >
              <h3 id={`${panelId}-h`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpen((o) =>
                      o.includes(g.key) ? o.filter((x) => x !== g.key) : [...o, g.key],
                    )
                  }
                  className={cn(disclosureTrigger, 'text-body font-semibold text-text-primary')}
                >
                  {k.groups[g.key]}
                  <DisclosureIcon open={isOpen} />
                </button>
              </h3>
              {isOpen && (
                <div id={panelId}>
                  {wide ? (
                    <table className="w-full table-fixed text-left text-label">
                      <caption className="sr-only">{k.groups[g.key]}</caption>
                      <thead>
                        <tr className="border-t border-border-soft">
                          <th scope="col" className="w-[24%] px-5 py-3 font-medium text-text-muted">
                            {k.feature}
                          </th>
                          {PLANS.map((p) => (
                            <th
                              key={p.id}
                              scope="col"
                              className={cn(
                                'px-4 py-3 font-semibold text-text-primary',
                                p.recommended && 'bg-brand-primary/[0.06]',
                              )}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {p.name}
                                {p.recommended && (
                                  <span className="inline-flex items-center gap-1 text-caption font-medium text-brand-soft">
                                    <Star className="size-3" aria-hidden />
                                    {c.explorer.recommended}
                                  </span>
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr
                            key={r.key}
                            data-row={r.key}
                            className="border-t border-border-soft align-top"
                          >
                            <th scope="row" className="px-5 py-3 font-medium text-text-secondary">
                              {k.rows[r.key]}
                            </th>
                            {PLANS.map((p) => (
                              <td
                                key={p.id}
                                data-plan={p.id}
                                className={cn(
                                  'px-4 py-3',
                                  p.recommended && 'bg-brand-primary/[0.06]',
                                )}
                              >
                                <CellView cell={r.cell(p)} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <dl>
                      {g.rows.map((r) => {
                        const p = PLANS.find((x) => x.id === shown)!;
                        return (
                          <div
                            key={r.key}
                            data-row={r.key}
                            className="flex items-start justify-between gap-4 border-t border-border-soft px-4 py-3"
                          >
                            <dt className="text-label text-text-secondary">{k.rows[r.key]}</dt>
                            <dd className="max-w-[55%] text-label">
                              <CellView cell={r.cell(p)} align="right" />
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Section>
  );
}

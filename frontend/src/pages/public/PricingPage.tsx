import { useCallback, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { AddOns, Onboarding } from '@/features/pricing/AddOnsAndServices';
import { EarlyAccess, EnterpriseFlow, PricingCta, PricingFaq } from '@/features/pricing/ClosingSections';
import { AnnualRelationship, CompanyModel } from '@/features/pricing/CompanyAndBilling';
import { Comparison } from '@/features/pricing/Comparison';
import { Configurator } from '@/features/pricing/Configurator';
import { PRICING } from '@/features/pricing/copy';
import { PackageExplorer } from '@/features/pricing/PackageExplorer';
import { PlanFinder } from '@/features/pricing/PlanFinder';
import { isPlanId, type Billing, type PlanId } from '@/features/pricing/plans';
import { PricingHero } from '@/features/pricing/PricingHero';
import { PricingContext, type PricingState } from '@/features/pricing/state';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

const DEFAULT_PLAN: PlanId = 'business';

/**
 * /pricing (EP07): the CORE package and subscription experience.
 * Presentation only — no billing, payment, account or workspace creation.
 *
 * The selected plan lives in the URL (`?plan=business`) so links and reloads
 * land on the same plan; `#plan-<id>` from older links is also understood.
 * Unknown values fall back to Business.
 */
export default function PricingPage() {
  const c = useCopy(PRICING);
  usePageMeta(c.meta.title, c.meta.description);
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const fromHash = hash.startsWith('#plan-') ? hash.slice('#plan-'.length) : null;
  const query = params.get('plan');
  const plan: PlanId = isPlanId(query) ? query : isPlanId(fromHash) ? fromHash : DEFAULT_PLAN;
  const [billing, setBilling] = useState<Billing>('monthly');

  const setPlan = useCallback(
    (next: PlanId) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('plan', next);
          return p;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );

  const value = useMemo<PricingState>(() => ({ plan, setPlan, billing, setBilling }), [plan, setPlan, billing]);

  return (
    <PricingContext.Provider value={value}>
      <PricingHero />
      <PackageExplorer />
      <CompanyModel />
      <AnnualRelationship />
      <PlanFinder />
      <Configurator />
      <Comparison />
      <AddOns />
      <Onboarding />
      <EnterpriseFlow />
      <EarlyAccess />
      <PricingFaq />
      <PricingCta />
    </PricingContext.Provider>
  );
}

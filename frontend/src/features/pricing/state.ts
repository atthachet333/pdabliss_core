import { createContext, useContext } from 'react';
import { useCopy } from '@/i18n/useCopy';
import { fill, PRICING } from './copy';
import { formatNumber, type Billing, type PlanId } from './plans';

/** Page-wide pricing selection: the package explorer, configurator and comparison share it. */
export interface PricingState {
  plan: PlanId;
  setPlan: (plan: PlanId) => void;
  billing: Billing;
  setBilling: (billing: Billing) => void;
}

export const PricingContext = createContext<PricingState | null>(null);

export function usePricing(): PricingState {
  const value = useContext(PricingContext);
  if (!value) throw new Error('usePricing must be used inside the pricing page');
  return value;
}

/** Localized money: "฿4,788" in Thai and English, "4,788 泰铢" in Chinese. Never converted. */
export function useMoney() {
  const c = useCopy(PRICING).currency;
  return (n: number) => fill(c.amount, { n: formatNumber(n) });
}

/** Ids used for in-page navigation (mega menu, CTAs). */
export const SECTION = {
  packages: 'packages',
  company: 'company',
  billing: 'billing',
  fit: 'find-your-package',
  configure: 'configure',
  compare: 'compare',
  addons: 'add-ons',
  onboarding: 'onboarding',
  enterprise: 'enterprise',
  early: 'early-access',
  faq: 'faq',
} as const;

/** Smoothly bring an in-page section into view (instant under reduced motion). */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

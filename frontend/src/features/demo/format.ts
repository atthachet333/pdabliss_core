import { Calculator, Crown, ShoppingCart, Truck, Warehouse, type LucideIcon } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import type { Role } from './machine';

/* Locale-aware formatting for the demo's sample numbers and dates. */

const TAG = { th: 'th-TH', en: 'en-GB', 'zh-CN': 'zh-CN' } as const;

export function useDemoFormat() {
  const { locale } = useLocale();
  const tag = TAG[locale];
  const date = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const num = new Intl.NumberFormat(tag);
  return {
    date: (iso: string) => date.format(new Date(`${iso}T00:00:00Z`)),
    num: (n: number) => num.format(n),
    money: (n: number, currency: string) =>
      new Intl.NumberFormat(tag, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
        n,
      ),
  };
}

export const ROLE_ICON: Record<Role, LucideIcon> = {
  sales: ShoppingCart,
  warehouse: Warehouse,
  purchasing: Truck,
  accounting: Calculator,
  executive: Crown,
};

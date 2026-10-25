import type { Category } from './registry';

/** One accent per category — a small mark beside words, never colour alone. */
export const CATEGORY_ACCENT: Record<Category, string> = {
  start: 'var(--color-brand-glow)',
  workflow: 'var(--color-info)',
  control: 'var(--color-warning)',
  warehouse: 'var(--color-ws-warehouse)',
  implementation: 'var(--color-ws-operations)',
  security: 'var(--color-ws-accounting)',
  terminology: 'var(--color-ws-admin)',
};

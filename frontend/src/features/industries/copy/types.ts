import type { DeptKey } from '@/features/departments/catalog';

/**
 * The nine questions every industry page answers, plus a signature section
 * whose shape differs per industry (`S`).
 */
export interface IndustryPageCopy<S> {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; lead: string; visual: string };
  /** 1. What makes this industry operationally different? */
  reality: { title: string; lead: string; points: readonly { title: string; body: string }[] };
  /** 2. Where does work usually get stuck? */
  frictions: { title: string; items: readonly string[] };
  /** 3. Which departments interact most? */
  departments: { title: string; roles: Partial<Record<DeptKey, string>> };
  /** 4. What does an end-to-end workflow look like? (labels in the summary) */
  workflow: { title: string; notes: Record<string, string> };
  /** 5. What information matters most? */
  information: { title: string; items: readonly { label: string; why: string }[] };
  /** 6. What should managers watch? (labels in the summary) */
  signals: { title: string; notes: Record<string, string> };
  /** 7. How does CORE fit? (per-principle lines in the summary) */
  fit: { title: string; lead: string };
  /** 8. What CORE does NOT replace (besides the model's boundaries). */
  notReplace: { title: string; items: readonly string[] };
  /** 9. What may require custom implementation? */
  custom: { title: string; items: readonly string[] };
  signature: S;
}

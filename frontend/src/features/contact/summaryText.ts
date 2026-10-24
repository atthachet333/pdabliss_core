import { useDepartments } from '@/config/departments';
import type { ContactCopy } from './copy';
import type { Inquiry } from './model';

/*
 * Inquiry summary rows (EP13) — shared by the live panel, the review step
 * and the plain-text hand-off for email / LINE. Unanswered optional
 * questions are left out.
 */

const PLAN_NAMES = {
  starter: 'Starter',
  business: 'Business',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

export interface SummaryRow {
  key:
    | 'type'
    | 'plan'
    | 'industry'
    | 'size'
    | 'departments'
    | 'problems'
    | 'method'
    | 'contact'
    | 'message';
  label: string;
  value: string;
}

export function summaryRows(
  q: Inquiry,
  c: ContactCopy,
  deptName: (id: string) => string,
  { includeContact = true }: { includeContact?: boolean } = {},
): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const s = c.summary;
  rows.push({ key: 'type', label: s.type, value: q.type ? c.types[q.type].label : s.empty });
  if (q.plan) rows.push({ key: 'plan', label: s.plan, value: PLAN_NAMES[q.plan] });
  if (q.industry)
    rows.push({ key: 'industry', label: s.industry, value: c.industries[q.industry] });
  if (q.size) rows.push({ key: 'size', label: s.size, value: c.sizes[q.size] });
  if (q.departments.length)
    rows.push({
      key: 'departments',
      label: s.departments,
      value: q.departments.map(deptName).join(' / '),
    });
  if (q.problems.length)
    rows.push({
      key: 'problems',
      label: s.problems,
      value: q.problems.map((p) => c.problems[p]).join(' / '),
    });
  rows.push({ key: 'method', label: s.method, value: c.methods[q.method].label });
  if (includeContact) {
    const k = q.contact;
    const who = [k.name, k.company, k.phone, k.email, k.lineId && `LINE ${k.lineId}`]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(' · ');
    if (who) rows.push({ key: 'contact', label: s.contact, value: who });
    if (q.message.trim()) rows.push({ key: 'message', label: s.message, value: q.message.trim() });
  }
  return rows;
}

/** Plain text for an email body or a LINE message. */
export function summaryText(rows: SummaryRow[], title: string) {
  return [title, '', ...rows.map((r) => `${r.label}: ${r.value}`)].join('\n');
}

export function useDeptName() {
  const departments = useDepartments();
  return (id: string) => departments.find((d) => d.id === id)?.name ?? id;
}

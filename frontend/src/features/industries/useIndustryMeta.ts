import { useDepartments } from '@/config/departments';
import type { DeptKey } from '@/features/departments/catalog';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import type { IndustryPageCopy } from './copy/types';

/** Localized page copy for one industry, with its title and description applied. */
export function useIndustryPage<S>(copy: Localized<IndustryPageCopy<S>>): IndustryPageCopy<S> {
  const c = useCopy(copy);
  usePageMeta(c.meta.title, c.meta.description);
  return c;
}

/** Localized department name by key. */
export function useDeptName() {
  const departments = useDepartments();
  return (id: DeptKey) => departments.find((d) => d.id === id)!.name;
}

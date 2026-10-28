import { useCallback, useEffect, useRef, useState } from 'react';
import { getDepartment } from '@/config/departments';
import { departmentId, type BranchInfo, type DepartmentCode } from '@/features/company/api';
import { LOCALE_META } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import type { ControlCopy } from './copy';

/* Helpers and hooks shared by the Company Control Center screens (EP25). */

/** Two letters for a company without a logo ("PDA BLISS" → "PB", "ตัวอย่าง" → "ตั"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return [...(words[0] ?? '?')].slice(0, 2).join('').toUpperCase();
}

/** A user-facing message for an API error: known codes in words, else the generic line. */
export function errorText(e: unknown, c: ControlCopy): string {
  if (e instanceof ApiError) {
    const known = (c.errors as Record<string, string>)[e.code];
    if (known) return known;
    if (e.status === 403) return c.errors.FORBIDDEN;
  }
  return c.common.error;
}

type Load<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/** Loads once (and on `reload`); keeps the last data while reloading. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<Load<T>>({ status: 'loading' });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    try {
      const data = await fnRef.current();
      setState({ status: 'ready', data });
      return data;
    } catch (error) {
      setState((s) => (s.status === 'ready' ? s : { status: 'error', error }));
      throw error;
    }
  }, []);
  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);
  return { state, reload, set: (data: T) => setState({ status: 'ready', data }) };
}

/** Department name in the current language. */
export function useDepartmentName() {
  const { locale } = useLocale();
  return (code: DepartmentCode) => getDepartment(departmentId(code), locale).name;
}

export function useDateFormat() {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  return {
    date: (iso: string) =>
      new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso)),
    dateTime: (iso: string) =>
      new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(iso),
      ),
  };
}

export const fieldGrid = 'grid gap-4 sm:grid-cols-2';

/** A branch address on one line (Thai order: street, sub-district, district, province, postcode). */
export const oneLineAddress = (b: BranchInfo) =>
  [
    b.address.line1,
    b.address.line2,
    b.address.subdistrict,
    b.address.district,
    b.address.province,
    b.address.postalCode,
  ]
    .filter(Boolean)
    .join(' ');

/** "Bang Kapi, Bangkok" — district and province, the part people scan for. */
export const locationSummary = (b: Pick<BranchInfo, 'address'>) =>
  [b.address.district, b.address.province].filter(Boolean).join(', ');

/* EP26 branch form fields (shared by the branch list and the branch detail). */

export type BranchFields = Record<
  | 'code'
  | 'name'
  | 'addressLine1'
  | 'addressLine2'
  | 'subdistrict'
  | 'district'
  | 'province'
  | 'postalCode'
  | 'countryCode'
  | 'phone',
  string
>;

export const emptyBranch: BranchFields = {
  code: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  subdistrict: '',
  district: '',
  province: '',
  postalCode: '',
  countryCode: 'TH',
  phone: '',
};

export const branchFields = (b: BranchInfo): BranchFields => ({
  code: b.code,
  name: b.name,
  addressLine1: b.address.line1,
  addressLine2: b.address.line2 ?? '',
  subdistrict: b.address.subdistrict ?? '',
  district: b.address.district ?? '',
  province: b.address.province,
  postalCode: b.address.postalCode,
  countryCode: b.address.countryCode,
  phone: b.phone ?? '',
});

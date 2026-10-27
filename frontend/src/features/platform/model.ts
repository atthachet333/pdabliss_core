import { useCallback, useEffect, useRef, useState } from 'react';
import { getDepartment } from '@/config/departments';
import { departmentId, type DepartmentCode } from '@/features/company/api';
import type { Locale } from '@/i18n/locales';
import { ApiError } from '@/lib/api';
import type { PlatformCopy } from './copy';

/*
 * Non-visual helpers of the Platform Control Center (EP24.1): loading and
 * error kinds, status tones, department colours and formatting. Components
 * live in parts.tsx.
 */

export type LoadError = 'expired' | 'forbidden' | 'notFound' | 'temporary';

export function classifyError(e: unknown): LoadError {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'expired';
    if (e.status === 403) return 'forbidden';
    if (e.status === 404) return 'notFound';
  }
  return 'temporary';
}

export type Loaded<T> =
  { status: 'loading' } | { status: 'error'; error: LoadError } | { status: 'ready'; value: T };

/** Loads once per `key`; state changes only when the request settles. */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (value) => live && setState({ status: 'ready', value }),
      (e: unknown) => live && setState({ status: 'error', error: classifyError(e) }),
    );
    return () => {
      live = false;
    };
  }, [key, attempt]);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { state, retry, setState };
}

export type Tone = 'active' | 'waiting' | 'danger' | 'muted' | 'info';

export const companyTone = (s: string): Tone =>
  s === 'ACTIVE'
    ? 'active'
    : s === 'PENDING_SUBSCRIPTION'
      ? 'waiting'
      : s === 'SUSPENDED'
        ? 'danger'
        : 'muted';

export const subscriptionTone = (s: string | null): Tone =>
  s === 'ACTIVE'
    ? 'active'
    : s === 'PENDING'
      ? 'waiting'
      : s === 'PAST_DUE' || s === 'SUSPENDED'
        ? 'danger'
        : 'muted';

/** Department accent colours (the workspace palette). */
export const DEPT_COLOR: Record<DepartmentCode, string> = {
  SALES: 'var(--color-ws-sales)',
  OPERATIONS: 'var(--color-ws-operations)',
  WAREHOUSE: 'var(--color-ws-warehouse)',
  PURCHASING: 'var(--color-ws-purchasing)',
  ACCOUNTING: 'var(--color-ws-accounting)',
  EXECUTIVE: 'var(--color-ws-executive)',
};

export const departmentName = (code: DepartmentCode, locale: Locale) =>
  getDepartment(departmentId(code), locale).name;

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? [words[0]![0], words[1]![0]] : [...(words[0] ?? '?')].slice(0, 2);
  return letters.join('').toUpperCase();
}

export const formatDate = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso));

export const formatCount = (n: number, lang: string) => new Intl.NumberFormat(lang).format(n);

/** Human label for an audit code, with the raw code kept for support. */
export function eventLabel(p: PlatformCopy, code: string) {
  const auth = p.events.auth as Record<string, string>;
  const company = p.events.company as Record<string, string>;
  return auth[code] ?? company[code] ?? p.events.unknown;
}

/** The quiet surface every platform zone sits on. */
export const ZONE =
  'min-w-0 rounded-[1.375rem] bg-[linear-gradient(180deg,rgb(12_24_34/0.92),rgb(7_14_21/0.96))] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]';

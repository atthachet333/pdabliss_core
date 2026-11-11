import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLocale } from '@/i18n/useLocale';
import type { Page } from './whApi';

/* Hooks and constants shared by the EP31 Warehouse screens (no components here). */

export const WH = '/core/warehouse';

/** A server-paged list: reloads on `deps`, appends on "show more"; stale answers are ignored. */
export function usePaged<T>(load: (page: number) => Promise<Page<T>>, deps: readonly unknown[]) {
  const [data, setData] = useState<Page<T> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const request = useRef(0);
  const fetchPage = async (page: number) => {
    const n = ++request.current;
    const next = await load(page);
    if (n !== request.current) return;
    setData((prev) =>
      page > 1 && prev ? { ...next, items: [...prev.items, ...next.items] } : next,
    );
    setError(null);
  };
  useEffect(() => {
    fetchPage(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const showMore = () => {
    if (!data) return;
    setMore(true);
    fetchPage(data.page + 1)
      .catch((e: unknown) => setError(e))
      .finally(() => setMore(false));
  };
  return { data, error, more, showMore };
}

/** Debounced search text (300 ms). */
export function useDebounced(value: string) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  return v;
}

/**
 * List filters kept in the URL (shareable, back button; the language rides along).
 * EP42.3.1: React Router builds the next URL from the params of the LAST RENDER — even its
 * function form — so a second change made before the router re-rendered (a quick second
 * click, a slow device) started from stale params and dropped the first filter. `update`
 * builds on its own pending result until the router has rendered it.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const { locale } = useLocale();
  const pending = useRef<{ from: URLSearchParams; next: URLSearchParams } | null>(null);
  const update = (edit: (next: URLSearchParams) => void) => {
    const base = pending.current?.from === params ? pending.current.next : params;
    const next = new URLSearchParams(base);
    edit(next);
    pending.current = { from: params, next };
    setParams(next, { replace: true, state: { locale } });
  };
  return [params, update] as const;
}

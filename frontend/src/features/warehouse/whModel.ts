import { useEffect, useRef, useState } from 'react';
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

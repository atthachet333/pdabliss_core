import { useRef } from 'react';
import type { Localized } from '@/i18n/useCopy';

/* EP42.3 — the copy, types and preview cache behind ./docContext (no components here). */

const th = {
  items: 'สินค้า',
  toReceive: 'สินค้าค้างรับ',
  more: (n: number) => `+ อีก ${n} รายการ`,
  left: (q: string) => `ยังค้าง ${q}`,
  next: 'ขั้นต่อไป',
  preview: 'ดูรายการย่อ',
  hide: 'ซ่อนรายการย่อ',
  open: 'เปิดเอกสารฉบับเต็ม',
  none: 'ยังไม่มีรายการ',
  loading: 'กำลังโหลดรายการ…',
  failed: 'โหลดรายการไม่สำเร็จ — เปิดเอกสารฉบับเต็มแทน',
};
type DocCopy = typeof th;
export const DOC_COPY: Localized<DocCopy> = {
  th,
  en: {
    items: 'Items',
    toReceive: 'Still to receive',
    more: (n) => `+ ${n} more`,
    left: (q) => `${q} outstanding`,
    next: 'Next',
    preview: 'Preview lines',
    hide: 'Hide preview',
    open: 'Open full document',
    none: 'No lines yet',
    loading: 'Loading lines…',
    failed: 'Could not load the lines — open the full document instead.',
  },
  'zh-CN': {
    items: '物料',
    toReceive: '待收物料',
    more: (n) => `+ 另 ${n} 项`,
    left: (q) => `未完成 ${q}`,
    next: '下一步',
    preview: '预览明细',
    hide: '隐藏预览',
    open: '打开完整单据',
    none: '暂无明细',
    loading: '正在加载明细…',
    failed: '明细加载失败 — 请打开完整单据。',
  },
};

/** The server's row summary (backend `LineSummary`). */
export type LineSummary = {
  code: string | null;
  name: string;
  quantity: string;
  unit: string | null;
  more: number;
} | null;

/**
 * One list's preview cache: each document is fetched once, on its first opening,
 * and kept while the list is on screen (no refetch on close / reopen).
 */
export function usePreviewCache<T>(load: (id: string) => Promise<T>) {
  const cache = useRef(new Map<string, Promise<T>>());
  return (id: string) => {
    let p = cache.current.get(id);
    if (!p) {
      p = load(id);
      cache.current.set(id, p);
      // A failed load is not kept — the next opening tries again.
      p.catch(() => cache.current.delete(id));
    }
    return p;
  };
}

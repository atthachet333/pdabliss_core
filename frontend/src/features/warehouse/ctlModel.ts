import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import type { DocKind } from './ctlApi';
import { CTL_COPY, ctlError } from './ctlCopy';
import { WH_COPY } from './whCopy';
import { WH } from './whModel';

/* Hooks shared by the EP32 inventory-control screens (no components here). */

/** Copy and the error formatter in one. */
export function useCtl() {
  const c = useCopy(WH_COPY);
  const k = useCopy(CTL_COPY);
  const cc = useCopy(CONTROL_COPY);
  return { c, k, err: (e: unknown) => ctlError(e, k, c, cc) };
}

/** Runs a document request, keeps the notice, returns whether it worked. */
export function useRunner<T>(set: (d: T) => void) {
  const { c, err } = useCtl();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const run = async (work: () => Promise<T>) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text: c.saved });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: err(e) });
      return false;
    }
  };
  return { notice, run };
}

/** After creating: open the new document. */
export function useOpenDoc(kind: DocKind) {
  const navigate = useNavigate();
  const { locale } = useLocale();
  return (id: string) =>
    void navigate(`${WH}/${kind}/${encodeURIComponent(id)}`, { state: { locale } });
}

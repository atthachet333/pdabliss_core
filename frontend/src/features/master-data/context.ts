import { createContext, useContext } from 'react';
import type { MasterContext } from './api';

/* What this person may do in Master Data, shared by every page under MasterDataArea (EP28). */
export const MasterCtx = createContext<{ ctx: MasterContext; reload: () => void } | null>(null);

export function useMaster() {
  const value = useContext(MasterCtx);
  if (!value) throw new Error('useMaster outside MasterDataArea');
  return value;
}

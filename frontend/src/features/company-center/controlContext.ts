import { createContext, useContext } from 'react';
import type { Identity } from '@/features/auth/api';
import type { ControlOverview } from './api';

/* The Company Control Center overview, shared by every page under CompanyShell (EP25). */

export interface ControlState {
  overview: ControlOverview;
  identity: Identity;
  reload: () => Promise<unknown>;
  replace: (overview: ControlOverview) => void;
}

export const ControlContext = createContext<ControlState | null>(null);

export function useControl(): ControlState {
  const value = useContext(ControlContext);
  if (!value) throw new Error('useControl outside CompanyShell');
  return value;
}

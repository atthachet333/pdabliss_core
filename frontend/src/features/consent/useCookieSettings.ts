import { createContext, useContext } from 'react';

export interface CookieSettingsValue {
  /** Opens the Cookie Preferences dialog (e.g. from the footer). */
  openPreferences: () => void;
}

export const CookieSettingsContext = createContext<CookieSettingsValue>({
  openPreferences: () => {},
});

export function useCookieSettings(): CookieSettingsValue {
  return useContext(CookieSettingsContext);
}

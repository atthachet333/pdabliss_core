import { useSyncExternalStore } from 'react';

/*
 * Cookie consent record (EP05). Stored in this browser only (localStorage) —
 * never sent to a backend. The record is versioned: bumping CONSENT_VERSION
 * (for example when a new tracker is introduced) makes every visitor choose
 * again.
 *
 * Today the site sets no analytics, preference or marketing cookies; the
 * categories exist so that future tools can check `analytics` etc. before
 * loading anything.
 */

export const CONSENT_STORAGE_KEY = 'pdabliss-core:cookie-consent';
export const CONSENT_VERSION = 1;

export interface ConsentChoices {
  analytics: boolean;
  preferences: boolean;
  marketing: boolean;
}

export interface ConsentRecord extends ConsentChoices {
  version: typeof CONSENT_VERSION;
  /** Essential storage is always on; recorded for clarity. */
  essential: true;
  /** ISO timestamp of the visitor's last choice. */
  updatedAt: string;
}

export const ALL_ACCEPTED: ConsentChoices = { analytics: true, preferences: true, marketing: true };
export const ESSENTIAL_ONLY: ConsentChoices = {
  analytics: false,
  preferences: false,
  marketing: false,
};

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedRecord: ConsentRecord | null = null;
/** Holds the choice for this page view when storage is unavailable. */
let memoryRecord: ConsentRecord | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null; // Storage blocked (private mode, policy): treat as no choice yet.
  }
}

function parse(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ConsentRecord>;
    if (
      v?.version !== CONSENT_VERSION ||
      typeof v.analytics !== 'boolean' ||
      typeof v.preferences !== 'boolean' ||
      typeof v.marketing !== 'boolean' ||
      typeof v.updatedAt !== 'string'
    ) {
      return null;
    }
    return {
      version: CONSENT_VERSION,
      essential: true,
      analytics: v.analytics,
      preferences: v.preferences,
      marketing: v.marketing,
      updatedAt: v.updatedAt,
    };
  } catch {
    return null;
  }
}

/** The stored consent, or null when the visitor has not chosen (or the record is stale). */
export function readConsent(): ConsentRecord | null {
  const raw = readRaw();
  if (raw === null && memoryRecord) return memoryRecord;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedRecord = parse(raw);
  }
  return cachedRecord;
}

function notify() {
  for (const l of listeners) l();
}

export function saveConsent(choices: ConsentChoices): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    essential: true,
    analytics: choices.analytics,
    preferences: choices.preferences,
    marketing: choices.marketing,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable: the choice still applies for this page view.
    memoryRecord = record;
  }
  notify();
  return record;
}

export function clearConsent() {
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedRaw = undefined;
  memoryRecord = null;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CONSENT_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Live consent record (updates across components and browser tabs). */
export function useConsent(): ConsentRecord | null {
  return useSyncExternalStore(subscribe, readConsent, () => null);
}

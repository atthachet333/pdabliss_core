import type { MegaGroupId } from '@/config/navigation';

/*
 * Shape of a public-shell dictionary. Thai (messages/th.ts) is the source
 * language; English and Simplified Chinese implement the same interface, so a
 * missing string is a type error rather than a blank in production.
 *
 * Scope: the shared public shell (header, mega menus, mobile navigation,
 * footer, cookie consent, floating utilities). Page bodies keep their copy next
 * to their components via `useCopy` (src/i18n/useCopy.ts).
 */

export interface MegaItemMessages {
  label: string;
  description: string;
}

export interface MegaGroupMessages {
  /** Top-level navigation label. */
  label: string;
  /** Small English-style overline above the heading. */
  eyebrow: string;
  /** May contain `\n` for an intentional line break. */
  heading: string;
  intro: string;
  /** Optional honesty note (sample structure, planned capability …). */
  note?: string;
  /** Keyed by the item ids in config/navigation.ts. */
  items: Record<string, MegaItemMessages>;
  highlight: {
    eyebrow: string;
    /** May contain `\n`. */
    statement: string;
    body?: string;
    /** Label of the call to action whose destination is in config/navigation.ts. */
    cta?: string;
  };
}

export type CookieCategoryId = 'essential' | 'analytics' | 'preferences' | 'marketing';

export interface CookieCategoryMessages {
  title: string;
  /** English category name, shown as a secondary label. */
  subtitle: string;
  description: string;
}

export interface ShellMessages {
  shell: {
    skipToContent: string;
    home: string;
  };
  header: {
    primaryNav: string;
    openMenu: string;
    closeMenu: string;
    menuDialog: string;
    login: string;
    megaRegion: (label: string) => string;
    explore: string;
  };
  language: {
    label: string;
    current: (name: string) => string;
    note: string;
  };
  nav: {
    overview: string;
    contact: string;
    plannedTag: string;
    groups: Record<MegaGroupId, MegaGroupMessages>;
  };
  footer: {
    byline: string;
    lead: string;
    description: string;
    shortcuts: string;
    call: string;
    line: string;
    email: string;
    developedBy: string;
    groups: { quick: string; company: string };
    /** Footer link to /industries (not a mega group). */
    industries: string;
    contactHeading: string;
    address: string;
    phone: string;
    emailLabel: string;
    lineLabel: string;
    rightsReserved: string;
    legal: string;
    privacy: string;
    terms: string;
    cookieSettings: string;
  };
  contact: {
    /** Contact person for the single public phone number. */
    phoneLabel: string;
    lineLabel: string;
    opensInNewTab: string;
  };
  utility: {
    label: string;
    backToTop: string;
    openContact: string;
    closeContact: string;
    panelTitle: string;
    panelIntro: string;
    call: string;
    line: string;
    email: string;
    consult: string;
    consultDetail: string;
  };
  cookie: {
    region: string;
    title: string;
    body: string;
    note: string;
    acceptAll: string;
    rejectNonEssential: string;
    settings: string;
    privacyLink: string;
    prefsTitle: string;
    prefsIntro: string;
    alwaysOn: string;
    inUse: string;
    notInUse: string;
    save: string;
    close: string;
    saved: string;
    categories: Record<CookieCategoryId, CookieCategoryMessages>;
  };
}

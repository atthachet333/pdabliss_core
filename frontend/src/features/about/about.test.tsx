import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { COMPANY, companyName, PRODUCTS } from '@/config/company';
import { CONTACT } from '@/config/contact';
import { renderRoute } from '@/test/render';
import { ABOUT } from './copy';
import {
  ABOUT_CHAPTER,
  ACTIVITIES,
  EXCHANGE,
  GUARDS,
  IMPLEMENTATION,
  LAYERS,
  METHOD_STEPS,
  PRINCIPLES,
  STAGES,
  SYMPTOMS,
} from './model';

/*
 * EP12: /about — who PDA BLISS is and how it works. Structure and copy are
 * tested directly; the page as rendered, in every locale.
 */

const original = window.matchMedia;
beforeAll(() => {
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});
afterEach(() => {
  window.matchMedia = original;
});

const LOCALES = ['th', 'en', 'zh-CN'] as const;
const THAI = /[฀-฾เ-๿]/;
const TRADITIONAL = /[們個發這開時關庫說價購資費號門運營權證統線際體與變]/;
// No invented company facts: founding year, headcount, client counts,
// projects, awards, certifications, partners or testimonials.
const INVENTED =
  /ก่อตั้ง|founded|since \d{4}|成立于|\d+\s?\+?\s?(ลูกค้า|clients|customers|projects|employees|โครงการ|พนักงาน|客户|员工|项目)|\bISO\b|certified|award-winning|ได้รับรางวัล|获奖|testimonial|“[^”]*”\s?—|partner of/i;
// The approved address is an office — never a house or a home.
const HOME = /บ้าน|ที่พักอาศัย|\bhome\b|\bhouse\b|residence|住宅|住所|家中/i;

async function open(path = '/about') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const section = (id: string) => document.getElementById(id)!;
const main = () => document.getElementById('main')!;
const allStrings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(allStrings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(allStrings)
        : [];
function visibleText() {
  const m = main().cloneNode(true) as HTMLElement;
  m.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
  return (m.textContent ?? '').replace(CONTACT.address, '');
}

/* ------------------------------------------------------------------ */

describe('about model and copy', () => {
  it('keeps the company identity in one place, built from CONTACT', () => {
    expect(COMPANY.legalNameTh).toBe('บริษัท พีดีเอ บลิส จำกัด');
    expect(COMPANY.legalName).toBe('PDA BLISS COMPANY LIMITED');
    expect(COMPANY.address).toBe(CONTACT.address);
    expect(COMPANY.email).toBe(CONTACT.email);
    expect(COMPANY.telephone).toBe(CONTACT.phone.e164);
    expect(COMPANY.sameAs).toEqual([CONTACT.lineUrl]);
    expect(companyName('th')).toBe(COMPANY.legalNameTh);
    expect(companyName('en')).toBe(COMPANY.legalName);
    expect(companyName('zh-CN')).toBe(COMPANY.legalName);
    // Nothing else is modelled as a company fact.
    expect(Object.keys(COMPANY).sort()).toEqual(
      ['address', 'brand', 'email', 'legalName', 'legalNameTh', 'sameAs', 'telephone'].sort(),
    );
  });

  it('defines the methodology as ten steps in four stages, from real work to improve', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['notes', 'map', 'workflow', 'interface']);
    expect(METHOD_STEPS).toEqual([
      'realWork',
      'observe',
      'responsibility',
      'process',
      'failure',
      'workflow',
      'interface',
      'build',
      'test',
      'improve',
    ]);
    expect(IMPLEMENTATION).toEqual([
      'listen',
      'understand',
      'map',
      'design',
      'build',
      'validate',
      'train',
      'launch',
      'improve',
    ]);
    expect(GUARDS.map((g) => g.principle)).toEqual([
      'PREVENT',
      'DETECT',
      'ALERT',
      'CONTROL',
      'TRACE',
    ]);
  });

  it('gives every locale the same complete copy, without invented facts', () => {
    for (const l of LOCALES) {
      const c = ABOUT[l];
      expect(Object.keys(c.belief.principles)).toEqual([...PRINCIPLES]);
      expect(Object.keys(c.problem.symptoms)).toEqual([...SYMPTOMS]);
      expect(Object.keys(c.approach.steps)).toEqual([...METHOD_STEPS]);
      expect(Object.keys(c.consulting.exchange)).toEqual([...EXCHANGE]);
      expect(Object.keys(c.consulting.activities)).toEqual([...ACTIVITIES]);
      expect(Object.keys(c.implementation.steps)).toEqual([...IMPLEMENTATION]);
      expect(Object.keys(c.longTerm.layers).sort()).toEqual([...LAYERS].sort());
      expect(Object.keys(c.longTerm.products)).toEqual(PRODUCTS.map((p) => p.id));
      for (const s of allStrings(c)) expect(s, `${l}: ${s}`).not.toMatch(INVENTED);
      for (const s of allStrings(c)) expect(s, `${l}: ${s}`).not.toMatch(HOME);
    }
    for (const s of allStrings(ABOUT['zh-CN'])) expect(s).not.toMatch(TRADITIONAL);
    for (const s of allStrings(ABOUT.en)) expect(s).not.toMatch(THAI);
  });
});

/* ------------------------------------------------------------------ */

describe('/about page', () => {
  it('opens on the process-before-features statement and the company name', async () => {
    await open();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('เราไม่ได้เริ่มจากคำถามว่า');
    expect(h1).toHaveTextContent('Software ควรมีฟีเจอร์อะไร');
    expect(h1).toHaveTextContent('องค์กรทำงานจริงอย่างไร');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(main()).toHaveTextContent(COMPANY.legalNameTh);
    // EP13: the chaos → CORE scene and its readable stages.
    const scene = screen.getByRole('figure', { name: /ภาพเคลื่อนไหว: แชต/ });
    expect(scene.querySelectorAll('[data-fragment]')).toHaveLength(10);
    expect(scene.querySelectorAll('[data-chip]')).toHaveLength(5);
    expect(scene.querySelector('[data-core-state]')).toHaveTextContent('SO-1042');
    expect(document.querySelectorAll('[data-hero-stages] li')).toHaveLength(5);
  });

  it('tells the story in order, with every chapter labelled', async () => {
    await open();
    const ids = Object.values(ABOUT_CHAPTER);
    const found = [...main().querySelectorAll('section[id]')]
      .map((s) => s.id)
      .filter((id) => (ids as string[]).includes(id));
    expect(found).toEqual(ids);
    for (const id of ids) {
      const labelled = section(id).getAttribute('aria-labelledby')!;
      expect(document.getElementById(labelled), id).not.toBeNull();
    }
  });

  it('separates the company from the product', async () => {
    await open();
    const items = section(ABOUT_CHAPTER.company).querySelectorAll('[data-relation-item]');
    expect([...items].map((i) => i.querySelector('dt')!.textContent)).toEqual([
      'PDA BLISS',
      'CORE',
    ]);
    expect(section(ABOUT_CHAPTER.company)).toHaveTextContent('Department Operations Platform');
  });

  it('shows the beliefs as one lead principle and a manifesto, not equal cards', async () => {
    await open();
    const belief = section(ABOUT_CHAPTER.belief);
    expect(belief.querySelectorAll('[data-principle]')).toHaveLength(8);
    expect(belief.querySelector('[data-lead]')).toHaveAttribute('data-principle', 'responsibility');
    expect(belief.querySelectorAll('[data-manifesto] > li')).toHaveLength(7);
  });

  it('names the operational problem and links to Solutions', async () => {
    await open();
    const problem = section(ABOUT_CHAPTER.problem);
    expect(problem.querySelectorAll('[data-symptom]')).toHaveLength(7);
    expect(problem).toHaveTextContent('ไม่ได้ขาด Software');
    expect(problem.querySelector('a[href="/solutions"]')).not.toBeNull();
  });

  it('explains responsibility-first design and Human Error through the five principles', async () => {
    await open();
    const systems = section(ABOUT_CHAPTER.systems);
    expect(systems.querySelectorAll('[data-path="traditional"] li')).toHaveLength(3);
    expect(systems.querySelectorAll('[data-path="core"] li')).toHaveLength(4);
    expect(systems).toHaveTextContent('ไม่ใช่การบอกว่าระบบแบบรวมศูนย์ไม่ดี');
    expect(systems.querySelector('[data-system-shift]')).not.toBeNull();
    const guards = [...systems.querySelectorAll<HTMLButtonElement>('button[data-guard]')];
    expect(guards.map((g) => g.textContent)).toEqual([
      'นำทางPREVENT',
      'ตรวจสอบDETECT',
      'ทำให้มองเห็นALERT',
      'ควบคุมCONTROL',
      'เก็บบริบทTRACE',
    ]);
    expect(systems.querySelector('a[href="/how-core-works"]')).toHaveTextContent(
      'ดูว่าแนวคิดนี้ทำงานจริงอย่างไร',
    );
  });

  it('lays out the methodology as the signature #approach section', async () => {
    await open();
    const approach = section('approach');
    expect(approach.querySelectorAll('[data-stage]')).toHaveLength(4);
    expect(
      [...approach.querySelectorAll('[data-step]')].map((s) => s.getAttribute('data-step')),
    ).toEqual([...METHOD_STEPS]);
    expect(approach.querySelector('[data-loop]')).not.toBeNull();
    expect(screen.getByRole('figure', { name: /แผนที่ความรับผิดชอบ/ })).toBeInTheDocument();
  });

  it('presents consulting as a working-session table with an honest boundary', async () => {
    await open();
    const consulting = section('consulting');
    const table = within(consulting).getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((r) => r.textContent),
    ).toEqual(EXCHANGE.map((e) => ABOUT.th.consulting.exchange[e].topic));
    expect(consulting.querySelectorAll('[data-activities] li')).toHaveLength(8);
    expect(consulting.querySelector('[data-boundary]')).toHaveTextContent(
      'ไม่ใช่บริการที่ปรึกษาด้านบัญชี ภาษี หรือกฎหมาย',
    );
    // No invented advisor profiles.
    expect(consulting.querySelector('img')).toBeNull();
  });

  it('links implementation to the Enterprise journey', async () => {
    await open();
    const impl = section(ABOUT_CHAPTER.implementation);
    expect(impl.querySelectorAll('[data-implementation-step]')).toHaveLength(9);
    expect(impl.querySelector('a[href="/enterprise#implementation"]')).not.toBeNull();
  });

  it('keeps CORE a product: one foundation, configuration, integrations where needed', async () => {
    await open();
    const lt = section(ABOUT_CHAPTER.longTerm);
    expect(
      [...lt.querySelectorAll('[data-layer]')].map((l) => l.getAttribute('data-layer')),
    ).toEqual(['integration', 'workflow', 'configuration', 'foundation']);
    expect(lt.querySelector('[data-not]')).toHaveTextContent('เขียนระบบใหม่ทั้งชุดให้ทุกองค์กร');
    expect(lt).toHaveTextContent('ไม่ใช่การเขียนระบบใหม่ทั้งชุดสำหรับแต่ละองค์กร');
    expect(
      [...lt.querySelectorAll('[data-product]')].map((p) => p.getAttribute('data-product')),
    ).toEqual(['core', 'one', 'property']);
  });

  it('prints the approved company details from the central config, with correct link semantics', async () => {
    await open();
    const info = section(ABOUT_CHAPTER.info);
    expect(info).toHaveTextContent(COMPANY.legalNameTh);
    expect(info).toHaveTextContent(COMPANY.legalName);
    const contact = info.querySelector('address')!;
    expect(contact).toHaveTextContent(CONTACT.address);
    expect(within(contact).getByRole('link', { name: CONTACT.phone.display })).toHaveAttribute(
      'href',
      `tel:${CONTACT.phone.e164}`,
    );
    expect(contact).toHaveTextContent(`${CONTACT.phone.display} (คุณวิน)`);
    expect(within(contact).getByRole('link', { name: CONTACT.email })).toHaveAttribute(
      'href',
      `mailto:${CONTACT.email}`,
    );
    const line = within(contact).getByRole('link', { name: new RegExp(CONTACT.lineId) });
    expect(line).toHaveAttribute('href', CONTACT.lineUrl);
    expect(line).toHaveAttribute('target', '_blank');
    expect(line).toHaveAttribute('rel', 'noopener noreferrer');
    expect(info.querySelectorAll('[data-trust] li')).toHaveLength(4);
  });

  it('ends with a conversation, LINE and quiet next steps', async () => {
    await open();
    const talk = section(ABOUT_CHAPTER.talk);
    expect(talk).toHaveTextContent('อยากให้เราช่วยดู Process ขององค์กรคุณ?');
    expect(within(talk).getByRole('link', { name: /พูดคุยกับ PDA BLISS/ })).toHaveAttribute(
      'href',
      '/contact?interest=consulting',
    );
    expect(talk.querySelector('[data-cta="line"]')).toHaveAttribute('href', CONTACT.lineUrl);
    expect(talk.querySelector('a[href="/industries"]')).not.toBeNull();
    expect(talk.querySelector('a[href="/why-core"]')).not.toBeNull();
  });

  it('makes no invented claims and never describes the office as a home', async () => {
    await open();
    const text = main().cloneNode(true) as HTMLElement;
    // The trust list names what is NOT shown ("no awards or certifications").
    text.querySelector('[data-trust]')?.remove();
    expect(text.textContent).not.toMatch(INVENTED);
    expect(main().textContent).not.toMatch(HOME);
  });
});

/* ------------------------------------------------------------------ */

describe('reduced motion', () => {
  it('shows the hero transformation in its final state', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open();
    // The final, calm composition: departments and one CORE state; the
    // loose fragments have been gathered into them.
    const scene = document.querySelector<HTMLElement>('[data-scene="hero"]')!;
    expect(scene).toHaveAttribute('data-stage', 'core');
    expect(scene.querySelector<HTMLElement>('[data-core-state]')!.style.opacity).toBe('1');
    for (const chip of scene.querySelectorAll<HTMLElement>('[data-chip]')) {
      expect(chip.style.opacity).toBe('1');
    }
    for (const f of scene.querySelectorAll<HTMLElement>('[data-fragment]')) {
      expect(f.style.opacity).toBe('0');
    }
    expect(document.querySelector('[data-hero-stages] [aria-current="step"]')).toHaveTextContent(
      'หนึ่งสถานะใน CORE',
    );
    // Every manifesto line is already locked; nothing waits on scrolling.
    expect(document.querySelectorAll('[data-manifesto] [data-locked]')).toHaveLength(7);
  });
});

describe('localization and links', () => {
  it('renders English without Thai, keeping the legal name international', async () => {
    await open('/en/about');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'how an organization really works',
    );
    expect(main()).toHaveTextContent(COMPANY.legalName);
    expect(main()).not.toHaveTextContent(COMPANY.legalNameTh);
    expect(visibleText()).not.toMatch(THAI);
  });

  it('renders Simplified Chinese without Thai or Traditional characters', async () => {
    await open('/zh/about');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('组织实际上如何运作');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(TRADITIONAL);
    expect(main()).toHaveTextContent(`${CONTACT.phone.display} (Khun Win)`);
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/about', '/en/about', '/zh/about']) {
      const { unmount } = await open(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it('keeps the locale in every page link', async () => {
    await open('/zh/about');
    for (const href of [
      '/zh/contact?interest=consulting',
      '/zh/why-core',
      '/zh/solutions',
      '/zh/how-core-works',
      '/zh/enterprise#implementation',
      '/zh/industries',
    ]) {
      expect(main().querySelector(`a[href="${href}"]`), href).not.toBeNull();
    }
  });

  it('links the About mega menu to /about, /why-core, #approach and #consulting', async () => {
    for (const [path, prefix, label] of [
      ['/', '', 'เกี่ยวกับเรา'],
      ['/en', '/en', 'About'],
    ] as const) {
      const { unmount } = renderRoute(path);
      const nav = await screen.findByRole('navigation', {
        name: prefix ? 'Main navigation' : 'เมนูหลัก',
      });
      await userEvent.click(within(nav).getByRole('button', { name: label }));
      for (const to of ['/about', '/why-core', '/about#approach', '/about#consulting']) {
        expect(document.querySelector(`header a[href="${prefix}${to}"]`), to).not.toBeNull();
      }
      expect(document.querySelector('header a[href="/#trust"]')).toBeNull();
      unmount();
    }
  });

  it('a mega-menu link opens the consulting section', async () => {
    const { router } = renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    await userEvent.click(within(nav).getByRole('button', { name: 'เกี่ยวกับเรา' }));
    const panel = screen.getByRole('region', { name: 'เมนูเกี่ยวกับเรา' });
    await userEvent.click(within(panel).getByRole('link', { name: /ที่ปรึกษา/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/about'));
    expect(router.state.location.hash).toBe('#consulting');
    expect(
      await screen.findByRole('heading', { level: 2, name: /เราช่วยทำความเข้าใจการทำงาน/ }),
    ).toBeInTheDocument();
  }, 15000);

  it('makes the homepage Trust links real, in every locale', async () => {
    for (const prefix of ['', '/en', '/zh']) {
      const { unmount } = renderRoute(prefix || '/');
      await screen.findByRole('heading', { level: 1 });
      for (const to of ['/about', '/why-core', '/contact']) {
        expect(document.querySelector(`#trust a[href="${prefix}${to}"]`), to).not.toBeNull();
      }
      unmount();
    }
  });
});

/* ------------------------------------------------------------------ */
/* EP13 — signature scenes                                              */
/* ------------------------------------------------------------------ */

describe('signature scenes (EP13)', () => {
  it('the design table moves through the methodology and asks the stage question', async () => {
    await open();
    const approach = section('approach');
    const table = approach.querySelector('[data-design-table]')!;
    expect(table.querySelector('[data-zone="notes"]')).toHaveAttribute('data-zone-state', 'active');
    expect(table.querySelector('[data-zone="screen"]')).toHaveAttribute('data-zone-state', 'ahead');
    expect(approach.querySelector('[data-question]')).toHaveTextContent(
      'วันนี้งานเดินอย่างไรจริง ๆ?',
    );

    await userEvent.click(within(approach).getByRole('button', { name: /หาจุดที่มักผิดพลาด/ }));
    expect(approach.querySelector('[data-question]')).toHaveTextContent('ตรงไหนผิดได้ง่าย?');
    expect(approach.querySelector('[data-output]')).toHaveTextContent('รายการจุดเสี่ยง');
    expect(table.querySelector('[data-zone="notes"]')).toHaveAttribute('data-zone-state', 'done');
    expect(table.querySelector('[data-zone="map"]')).toHaveAttribute('data-zone-state', 'active');

    await userEvent.click(within(approach).getByRole('button', { name: 'ขั้นถัดไป' }));
    expect(approach.querySelector('[data-question]')).toHaveTextContent('อะไรต้องเกิดก่อน/หลัง?');
    await userEvent.click(within(approach).getByRole('button', { name: /ออกแบบหน้าจอ/ }));
    expect(approach.querySelector('[data-question]')).toHaveTextContent(
      'ผู้ใช้ต้องเห็นอะไรตอนนี้?',
    );
    expect(table.querySelector('[data-zone="screen"]')).toHaveAttribute(
      'data-zone-state',
      'active',
    );
    const pressed = approach.querySelectorAll('[data-step] button[aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
  });

  it('the defense rings stop the work item at the chosen layer', async () => {
    await open();
    const he = document.querySelector<HTMLElement>('[data-human-error]')!;
    const defense = he.querySelector('[data-defense]')!;
    expect(defense).toHaveAttribute('data-selected', 'guide');
    expect(he.querySelector('[data-defense-detail]')).toHaveTextContent('FEFO');
    await userEvent.click(within(he).getByRole('button', { name: /ควบคุม/ }));
    expect(defense).toHaveAttribute('data-selected', 'control');
    expect(within(he).getByRole('button', { name: /ควบคุม/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(he.querySelector('[data-defense-detail]')).toHaveTextContent(
      'ปรับยอดสต็อกโดยไม่มีผู้อนุมัติ',
    );
    expect(he).toHaveTextContent('ไม่ใช่การรับประกัน');
  });

  it('the work table shows what each side contributes to the chosen topic', async () => {
    await open();
    const consulting = section('consulting');
    const table = consulting.querySelector<HTMLElement>('[data-work-table]')!;
    expect(table.querySelectorAll('[data-artifact]')).toHaveLength(5);
    expect(table.querySelector('[data-contribution="us"]')).toHaveTextContent('Process Mapping');
    await userEvent.click(within(table).getByRole('button', { name: /การควบคุม/ }));
    expect(table).toHaveAttribute('data-topic', 'controls');
    expect(table.querySelector('[data-contribution="org"]')).toHaveTextContent(
      'กฎและเงื่อนไขที่ต้องรักษา',
    );
    expect(table.querySelector('[data-contribution="us"]')).toHaveTextContent(
      'ออกแบบเงื่อนไขและการอนุมัติ',
    );
    expect(table.querySelector('[data-contribution="core"]')).toHaveTextContent(
      'กฎธุรกิจและสายอนุมัติ',
    );
  });

  it('keeps every approved story element in the page text without any motion', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open();
    const text = main().textContent ?? '';
    for (const s of [
      ...PRINCIPLES.map((p) => ABOUT.th.belief.principles[p].body),
      ...SYMPTOMS.map((p) => ABOUT.th.problem.symptoms[p].title),
      ...METHOD_STEPS.map((p) => ABOUT.th.approach.steps[p].body),
      ...EXCHANGE.map((e) => ABOUT.th.consulting.exchange[e].core),
      ...IMPLEMENTATION.map((i) => ABOUT.th.implementation.steps[i]),
      ...LAYERS.map((l) => ABOUT.th.longTerm.layers[l].title),
      ABOUT.th.consulting.boundary,
      CONTACT.address,
    ]) {
      expect(text, s).toContain(s);
    }
    // Implementation steps are all reached, the stack is assembled.
    expect(document.querySelectorAll('[data-implementation-step][data-reached]')).toHaveLength(9);
  });

  it('marks each chapter with a ghost number and a system notation', async () => {
    await open();
    expect(main().querySelectorAll('[data-ghost-number]').length).toBeGreaterThanOrEqual(8);
    expect(section('approach').querySelector('[data-notation]')).toHaveTextContent('fig. 05');
  });

  it('publishes factual Organization structured data only', async () => {
    const { unmount } = await open();
    const script = document.head.querySelector('script[data-schema="organization"]')!;
    const data = JSON.parse(script.textContent!);
    expect(data['@type']).toBe('Organization');
    expect(data.legalName).toBe(COMPANY.legalName);
    expect(data.alternateName).toContain(COMPANY.legalNameTh);
    expect(data.address.streetAddress).toBe(CONTACT.address);
    expect(data.telephone).toBe(CONTACT.phone.e164);
    expect(data.email).toBe(CONTACT.email);
    expect(data.sameAs).toEqual([CONTACT.lineUrl]);
    for (const k of ['logo', 'geo', 'foundingDate', 'numberOfEmployees', 'aggregateRating']) {
      expect(data, k).not.toHaveProperty(k);
    }
    unmount();
    expect(document.head.querySelector('script[data-schema="organization"]')).toBeNull();
  });
});

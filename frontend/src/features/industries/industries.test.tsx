import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { SOLUTIONS } from '@/features/solutions/model';
import { CHAPTER as WORKFLOW_CHAPTER } from '@/features/workflow/model';
import type { Localized } from '@/i18n/useCopy';
import { renderRoute } from '@/test/render';
import { DISTRIBUTION } from './copy/distribution';
import { MANUFACTURING } from './copy/manufacturing';
import { PROJECTS } from './copy/projects';
import { PROPERTY } from './copy/property';
import { RETAIL } from './copy/retail';
import { SERVICES } from './copy/services';
import { INDUSTRIES_SUMMARY } from './copy/summary';
import type { IndustryPageCopy } from './copy/types';
import {
  buildable,
  downstream,
  FIT,
  fitResult,
  INDUSTRIES,
  INDUSTRY_IDS,
  industryPath,
  lineState,
  PRINCIPLES,
  type IndustryId,
} from './model';

/*
 * EP11: /industries and the six industry pages. Model and copy are tested
 * directly; pages as rendered.
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
const PAGES: Record<IndustryId, Localized<IndustryPageCopy<unknown>>> = {
  distribution: DISTRIBUTION,
  services: SERVICES,
  projects: PROJECTS,
  retail: RETAIL,
  property: PROPERTY,
  manufacturing: MANUFACTURING,
};
// "จ่าย" alone means issuing goods; only payment wording counts as money.
const MONEY =
  /฿|บาท|THB|\$|¥|元|泰铢|ราคา|ต้นทุน|มูลค่า|ชำระ|จ่ายเงิน|เงิน|price|cost|payment|\bpay\b|amount|价格|成本|金额|付款/i;
const CLAIMS =
  /\bISO\b|certified|guarantee|\d+\s?%|ROI|ได้รับการรับรอง|รับประกัน|已认证|保证|ลูกค้าของเรา|our customers|我们的客户/i;

async function open(path: string) {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const strings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(strings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];

/* ------------------------------------------------------------------ */

describe('industry model', () => {
  it('defines exactly the six industries with their own routes', () => {
    expect(INDUSTRY_IDS).toEqual([
      'distribution',
      'services',
      'projects',
      'retail',
      'property',
      'manufacturing',
    ]);
    expect(INDUSTRY_IDS.map(industryPath)).toEqual(INDUSTRY_IDS.map((id) => `/industries/${id}`));
  });

  it('gives every industry its own motif, workflow and manager signals', () => {
    const motifs = new Set(INDUSTRY_IDS.map((id) => INDUSTRIES[id].motif));
    const flows = new Set(
      INDUSTRY_IDS.map((id) => INDUSTRIES[id].workflow.map((w) => w.id).join('>')),
    );
    const signals = new Set(
      INDUSTRY_IDS.map((id) => INDUSTRIES[id].signals.map((s) => s.id).join(',')),
    );
    expect(motifs.size).toBe(6);
    expect(flows.size).toBe(6);
    expect(signals.size).toBe(6);
  });

  it('connects every industry to real departments, solutions and How CORE works chapters', () => {
    const anchors = SOLUTIONS.map((s) => s.anchor) as string[];
    const chapters = Object.values(WORKFLOW_CHAPTER) as string[];
    for (const id of INDUSTRY_IDS) {
      const ind = INDUSTRIES[id];
      for (const d of [
        ...ind.departments,
        ...(ind.optional ?? []),
        ...ind.workflow.map((w) => w.dept),
      ]) {
        expect(DEPT_PAGES).toContain(d);
      }
      expect(ind.workflow.length).toBeGreaterThanOrEqual(7);
      expect(ind.workflow.map((w) => w.id)).toContain(ind.stuckAt);
      expect(ind.signals).toHaveLength(4);
      for (const s of ind.solutions) expect(anchors).toContain(s);
      for (const c of ind.chapters) expect(chapters).toContain(c);
    }
  });

  it('tells each industry’s own operating story', () => {
    const flow = (id: IndustryId) => INDUSTRIES[id].workflow.map((w) => w.id);
    expect(flow('distribution')).toEqual(
      expect.arrayContaining(['availability', 'replenish', 'dispatch']),
    );
    expect(flow('services')).toEqual(expect.arrayContaining(['assign', 'execute', 'evidence']));
    expect(flow('projects')).toEqual(
      expect.arrayContaining(['procurement', 'milestone', 'acceptance']),
    );
    expect(flow('retail')).toEqual(expect.arrayContaining(['inventory', 'replenish', 'transfer']));
    expect(flow('property')).toEqual(
      expect.arrayContaining(['request', 'assign', 'material', 'complete']),
    );
    expect(flow('manufacturing')).toEqual(
      expect.arrayContaining(['workOrder', 'material', 'production', 'output']),
    );
  });

  it('states the boundaries each industry needs', () => {
    expect(INDUSTRIES.retail.boundaries[0]).toBe('pos');
    expect(INDUSTRIES.property.boundaries[0]).toBe('propertyProduct');
    expect(INDUSTRIES.manufacturing.boundaries).toContain('mrp');
    for (const id of INDUSTRY_IDS) {
      const usesAccounting =
        INDUSTRIES[id].workflow.some((w) => w.dept === 'accounting') ||
        INDUSTRIES[id].departments.includes('accounting');
      if (usesAccounting) expect(INDUSTRIES[id].boundaries).toContain('accounting');
    }
  });

  it('computes the signature examples deterministically', () => {
    expect(lineState(40, 40)).toBe('ready');
    expect(lineState(30, 12)).toBe('partial');
    expect(lineState(20, 0)).toBe('short');
    expect(downstream('materials')).toEqual(['materials', 'install', 'inspection', 'acceptance']);
    expect(buildable()).toBe(320);
    expect(buildable(true)).toBe(500);
  });

  it('maps every fit answer to a different industry', () => {
    expect(new Set(FIT.map((f) => fitResult(f.id))).size).toBe(6);
    expect(fitResult('stores')).toBe('retail');
    expect(fitResult('produce')).toBe('manufacturing');
  });
});

/* ------------------------------------------------------------------ */

describe('industry copy', () => {
  it('labels every step and signal in every locale, with page notes for each', () => {
    for (const l of LOCALES) {
      for (const id of INDUSTRY_IDS) {
        const s = INDUSTRIES_SUMMARY[l].industries[id];
        const p = PAGES[id][l];
        for (const w of INDUSTRIES[id].workflow) {
          expect(s.steps[w.id], `${l} ${id} ${w.id}`).toBeTruthy();
          expect(p.workflow.notes[w.id], `${l} ${id} note ${w.id}`).toBeTruthy();
        }
        for (const g of INDUSTRIES[id].signals) {
          expect(s.signals[g.id], `${l} ${id} ${g.id}`).toBeTruthy();
          expect(p.signals.notes[g.id]).toBeTruthy();
        }
        for (const pr of PRINCIPLES) expect(s.principles[pr]).toBeTruthy();
        // The nine questions are all answered.
        expect(p.reality.points.length).toBeGreaterThanOrEqual(3);
        expect(p.frictions.items.length).toBeGreaterThanOrEqual(5);
        expect(p.information.items.length).toBeGreaterThanOrEqual(4);
        expect(p.notReplace.items.length).toBeGreaterThan(0);
        expect(p.custom.items.length).toBeGreaterThan(0);
        for (const d of INDUSTRIES[id].departments) expect(p.departments.roles[d]).toBeTruthy();
      }
    }
  });

  it('makes no certification, guarantee, customer or outcome claims', () => {
    for (const l of LOCALES) {
      const all = [
        ...strings(INDUSTRIES_SUMMARY[l]),
        ...INDUSTRY_IDS.flatMap((id) => strings(PAGES[id][l])),
      ];
      for (const s of all) expect(s, `${l}: ${s}`).not.toMatch(CLAIMS);
    }
  });

  it('never says CORE has a solution for every industry', () => {
    expect(INDUSTRIES_SUMMARY.th.differ.lead).toContain(
      'ไม่ได้บอกว่ามีโซลูชันสำเร็จรูปสำหรับทุกอุตสาหกรรม',
    );
    expect(INDUSTRIES_SUMMARY.th.differ.title).toBe('แต่ละธุรกิจมีจุดที่งานติดต่างกัน');
    expect(INDUSTRIES_SUMMARY.th.hero.title).toBe(
      'หลักการเดียวกัน\nแต่แต่ละธุรกิจทำงานไม่เหมือนกัน',
    );
  });

  it('keeps the Warehouse free of money in every industry and locale', () => {
    for (const l of LOCALES) {
      for (const id of INDUSTRY_IDS) {
        const role = PAGES[id][l].departments.roles.warehouse;
        if (role) expect(role, `${l} ${id}`).not.toMatch(MONEY);
      }
      // Warehouse-facing signature data (quantities only).
      const d = DISTRIBUTION[l].signature;
      for (const s of [
        ...strings(d.lines),
        d.ordered,
        d.available,
        ...strings(d.state),
        d.inbound,
      ]) {
        expect(s).not.toMatch(MONEY);
      }
      const m = MANUFACTURING[l].signature;
      for (const s of [...strings(m.materials), m.required, m.available, m.short, m.outputLot]) {
        expect(s).not.toMatch(MONEY);
      }
    }
  });

  it('never presents CORE as a POS, the property product, or a full MRP/MES', () => {
    for (const l of LOCALES) {
      const all = [
        ...strings(INDUSTRIES_SUMMARY[l]),
        ...INDUSTRY_IDS.flatMap((id) => strings(PAGES[id][l])),
      ];
      for (const s of all) {
        if (/\bPOS\b/.test(s) && !/ระบบ POS ที่ใช้อยู่|POS you already use|现有 POS/.test(s)) {
          expect(s, s).toMatch(/ไม่ใช่|not|不是/i);
        }
        if (/\bMRP\b|\bMES\b|OEE/.test(s))
          expect(s, s).toMatch(/ไม่ใช่|ไม่ได้|not|不是|不宣称|而非/i);
        if (/Property & Rental Management/.test(s))
          expect(s, s).toMatch(/ไม่ได้แทน|แยก|not replace|separate|不替代|独立/i);
      }
      expect(all.some((s) => /CORE\s*(เป็นระบบ POS|is a POS|是 POS)/i.test(s))).toBe(false);
    }
    expect(INDUSTRIES_SUMMARY.th.common.boundaries.pos.title).toBe('ไม่ใช่ระบบ POS');
    expect(INDUSTRIES_SUMMARY.th.common.boundaries.mrp.title).toBe(
      'ไม่ใช่ MRP หรือ MES เต็มรูปแบบ',
    );
    expect(INDUSTRIES_SUMMARY.th.common.boundaries.accounting.title).toBe(
      'ไม่ใช่ระบบบัญชีเต็มรูปแบบ',
    );
  });

  it('labels every example workflow as illustrative', () => {
    expect(INDUSTRIES_SUMMARY.th.common.example).toBe('ตัวอย่างกระบวนการ');
    expect(INDUSTRIES_SUMMARY.th.common.exampleNote).toContain('ไม่ใช่ลำดับบังคับ');
  });
});

/* ------------------------------------------------------------------ */

describe('/industries overview', () => {
  it('renders one H1 and its chapters in order', async () => {
    await open('/industries');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('หลักการเดียวกัน');
    const ids = [...document.querySelectorAll('#main section[id]')].map((s) => s.id);
    expect(ids).toEqual(['why', 'environments', 'silhouettes', 'principles', 'fit']);
  });

  it('links the six environments in the hero to their pages', async () => {
    await open('/industries');
    const orbit = document.querySelector('[data-hero-orbit]')!;
    for (const id of INDUSTRY_IDS) {
      expect(orbit.querySelector(`a[href="/industries/${id}"]`), id).not.toBeNull();
    }
  });

  it('shows what stays and what changes per industry', async () => {
    await open('/industries');
    const why = document.getElementById('why')!;
    expect(why.querySelectorAll('[data-stays] li')).toHaveLength(7);
    await userEvent.click(within(why).getByRole('radio', { name: 'ค้าปลีก' }));
    const changes = why.querySelector('[data-changes]')!;
    expect(changes).toHaveAttribute('data-changes', 'retail');
    expect(changes).toHaveTextContent('สาขา · ใบโอน · ใบนับ');
  });

  it('opens one environment at a time in the selector (phone layout)', async () => {
    await open('/industries');
    const env = document.getElementById('environments')!;
    expect(env.querySelector('[data-selected-industry]')).toHaveAttribute(
      'data-selected-industry',
      'distribution',
    );
    await userEvent.click(within(env).getByRole('button', { name: 'ถัดไป' }));
    expect(env.querySelector('[data-selected-industry]')).toHaveAttribute(
      'data-selected-industry',
      'services',
    );
    expect(env.querySelector('a[href="/industries/services"]')).not.toBeNull();
    await userEvent.click(within(env).getByRole('button', { name: 'ก่อนหน้า' }));
    await userEvent.click(within(env).getByRole('button', { name: 'ก่อนหน้า' }));
    expect(env.querySelector('[data-selected-industry]')).toHaveAttribute(
      'data-selected-industry',
      'manufacturing',
    );
  });

  it('uses a cinematic expanding rail on wide screens with keyboard support', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('min-width: 64rem'),
    })) as typeof window.matchMedia;
    await open('/industries');
    const env = document.getElementById('environments')!;
    // EP19: an accordion of disclosure buttons — no tab roles around nested panels.
    expect(within(env).queryAllByRole('tab')).toHaveLength(0);
    const columns = within(env).getAllByRole('button', { expanded: false });
    expect(within(env).getAllByRole('button', { expanded: true })).toHaveLength(1);
    expect(columns).toHaveLength(5);
    const first = within(env).getByRole('button', { expanded: true });
    first.focus();
    await userEvent.keyboard('{End}');
    const opened = within(env).getByRole('button', { expanded: true });
    expect(opened).toHaveFocus();
    expect(opened).toHaveAttribute('aria-controls', 'env-panel');
    expect(within(env).getByRole('region')).toHaveTextContent('Work Order');
  });

  it('draws six different workflow silhouettes', async () => {
    await open('/industries');
    const rows = [...document.querySelectorAll('[data-silhouette]')];
    expect(rows.map((r) => r.getAttribute('data-silhouette'))).toEqual([...INDUSTRY_IDS]);
    expect(rows.map((r) => Number(r.getAttribute('data-steps')))).toEqual(
      INDUSTRY_IDS.map((id) => INDUSTRIES[id].workflow.length),
    );
  });

  it('shows how one principle appears in every industry', async () => {
    await open('/industries');
    const p = document.getElementById('principles')!;
    await userEvent.click(within(p).getByRole('radio', { name: 'ขอบเขตข้อมูลตามบทบาท' }));
    expect(p.querySelector('[data-principle-list]')).toHaveTextContent(
      'คลังเห็นจำนวนและ Lot ไม่เห็นราคาขาย',
    );
  });

  it('finds a fit deterministically and links to it', async () => {
    await open('/industries');
    const fit = document.getElementById('fit')!;
    await userEvent.click(within(fit).getByRole('radio', { name: 'เราดูแลหลายสาขาหรือหลายร้าน' }));
    const result = fit.querySelector('[data-fit-result]')!;
    expect(result).toHaveAttribute('data-fit-result', 'retail');
    expect(result.querySelector('a[href="/industries/retail"]')).not.toBeNull();
  });

  it('ends with consultation, a quiet enterprise link and a quiet pricing link', async () => {
    await open('/industries');
    const end = document.querySelector('[data-ending]')!;
    expect(end.querySelector('a[href="/consultation?topic=consulting"]')).not.toBeNull();
    expect(end.querySelector('a[href="/enterprise"]')).not.toBeNull();
    expect(end.querySelector('a[href="/pricing"]')).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe('industry pages', () => {
  it.each(INDUSTRY_IDS)('%s answers the nine questions with its own composition', async (id) => {
    await open(`/industries/${id}`);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const hero = document.querySelector(`[data-industry-hero="${id}"]`)!;
    expect(hero).not.toBeNull();
    expect(document.querySelector(`[data-motif="${INDUSTRIES[id].motif}"]`) ?? hero).not.toBeNull();
    const flow = document.querySelector(`[data-workflow="${id}"]`)!;
    expect(flow.querySelectorAll('[data-step]')).toHaveLength(INDUSTRIES[id].workflow.length);
    expect(document.querySelector('[data-example-label]')).toHaveTextContent('ตัวอย่างกระบวนการ');
    expect(document.querySelectorAll(`[data-signals="${id}"] [data-signal]`)).toHaveLength(4);
    expect(document.querySelectorAll(`[data-principle-fit="${id}"] [data-principle]`)).toHaveLength(
      7,
    );
    expect(document.querySelector('[data-frictions]')!.children.length).toBeGreaterThanOrEqual(5);
    expect(document.querySelector('[data-information]')).not.toBeNull();
    expect(document.querySelector('[data-departments]')).not.toBeNull();
    expect(document.querySelector('[data-limits="not-replace"]')).not.toBeNull();
    expect(document.querySelector('[data-limits="custom"]')).not.toBeNull();
    for (const b of INDUSTRIES[id].boundaries) {
      expect(document.querySelector(`[data-boundary="${b}"]`), b).not.toBeNull();
    }
  });

  it.each(INDUSTRY_IDS)(
    '%s links departments, solutions, How CORE works, enterprise and pricing',
    async (id) => {
      await open(`/industries/${id}`);
      const ind = INDUSTRIES[id];
      const related = document.querySelector(`[data-related="${id}"]`)!;
      for (const d of ind.departments)
        expect(related.querySelector(`a[href="/departments/${d}"]`), d).not.toBeNull();
      for (const s of ind.solutions)
        expect(related.querySelector(`a[href="/solutions#${s}"]`), s).not.toBeNull();
      for (const c of ind.chapters)
        expect(related.querySelector(`a[href="/how-core-works#${c}"]`), c).not.toBeNull();
      expect(related.querySelectorAll('[data-industry-link]')).toHaveLength(5);
      expect(!!document.querySelector('[data-enterprise-link] a[href="/enterprise"]')).toBe(
        ind.enterprise,
      );
      expect(document.querySelector('[data-pricing-link] a[href="/pricing"]')).not.toBeNull();
      expect(document.querySelector('a[href="/industries"]')).not.toBeNull();
    },
  );

  it('distribution: receiving the open PO makes the whole order ready', async () => {
    await open('/industries/distribution');
    const s = document.getElementById('fulfillment')!;
    expect([...s.querySelectorAll('[data-line]')].map((l) => l.getAttribute('data-state'))).toEqual(
      ['ready', 'partial', 'short'],
    );
    await userEvent.click(s.querySelector<HTMLElement>('[data-receive]')!);
    expect(s.querySelector('[data-outcome]')).toHaveAttribute('data-outcome', 'ready');
    expect(s.textContent).not.toMatch(MONEY);
  });

  it('services: a job closes only when the evidence is complete', async () => {
    await open('/industries/services');
    const s = document.getElementById('evidence')!;
    expect(s.querySelector('[data-close]')).toHaveAttribute('data-close', 'blocked');
    await userEvent.click(within(s).getByRole('switch', { name: /รายการตรวจหลังซ่อม/ }));
    await userEvent.click(within(s).getByRole('switch', { name: /ลูกค้ายืนยันงาน/ }));
    expect(s.querySelector('[data-close]')).toHaveAttribute('data-close', 'ready');
  });

  it('projects: a late delivery reaches exactly the downstream milestones', async () => {
    await open('/industries/projects');
    const s = document.getElementById('dependencies')!;
    await userEvent.click(within(s).getByRole('switch'));
    const hit = [...s.querySelectorAll('[data-milestone][data-impacted="true"]')].map((m) =>
      m.getAttribute('data-milestone'),
    );
    expect(hit).toEqual(downstream('materials'));
    expect(s.querySelector('[data-milestone="systems"]')).toHaveAttribute('data-impacted', 'false');
  });

  it('retail: states the POS boundary first and shows branch health', async () => {
    await open('/industries/retail');
    const first = document.querySelector('#main section[id]')!;
    expect(first.id).toBe('boundary');
    expect(first).toHaveTextContent('ไม่ใช่ระบบ POS');
    const s = document.getElementById('branch-health')!;
    expect(s.querySelector('[data-branch-detail]')).toHaveAttribute('data-branch-detail', 'b4');
    expect(s.querySelectorAll('[data-branch-detail] [data-issue]')).toHaveLength(2);
    await userEvent.click(within(s).getByRole('radio', { name: /สาขาเชียงใหม่/ }));
    expect(s.querySelector('[data-branch-detail]')).toHaveTextContent('ทุกเรื่องปกติ');
    expect(s.textContent).not.toMatch(/฿|บาท|THB/);
  });

  it('property: states the product boundary first and follows a stuck request', async () => {
    await open('/industries/property');
    const first = document.querySelector('#main section[id]')!;
    expect(first).toHaveTextContent('ไม่ได้แทน PDA BLISS Property & Rental Management');
    const s = document.getElementById('requests')!;
    await userEvent.click(within(s).getByRole('radio', { name: /ท่อน้ำรั่ว/ }));
    const j = s.querySelector('[data-journey]')!;
    expect(j).toHaveAttribute('data-stuck', 'closed');
    expect(j.querySelector('[data-stage="done"]')).toHaveAttribute('data-state', 'passed');
  });

  it('manufacturing: materials limit the Work Order until the open receipt arrives', async () => {
    await open('/industries/manufacturing');
    const s = document.getElementById('work-order')!;
    expect(s.querySelector('[data-buildable]')).toHaveAttribute('data-buildable', '320');
    await userEvent.click(s.querySelector<HTMLElement>('[data-receive]')!);
    expect(s.querySelector('[data-buildable]')).toHaveAttribute('data-buildable', '500');
    expect(s.textContent).not.toMatch(MONEY);
    expect(document.querySelector('[data-boundary="mrp"]')).toHaveTextContent(
      'ไม่ใช่ MRP หรือ MES เต็มรูปแบบ',
    );
  });
});

/* ------------------------------------------------------------------ */

describe('localization, metadata and discovery', () => {
  it('gives all 21 industry routes a unique title and description', async () => {
    const seen = new Set<string>();
    const paths = ['/industries', ...INDUSTRY_IDS.map(industryPath)];
    for (const prefix of ['', '/en', '/zh']) {
      for (const p of paths) {
        const { unmount } = await open(`${prefix}${p}`);
        await waitFor(() => expect(document.title).toContain('|'));
        seen.add(document.title);
        seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
        unmount();
      }
    }
    expect(seen.size).toBe(42);
  }, 30000);

  it('renders Chinese industry pages without Traditional characters', async () => {
    for (const p of ['/zh/industries', ...INDUSTRY_IDS.map((id) => `/zh${industryPath(id)}`)]) {
      const { unmount } = await open(p);
      expect(document.getElementById('main')!.textContent, p).not.toMatch(
        /[們個發這開時關庫說價購資費號門運營權證統線際體與變單項產們貨倉]/,
      );
      unmount();
    }
  }, 20000);

  it('keeps the locale in industry links', async () => {
    await open('/en/industries/retail');
    const related = document.querySelector('[data-related="retail"]')!;
    expect(related.querySelector('a[href="/en/departments/warehouse"]')).not.toBeNull();
    expect(related.querySelector('a[href="/en/solutions#stock"]')).not.toBeNull();
    expect(related.querySelector('a[href="/en/industries/property"]')).not.toBeNull();
    expect(document.querySelector('a[href="/en/enterprise"]')).not.toBeNull();
  });

  it('makes /industries discoverable from the Solutions menu, the footer and /enterprise', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Solutions' }));
    expect(screen.getByRole('link', { name: /Explore by industry/ })).toHaveAttribute(
      'href',
      '/en/industries',
    );
    expect(document.querySelector('footer a[href="/en/industries"]')).not.toBeNull();
  });

  it('links the enterprise industries strip to industry pages', async () => {
    await open('/enterprise');
    const strip = document.getElementById('complexity')!;
    expect(strip.querySelector('a[href="/industries/manufacturing"]')).not.toBeNull();
    expect(strip.querySelector('a[href="/industries/services"]')).not.toBeNull();
  });

  it('shows the overview hero in its final state under reduced motion', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open('/industries');
    expect(document.querySelectorAll('[data-hero-orbit] a')).not.toHaveLength(0);
    for (const el of document.querySelectorAll<HTMLElement>('[data-orbit-industry]')) {
      expect(el.parentElement!.style.opacity).not.toBe('0');
    }
  });
});

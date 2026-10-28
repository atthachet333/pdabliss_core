import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { PLANS } from '@/features/pricing/plans';
import { SOLUTIONS } from '@/features/solutions/model';
import { CHAPTER as WORKFLOW_CHAPTER } from '@/features/workflow/model';
import { renderRoute } from '@/test/render';
import { ENTERPRISE } from './copy';
import {
  ACCESS_ROLES,
  APPROVAL_RAILS,
  buildProcess,
  CHAPTER,
  CLAIM_STATUSES,
  CONTROLS,
  CROSS_LINKS,
  JOURNEY,
  MONEY_FIELDS,
  PHASES,
  READINESS,
  ROLE_VISIBILITY,
  WORK_FIELDS,
} from './model';

/*
 * EP10: /enterprise — the same CORE philosophy with stronger organizational
 * controls. The model and copy are tested directly; the page as rendered.
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
const ORDER = [
  'complexity',
  'organization',
  'access',
  'control',
  'audit',
  'executive',
  'workflow',
  'integration',
  'branches',
  'implementation',
  'support',
  'readiness',
  'consult',
];
// Certifications, compliance, uptime and guarantees are never claimed.
const FORBIDDEN =
  /\bISO\b|SOC ?2|\bPCI\b|HIPAA|\bGDPR\b|\bcertified\b|guarantee|uptime|99\.\d|ได้รับการรับรอง|รับประกันเวลา|已认证|通过认证|保证/i;
// Published response times or money thresholds have no place here.
const RESPONSE_TIME = /\d+\s?(ชั่วโมง|นาที|hours?|minutes?|小时|分钟)|24\/7/i;
const MONEY_VALUE = /฿|บาท|THB|\$|¥|元|泰铢|\d[\d,]*\s?(k|m|ล้าน|万)/i;

async function open(path = '/enterprise') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const section = (id: string) => document.getElementById(id)!;
const allStrings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(allStrings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(allStrings)
        : [];

describe('enterprise model', () => {
  it('defines thirteen chapters, including every mega-menu anchor', () => {
    expect(Object.values(CHAPTER)).toEqual(ORDER);
    for (const a of ['access', 'audit', 'workflow', 'integration', 'implementation']) {
      expect(ORDER).toContain(a);
    }
  });

  it('never shows money to the Warehouse', () => {
    const wh = ROLE_VISIBILITY.warehouse;
    for (const f of MONEY_FIELDS) expect(wh).not.toContain(f);
    expect(wh).toEqual(expect.arrayContaining(['quantity', 'lot', 'location', 'expiry']));
  });

  it('keeps configuration with the System admin only — Executive is not Admin', () => {
    expect(ROLE_VISIBILITY.admin).toEqual(['config']);
    for (const r of ACCESS_ROLES.filter((r) => r !== 'admin')) {
      expect(ROLE_VISIBILITY[r]).not.toContain('config');
    }
    expect(ROLE_VISIBILITY.executive).toEqual(expect.arrayContaining(['state', 'risk']));
    // Every role sees a subset of one shared object.
    for (const r of ACCESS_ROLES) {
      for (const f of ROLE_VISIBILITY[r]) expect(WORK_FIELDS).toContain(f);
    }
  });

  it('models simple, advanced and conditional approval without money thresholds', () => {
    expect(APPROVAL_RAILS.map((r) => r.id)).toEqual(['simple', 'advanced', 'conditional']);
    expect(APPROVAL_RAILS[1]!.steps).toEqual([
      'request',
      'manager',
      'finance',
      'executive',
      'continue',
    ]);
    expect(APPROVAL_RAILS[2]!.steps).toContain('condition');
    for (const l of LOCALES) {
      const c = ENTERPRISE[l].control;
      expect(c.conditionNote).not.toMatch(MONEY_VALUE);
      expect(allStrings(c.rails).join(' ')).not.toMatch(MONEY_VALUE);
    }
  });

  it('labels every control and readiness layer with a known status', () => {
    for (const x of [...CONTROLS, ...READINESS]) expect(CLAIM_STATUSES).toContain(x.status);
    expect(CONTROLS.find((x) => x.id === 'escalation')!.status).toBe('planned');
    expect(READINESS).toHaveLength(8);
    expect(READINESS.some((x) => x.status === 'planned')).toBe(true);
  });

  it('adapts the process deterministically', () => {
    expect(buildProcess(new Set())).toEqual([
      'request',
      'review',
      'warehouse',
      'purchasing',
      'done',
    ]);
    expect(buildProcess(new Set(['sequence']))).toEqual([
      'request',
      'review',
      'purchasing',
      'warehouse',
      'done',
    ]);
    expect(buildProcess(new Set(['approval', 'exception', 'notify']))).toEqual([
      'request',
      'review',
      'approval',
      'warehouse',
      'purchasing',
      'exception',
      'notify',
      'done',
    ]);
  });

  it('walks the implementation journey in ten steps across six phases, in order', () => {
    expect(JOURNEY).toHaveLength(10);
    const phaseIndex = JOURNEY.map((j) => PHASES.indexOf(j.phase));
    expect([...phaseIndex].sort((a, b) => a - b)).toEqual(phaseIndex);
    for (const p of PHASES) expect(JOURNEY.some((j) => j.phase === p)).toBe(true);
  });

  it('links into Solutions, How CORE works and departments that exist', () => {
    const solutions = SOLUTIONS.map((x) => x.anchor) as string[];
    for (const to of CROSS_LINKS.solutions) expect(solutions).toContain(to.split('#')[1]);
    const chapters = Object.values(WORKFLOW_CHAPTER) as string[];
    for (const to of CROSS_LINKS.workflow) expect(chapters).toContain(to.split('#')[1]);
    for (const d of CROSS_LINKS.departments) expect(DEPT_PAGES).toContain(d);
  });
});

describe('enterprise copy', () => {
  it('makes no certification, compliance, uptime or guarantee claims in any locale', () => {
    for (const l of LOCALES) {
      for (const s of allStrings(ENTERPRISE[l])) expect(s, `${l}: ${s}`).not.toMatch(FORBIDDEN);
    }
  });

  it('says readiness is not certification, in every locale', () => {
    expect(ENTERPRISE.th.readiness.banner).toContain('≠');
    expect(ENTERPRISE.th.readiness.banner).toContain('ไม่ใช่การรับรอง');
    expect(ENTERPRISE.en.readiness.banner).toMatch(/Readiness ≠ certification/);
    expect(ENTERPRISE['zh-CN'].readiness.banner).toMatch(/就绪 ≠ 认证/);
    expect(ENTERPRISE.th.readiness.principlesLead).toBe(
      'ออกแบบโดยคำนึงถึงการควบคุมสิทธิ์และการแยกข้อมูลตามหน้าที่',
    );
    expect(ENTERPRISE.th.readiness.productionNote).toContain('สถาปัตยกรรม production');
  });

  it('frames audit as a concept, never a legal certification or immutable ledger', () => {
    expect(ENTERPRISE.th.audit.claim).toMatch(/^รองรับแนวคิดการตรวจสอบย้อนหลัง/);
    expect(ENTERPRISE.en.audit.claim).toMatch(/not a legal certification.*immutable ledger/);
  });

  it('frames integration as scoped, not ready-made', () => {
    expect(ENTERPRISE.th.integration.lead).toContain('ออกแบบให้พร้อมต่อยอดการเชื่อมต่อ');
    expect(ENTERPRISE.th.integration.lead).toContain('การเชื่อมต่อจริงขึ้นอยู่กับขอบเขตโครงการ');
  });

  it('publishes no response times; SLA only where agreed', () => {
    for (const l of LOCALES) {
      const s = ENTERPRISE[l].support;
      expect(allStrings(s).join(' ')).not.toMatch(RESPONSE_TIME);
    }
    expect(ENTERPRISE.th.support.levels.dedicated.body).toContain('SLA ตามที่ตกลง');
    expect(ENTERPRISE.en.support.levels.dedicated.body).toContain('SLA where agreed');
  });

  it('tells the Warehouse story without money in the warehouse focus', () => {
    for (const l of LOCALES) {
      expect(ENTERPRISE[l].access.roles.warehouse.focus).not.toMatch(
        /ราคา|ต้นทุน|เงิน|price|cost|payment|价格|成本|付款/i,
      );
    }
  });

  it('keeps branch language as structure support, one company per workspace', () => {
    expect(ENTERPRISE.th.branches.prefix).toBe('รองรับการออกแบบโครงสร้างสำหรับ');
    expect(ENTERPRISE.th.organization.oneCompany.title).toBe('หนึ่ง CORE Workspace = หนึ่งบริษัท');
    expect(ENTERPRISE.th.branches.distinction).toContain('PDA ONE');
  });
});

describe('/enterprise page', () => {
  it('renders one H1 and the thirteen chapters in order', async () => {
    await open();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('เมื่อองค์กรใหญ่ขึ้น');
    expect(h1s[0]).toHaveTextContent('ไม่ใช่เพิ่มความซับซ้อน');
    const ids = [...document.querySelectorAll('#main section[id]')].map((s) => s.id);
    expect(ids).toEqual(ORDER);
    for (const id of ORDER) {
      expect(within(section(id)).getByRole('heading', { level: 2 })).toBeInTheDocument();
    }
  });

  it('shows the hero layers and a status key in words', async () => {
    await open();
    const hero = document.querySelector('[data-hero-visual]')!;
    expect(
      [...hero.querySelectorAll('[data-layer]')].map((n) => n.getAttribute('data-layer')),
    ).toEqual(['executive', 'control', 'process', 'teams']);
    const key = document.querySelector('[data-status-key]')!;
    for (const s of CLAIM_STATUSES) {
      expect(key).toHaveTextContent(ENTERPRISE.th.common.status[s].label);
    }
  });

  it('grows complexity stage by stage', async () => {
    await open();
    const s = section('complexity');
    expect(s.querySelectorAll('[data-multiplier][data-on="true"]')).toHaveLength(3);
    await userEvent.click(within(s).getByRole('tab', { name: /ชั้นปฏิบัติการขององค์กร/ }));
    expect(s.querySelectorAll('[data-multiplier][data-on="true"]')).toHaveLength(9);
    await userEvent.keyboard('{Home}');
    expect(within(s).getByRole('tab', { name: /ทีมเล็ก/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(s.querySelector('[data-complexity-message]')).toHaveTextContent(
      'ความซับซ้อนไม่ควรถูกโยนให้ผู้ใช้จำเอง',
    );
    expect(s.querySelectorAll('[data-industry]')).toHaveLength(6);
  });

  it('states one workspace per company, with every department on one shared state', async () => {
    await open();
    const s = section('organization');
    expect(s.querySelector('[data-one-company]')).toHaveTextContent(
      'หนึ่ง CORE Workspace = หนึ่งบริษัท',
    );
    expect(s.querySelectorAll('[data-level]')).toHaveLength(4);
  });

  it('masks money from the Warehouse view of the same object', async () => {
    await open();
    const s = section('access');
    const view = s.querySelector('[data-role-view]')!;
    expect(view.getAttribute('data-role-view')).toBe('warehouse');
    const fields = ENTERPRISE.th.access.fields;
    for (const f of ['quantity', 'lot', 'location', 'expiry'] as const) {
      expect(view).toHaveTextContent(fields[f].value);
    }
    for (const f of MONEY_FIELDS) {
      expect(view).not.toHaveTextContent(fields[f].value);
      expect(view.querySelector(`[data-field="${f}"]`)).toHaveAttribute('data-visible', 'false');
    }
    expect(s.querySelector('[data-warehouse-note]')).toHaveTextContent(
      'ไม่เห็นราคา ต้นทุน หรือการชำระเงิน',
    );

    await userEvent.click(within(s).getByRole('radio', { name: 'บัญชี' }));
    expect(s.querySelector('[data-role-view]')).toHaveTextContent(fields.price.value);
  });

  it('separates the Executive from the System admin', async () => {
    await open();
    const s = section('access');
    await userEvent.click(within(s).getByRole('radio', { name: 'ผู้บริหาร' }));
    expect(s.querySelector('[data-field="config"]')).toHaveAttribute('data-visible', 'false');
    expect(s.querySelector('[data-field="risk"]')).toHaveAttribute('data-visible', 'true');
    await userEvent.keyboard('{End}');
    expect(within(s).getByRole('radio', { name: 'ผู้ดูแลระบบ' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(s.querySelector('[data-field="config"]')).toHaveAttribute('data-visible', 'true');
    expect(s.querySelectorAll('[data-role-view] [data-visible="true"]')).toHaveLength(1);
    const split = s.querySelector('[data-exec-vs-admin]')!;
    expect(split).toHaveTextContent('ผู้บริหาร ≠ ผู้ดูแลระบบ');
    expect(split.querySelector('[data-side="executive"]')).toHaveTextContent('ไม่ได้ตั้งค่าระบบ');
    expect(split.querySelector('[data-side="admin"]')).toHaveTextContent(
      'ไม่ใช่ผู้ตัดสินใจทางธุรกิจ',
    );
  });

  it('switches approval rails and labels each control honestly', async () => {
    await open();
    const s = section('control');
    expect(s.querySelector('[data-rail]')).toHaveAttribute('data-rail', 'advanced');
    expect(s.querySelectorAll('[data-rail] [data-step]')).toHaveLength(5);
    await userEvent.click(within(s).getByRole('radio', { name: 'อนุมัติตามเงื่อนไข' }));
    expect(s.querySelector('[data-step="condition"]')).toHaveTextContent('ถ้าเข้าเงื่อนไข');
    expect(s.querySelector('[data-condition-note]')).toBeInTheDocument();
    await userEvent.click(within(s).getByRole('radio', { name: 'อนุมัติขั้นเดียว' }));
    expect(s.querySelectorAll('[data-rail] [data-step]')).toHaveLength(3);
    for (const x of CONTROLS) {
      const row = s.querySelector(`[data-control="${x.id}"]`)!;
      expect(row).toHaveTextContent(ENTERPRISE.th.common.status[x.status].label);
    }
  });

  it('expands one audit event into who, role, department, before, after, order and source', async () => {
    await open();
    const s = section('audit');
    await userEvent.click(within(s).getByRole('tab', { name: /ปรับยอดหลังตรวจนับ/ }));
    const record = s.querySelector('[data-audit-record]')!;
    expect(record).toHaveAttribute('data-audit-record', 'adjusted');
    expect(record.querySelector('[data-before]')).toHaveTextContent('40 หน่วย');
    expect(record.querySelector('[data-after]')).toHaveTextContent('38 หน่วย');
    for (const k of ['user', 'role', 'department', 'order', 'source']) {
      expect(record.querySelector(`[data-audit-field="${k}"]`)).toBeInTheDocument();
    }
    expect(record).toHaveTextContent('คลังสินค้า');
    expect(record).toHaveTextContent('5 / 6');
    expect(s.querySelector('[data-audit-claim]')).toHaveTextContent(
      'รองรับแนวคิดการตรวจสอบย้อนหลัง',
    );
  });

  it('drills from the organization down to the source state', async () => {
    await open();
    const s = section('executive');
    expect(s.querySelectorAll('[data-signal]')).toHaveLength(6);
    expect(s.querySelector('[data-drill="source"]')).toHaveAttribute('data-open', 'false');
    await userEvent.click(s.querySelector<HTMLElement>('[data-drill="source"]')!);
    expect(s.querySelectorAll('[data-drill][data-open="true"]')).toHaveLength(5);
    expect(s).toHaveTextContent('Supplier เลยวันที่คาดว่าจะได้รับ');
    expect(
      [...s.querySelectorAll('[data-report-plan]')].map((n) => n.getAttribute('data-report-level')),
    ).toEqual(PLANS.map((p) => p.reports));
  });

  it('adapts the workflow when adjustments are switched', async () => {
    await open();
    const s = section('workflow');
    const proc = () => s.querySelector('[data-process]')!.getAttribute('data-process');
    expect(proc()).toBe('request,review,approval,warehouse,purchasing,done');
    const seq = within(s).getByRole('button', { name: 'สลับลำดับแผนก' });
    expect(seq).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(seq);
    expect(seq).toHaveAttribute('aria-pressed', 'true');
    expect(proc()).toBe('request,review,approval,purchasing,warehouse,done');
    expect(s.querySelector('[data-workflow-package]')).toHaveTextContent(
      'ไม่ใช่การปรับได้ไม่จำกัด',
    );
  });

  it('shows API availability by package exactly as the pricing model defines it', async () => {
    await open();
    const s = section('integration');
    const tiers = [...s.querySelectorAll('[data-api-plan]')];
    expect(tiers.map((n) => n.getAttribute('data-api'))).toEqual([
      'no',
      'addon',
      'included',
      'included',
    ]);
    expect(tiers.map((n) => n.getAttribute('data-api'))).toEqual(PLANS.map((p) => p.api));
    const c = ENTERPRISE.th.integration;
    expect(tiers[0]).toHaveTextContent(c.api.no);
    expect(tiers[1]).toHaveTextContent(c.api.addon);
    expect(tiers[2]).toHaveTextContent(c.api.included);
    expect(tiers[3]).toHaveTextContent('ขอบเขตโครงการ');
    expect(s.querySelectorAll('[data-system]')).toHaveLength(8);
    expect(s.querySelector('[data-concept-note]')).toBeInTheDocument();
  });

  it('presents branches as one company in one CORE', async () => {
    await open();
    const s = section('branches');
    expect(s.querySelectorAll('[data-branch]')).toHaveLength(4);
    expect(s).toHaveTextContent('รองรับการออกแบบโครงสร้างสำหรับ');
    expect(s.querySelector('[data-branch-distinction]')).toHaveTextContent(
      'หนึ่ง Workspace คือหนึ่งบริษัท',
    );
  });

  it('lays out the implementation journey as one roadmap', async () => {
    await open();
    const s = section('implementation');
    expect(
      [...s.querySelectorAll('[data-phase]')].map((n) => n.getAttribute('data-phase')),
    ).toEqual([...PHASES]);
    expect(
      [...s.querySelectorAll('[data-journey-step]')].map((n) =>
        n.getAttribute('data-journey-step'),
      ),
    ).toEqual(JOURNEY.map((j) => j.id));
    expect(s.querySelector('[data-migration]')).toHaveTextContent(
      'ย้ายข้อมูลเริ่มต้นโดยไม่มีค่าใช้จ่าย',
    );
    expect(s.querySelector('[data-training]')).toHaveTextContent(
      'เว้นแต่รวมในใบเสนอราคา Enterprise',
    );
  });

  it('climbs the support ladder from Standard to Dedicated / SLA', async () => {
    await open();
    const s = section('support');
    expect(
      [...s.querySelectorAll('[data-support-plan]')].map((n) => n.getAttribute('data-support')),
    ).toEqual(PLANS.map((p) => p.support));
    expect(s.querySelector('[data-support-plan="enterprise"]')).toHaveTextContent(
      'Dedicated / SLA',
    );
    expect(s.querySelector('[data-sla-note]')).toHaveTextContent('ยังไม่ประกาศเวลาตอบกลับ');
    expect(s.textContent).not.toMatch(RESPONSE_TIME);
  });

  it('states readiness layers with statuses and that readiness is not certification', async () => {
    await open();
    const s = section('readiness');
    const layers = [...s.querySelectorAll('[data-readiness-layer]')];
    expect(layers).toHaveLength(8);
    for (const l of layers) {
      const status = l.getAttribute('data-status') as (typeof CLAIM_STATUSES)[number];
      expect(l).toHaveTextContent(ENTERPRISE.th.common.status[status].label);
    }
    expect(s.querySelector('[data-readiness-banner]')).toHaveTextContent(
      'พร้อมรองรับ ≠ การรับรองมาตรฐาน',
    );
    expect(s.querySelector('[data-production-note]')).toBeInTheDocument();
  });

  it('ends with a quotation path and cross-links', async () => {
    await open();
    const s = section('consult');
    expect(s.querySelectorAll('[data-quote-flow] li')).toHaveLength(6);
    expect(s.querySelector('[data-cta="quote"]')).toHaveAttribute(
      'href',
      '/consultation?topic=enterprise',
    );
    expect(s.querySelector('[data-cta="quote"]')).toHaveTextContent('ขอใบเสนอราคา');
    expect(s.querySelector('[data-cta="talk"]')).toHaveAttribute(
      'href',
      '/consultation?topic=consulting',
    );
    expect(s.querySelector('[data-cta="pricing"]')).toHaveAttribute(
      'href',
      '/pricing?plan=enterprise',
    );
    for (const to of [
      ...CROSS_LINKS.solutions,
      ...CROSS_LINKS.workflow,
      ...CROSS_LINKS.departments.map((d) => `/departments/${d}`),
    ]) {
      expect(s.querySelector(`a[href="${to}"]`), to).not.toBeNull();
    }
  });

  it('page text makes no forbidden claims', async () => {
    await open();
    expect(document.getElementById('main')!.textContent).not.toMatch(FORBIDDEN);
  });
});

describe('reduced motion', () => {
  it('shows every hero layer in its final state', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await open();
    const layers = document.querySelectorAll<HTMLElement>('[data-hero-visual] [data-layer]');
    expect(layers).toHaveLength(4);
    for (const l of layers) expect(l.style.opacity).not.toBe('0');
  });
});

describe('localization and links', () => {
  const THAI = /[฀-฾เ-๿]/;
  function visibleText() {
    const m = document.getElementById('main')!.cloneNode(true) as HTMLElement;
    m.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
    return (m.textContent ?? '').replace(CONTACT.address, '');
  }

  it('renders English without Thai', async () => {
    await open('/en/enterprise');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('As an organization grows');
    expect(visibleText()).not.toMatch(THAI);
  });

  it('renders Simplified Chinese without Thai or Traditional characters', async () => {
    await open('/zh/enterprise');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('组织越大');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(/[們個發這開時關庫說價購資費號門運營權證統線際體與變]/);
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/enterprise', '/en/enterprise', '/zh/enterprise']) {
      const { unmount } = await open(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it('keeps the locale in every page link', async () => {
    await open('/zh/enterprise');
    const main = document.getElementById('main')!;
    expect(
      main.querySelector('#consult a[href="/zh/consultation?topic=enterprise"]'),
    ).not.toBeNull();
    expect(main.querySelector('#consult a[href="/zh/pricing?plan=enterprise"]')).not.toBeNull();
    expect(main.querySelector('#consult a[href="/zh/solutions#management"]')).not.toBeNull();
    expect(main.querySelector('#consult a[href="/zh/how-core-works#trace"]')).not.toBeNull();
    expect(main.querySelector('#consult a[href="/zh/departments/warehouse"]')).not.toBeNull();
  });

  it('reaches For organizations from Solutions and Security from About, in the current locale (EP18)', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Solutions' }));
    expect(document.querySelector('header a[href="/en/enterprise"]')).not.toBeNull();
    await userEvent.click(within(nav).getByRole('button', { name: 'About' }));
    expect(document.querySelector('header a[href="/en/security"]')).not.toBeNull();
  });

  it('links the homepage enterprise chapter and the footer to the page', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('#enterprise a[href="/enterprise"]')).not.toBeNull();
    expect(document.querySelector('footer a[href="/enterprise"]')).not.toBeNull();
  });
});

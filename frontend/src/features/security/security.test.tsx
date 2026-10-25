import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { ENTERPRISE } from '@/features/enterprise/copy';
import {
  CLAIM_STATUSES,
  CONTROLS as EP10_CONTROLS,
  READINESS as EP10_READINESS,
} from '@/features/enterprise/model';
import { CLAIMS, LOCALES, strings, THAI, TRADITIONAL } from '@/test/claims';
import { renderRoute } from '@/test/render';
import { SECURITY_COPY } from './copy';
import {
  CONTROLS,
  FAQ,
  FIELDS,
  MATRIX,
  MONEY_FIELDS,
  SECURITY_ROLES,
  sees,
  TRACE_PARTS,
  VISIBILITY,
} from './model';

/*
 * EP15: /security, the public Trust Center. The visibility model is tested
 * directly (Warehouse privacy on the data, not the DOM), statuses against
 * the EP10 taxonomy, and every string in every language for claim safety.
 */

beforeAll(() => {
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});

describe('visibility model', () => {
  it('never gives the Warehouse a commercial or financial field', () => {
    for (const f of MONEY_FIELDS) expect(sees('warehouse', f), f).toBe(false);
    expect(VISIBILITY.warehouse).toEqual(
      expect.arrayContaining([
        'item',
        'quantity',
        'location',
        'lot',
        'expiry',
        'receiving',
        'picking',
      ]),
    );
  });

  it('keeps the boundary real: other roles do carry money fields', () => {
    for (const r of ['sales', 'purchasing', 'accounting', 'executive'] as const) {
      expect(
        VISIBILITY[r].some((f) => MONEY_FIELDS.includes(f)),
        r,
      ).toBe(true);
    }
  });

  it('separates Executive (business visibility) from Admin (configuration)', () => {
    expect(VISIBILITY.admin).toEqual(['permissions']);
    expect(sees('executive', 'permissions')).toBe(false);
    expect(sees('executive', 'exception')).toBe(true);
  });

  it('gives every role a distinct, partial view of the same work item', () => {
    const views = SECURITY_ROLES.map((r) => VISIBILITY[r].join());
    expect(new Set(views).size).toBe(SECURITY_ROLES.length);
    for (const r of SECURITY_ROLES) {
      expect(VISIBILITY[r].length).toBeGreaterThan(0);
      expect(VISIBILITY[r].length).toBeLessThan(FIELDS.length);
    }
  });
});

describe('status taxonomy (EP10)', () => {
  it('uses only the four EP10 statuses', () => {
    for (const x of [...MATRIX, ...CONTROLS]) expect(CLAIM_STATUSES).toContain(x.status);
  });

  it('agrees with the EP10 readiness model where layers overlap', () => {
    const ep10 = Object.fromEntries(EP10_READINESS.map((r) => [r.id, r.status]));
    const same = {
      identity: 'identity',
      access: 'access',
      workflow: 'workflow',
      trace: 'audit',
      data: 'data',
      observability: 'observability',
      integration: 'integration',
    } as const;
    for (const m of MATRIX) {
      if (m.id in same) expect(m.status, m.id).toBe(ep10[same[m.id as keyof typeof same]]);
    }
    expect(MATRIX.map((m) => m.id)).toEqual([
      'identity',
      'access',
      'workflow',
      'trace',
      'data',
      'backup',
      'observability',
      'integration',
    ]);
  });

  it('agrees with the EP10 controls', () => {
    const ep10 = Object.fromEntries(EP10_CONTROLS.map((c) => [c.id, c.status]));
    const map = {
      requiredInfo: 'requiredInfo',
      approval: 'multiStep',
      conditions: 'conditional',
      responsibility: 'crossDepartment',
    } as const;
    for (const c of CONTROLS) expect(c.status, c.id).toBe(ep10[map[c.id]]);
  });
});

describe('claim safety and language', () => {
  it('makes no unsupported security claim in any language', () => {
    for (const l of LOCALES) {
      for (const s of strings(SECURITY_COPY[l]))
        for (const re of CLAIMS) expect(s, s).not.toMatch(re);
    }
  });

  it('says plainly what is not claimed, and that UI hiding is not the boundary', () => {
    for (const l of LOCALES) {
      const c = SECURITY_COPY[l];
      expect(c.enforcement.neq).toBe('UI visibility ≠ security boundary');
      expect(c.readiness.notClaim.items.length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(c.faq.items)).toEqual([...FAQ]);
    }
  });

  it('keeps English free of Thai and Chinese Simplified', () => {
    for (const s of strings(SECURITY_COPY.en)) expect(s).not.toMatch(THAI);
    for (const s of strings(SECURITY_COPY['zh-CN'])) expect(s).not.toMatch(TRADITIONAL);
  });
});

describe('/security page', () => {
  const open = async (path = '/security') => {
    const r = renderRoute(path);
    await screen.findByRole('heading', { level: 1 });
    return r;
  };

  it('opens with the trust philosophy and one H1', async () => {
    await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ทุกคนไม่ควรเห็นทุกอย่าง');
    expect(document.querySelector('[data-concept]')).toHaveTextContent('Firewall');
    expect(document.title).toContain('ความปลอดภัยและความไว้วางใจ');
  });

  it('shows the Warehouse window first: money fields stop before the view', async () => {
    await open();
    const group = screen.getByRole('group', { name: 'เลือกบทบาท' });
    expect(within(group).getByRole('button', { name: /คลังสินค้า/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const f of MONEY_FIELDS) {
      expect(document.querySelector(`[data-row="${f}"]`)).toHaveAttribute('data-visible', 'false');
      expect(document.querySelector(`[data-row="${f}"]`)).toHaveTextContent('หยุดก่อนถึงมุมมองนี้');
    }
    expect(document.querySelector('[data-row="lot"]')).toHaveAttribute('data-visible', 'true');
  });

  it('changes the visible slice when the visitor changes role — the work item stays', async () => {
    await open();
    const group = screen.getByRole('group', { name: 'เลือกบทบาท' });
    await userEvent.click(within(group).getByRole('button', { name: /ผู้บริหาร/ }));
    expect(document.querySelector('[data-visibility]')).toHaveAttribute(
      'data-visibility',
      'executive',
    );
    expect(document.querySelector('[data-row="margin"]')).toHaveAttribute('data-visible', 'true');
    expect(document.querySelector('[data-row="permissions"]')).toHaveAttribute(
      'data-visible',
      'false',
    );
    await userEvent.click(within(group).getByRole('button', { name: /ผู้ดูแลระบบ/ }));
    const visible = [
      ...document.querySelectorAll('[data-work-item] [data-row][data-visible="true"]'),
    ].map((r) => (r as HTMLElement).dataset.row);
    expect(visible).toEqual(['permissions']);
    expect(document.querySelectorAll('[data-work-item] [data-row]')).toHaveLength(FIELDS.length);
  });

  it('makes Warehouse privacy the flagship example', async () => {
    await open();
    const lanes = document.querySelectorAll('[data-lane]');
    expect(lanes.length).toBe(12);
    for (const f of MONEY_FIELDS) {
      expect(document.querySelector(`[data-lane="${f}"]`)).toHaveAttribute('data-passes', 'false');
    }
    expect(document.querySelector('[data-warehouse-fact]')).toHaveTextContent('Allow-list');
    expect(document.querySelector('[data-link="warehouse-demo"]')).toHaveAttribute(
      'href',
      '/demo?role=warehouse',
    );
  });

  it('distinguishes Executive from Admin, and UI from server enforcement', async () => {
    await open();
    expect(
      screen.getByRole('heading', { level: 2, name: 'ผู้บริหาร ≠ ผู้ดูแลระบบ' }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-side="executive"]')).toHaveTextContent('ข้อยกเว้น');
    expect(document.querySelector('[data-side="admin"]')).toHaveTextContent('บทบาทและสิทธิ์');
    expect(document.querySelector('[data-neq]')).toHaveTextContent(
      'UI visibility ≠ security boundary',
    );
    const stages = document.querySelectorAll('[data-stage]');
    expect(
      [...stages].map((s) => s.querySelector('[data-status]')?.getAttribute('data-status')),
    ).toEqual(['prototype', 'ready', 'planned']);
  });

  it('shows the intended trace for a chosen event', async () => {
    await open();
    const trace = document.querySelector('[data-trace]')!;
    expect(trace.querySelectorAll('[data-part]')).toHaveLength(TRACE_PARTS.length);
    await userEvent.click(screen.getByRole('radio', { name: 'อนุมัติเอกสาร' }));
    expect(document.querySelector('[data-trace]')).toHaveAttribute('data-trace', 'approve');
    expect(document.querySelector('[data-part="source"]')).toHaveTextContent('INV-5521');
    expect(document.querySelector('[data-part="before"]')).toHaveTextContent('รออนุมัติ');
  });

  it('carries the readiness matrix in EP10 words, FAQ and honest go-live wording', async () => {
    await open();
    const rows = document.querySelectorAll('[data-matrix] tbody tr');
    expect(rows).toHaveLength(MATRIX.length);
    const labels = ENTERPRISE.th.common.status;
    expect(document.querySelector('[data-matrix] tr[data-row="identity"]')).toHaveTextContent(
      labels.planned.label,
    );
    expect(document.querySelector('[data-matrix] tr[data-row="access"]')).toHaveTextContent(
      labels.prototype.label,
    );
    expect(document.querySelector('[data-matrix] tr[data-row="trace"]')).toHaveTextContent(
      labels.ready.label,
    );
    expect(document.querySelectorAll('[data-faq]')).toHaveLength(FAQ.length);
    expect(screen.getByRole('region', { name: 'ก่อนใช้งานจริง ต้องมีอะไรบ้าง' })).toHaveAttribute(
      'data-go-live',
    );
    expect(document.querySelector('[data-go-live]')).toHaveTextContent(
      'ยังไม่ใช่บริการที่เปิดใช้งาน',
    );
    expect(document.querySelector('[data-not-claim]')).toHaveTextContent(
      'ยังไม่มีการรับรองมาตรฐาน',
    );
  });

  it('links to the consultation, Enterprise and the demo', async () => {
    await open();
    expect(document.querySelector('[data-cta="consult"]')).toHaveAttribute(
      'href',
      '/contact?interest=implementation',
    );
    expect(document.querySelector('[data-cta="enterprise"]')).toHaveAttribute(
      'href',
      '/enterprise',
    );
    expect(document.querySelector('[data-link="demo"]')).toHaveAttribute('href', '/demo');
    expect(document.querySelector('[data-link="enterprise-control"]')).toHaveAttribute(
      'href',
      '/enterprise#control',
    );
  });

  it('reads in English and Simplified Chinese, links staying in the locale', async () => {
    await open('/en/security');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Not everyone should see everything',
    );
    expect(document.querySelector('[data-cta="consult"]')).toHaveAttribute(
      'href',
      '/en/contact?interest=implementation',
    );
    expect(document.getElementById('main')!.textContent).not.toMatch(THAI);
    await waitFor(() => expect(document.title).toContain('Security & Trust'));
  });

  it('has its own Chinese metadata', async () => {
    await open('/zh/security');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('不是每个人都该看到一切');
    await waitFor(() => expect(document.title).toContain('安全与信任'));
    expect(document.querySelector('[data-link="demo"]')).toHaveAttribute('href', '/zh/demo');
  });
});

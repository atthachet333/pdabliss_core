import { describe, expect, it } from 'vitest';
import { WORKSPACE_ORDER, WORKSPACES } from './registry';

describe('workspace registry', () => {
  it('defines all seven workspaces', () => {
    expect(WORKSPACE_ORDER).toEqual([
      'executive',
      'sales',
      'warehouse',
      'purchasing',
      'operations',
      'accounting',
      'admin',
    ]);
  });

  it('starts every workspace with its overview and has unique module paths', () => {
    for (const id of WORKSPACE_ORDER) {
      const nav = WORKSPACES[id].nav;
      expect(nav[0]?.path).toBe('');
      expect(new Set(nav.map((n) => n.path)).size).toBe(nav.length);
    }
  });

  it('gives each department its own navigation rather than relabelled copies', () => {
    const signatures = WORKSPACE_ORDER.map((id) =>
      WORKSPACES[id].nav
        .slice(1)
        .filter((n) => n.path !== 'reports')
        .map((n) => n.path)
        .join('|'),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('gives every workspace its own accent', () => {
    const accents = WORKSPACE_ORDER.map((id) => WORKSPACES[id].accent);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it('keeps the warehouse navigation free of pricing or payment modules', () => {
    const labels = WORKSPACES.warehouse.nav.map((n) => `${n.path} ${n.label}`).join(' ');
    expect(labels).not.toMatch(/price|cost|payment|ราคา|ต้นทุน|จ่ายเงิน/i);
  });

  it('matches the EP02 department navigation', () => {
    const labels = (id: keyof typeof WORKSPACES) => WORKSPACES[id].nav.map((n) => n.label);
    expect(labels('executive')).toEqual(['ภาพรวม', 'แผนก', 'Exception', 'การอนุมัติ', 'รายงาน']);
    expect(labels('sales')).toEqual([
      'ภาพรวม',
      'Customer PO',
      'Sales Order',
      'การส่งมอบ',
      'ลูกค้า',
      'รายงาน',
    ]);
    expect(labels('warehouse')).toEqual([
      'ภาพรวม',
      'รับสินค้า',
      'สต็อกสินค้า',
      'Lot / Batch',
      'วันหมดอายุ',
      'การเคลื่อนไหว',
      'ตรวจนับ',
      'รายงาน',
    ]);
    expect(labels('purchasing')).toEqual([
      'ภาพรวม',
      'ใบขอซื้อ',
      'ใบสั่งซื้อ',
      'Supplier',
      'ติดตามการรับ',
      'รายงาน',
    ]);
    expect(labels('operations')).toEqual([
      'ภาพรวม',
      'Work Order',
      'แผนงาน',
      'ความคืบหน้า',
      'งานเสร็จ',
      'รายงาน',
    ]);
    expect(labels('accounting')).toEqual([
      'ภาพรวม',
      'คำขอจ่าย',
      'การจ่ายเงิน',
      'ยอดค้าง',
      'เอกสาร',
      'รายงาน',
    ]);
    expect(labels('admin')).toEqual([
      'ภาพรวม',
      'ผู้ใช้งาน',
      'แผนก',
      'บทบาท',
      'Workflow',
      'การตั้งค่า',
    ]);
  });

  it('flags the Approval and Workflow modules as placeholders', () => {
    expect(WORKSPACES.executive.nav.find((n) => n.path === 'approvals')?.placeholder).toBe(true);
    expect(WORKSPACES.admin.nav.find((n) => n.path === 'workflow')?.placeholder).toBe(true);
  });

  it('keeps the phone bar to at most four destinations, overview first', () => {
    for (const id of WORKSPACE_ORDER) {
      const mobile = WORKSPACES[id].nav.filter((n) => n.mobile);
      expect(mobile.length).toBeGreaterThan(0);
      expect(mobile.length).toBeLessThanOrEqual(4);
      expect(mobile[0]?.path).toBe('');
    }
  });

  it('keeps warehouse module blueprints free of pricing columns', () => {
    const text = WORKSPACES.warehouse.nav
      .flatMap((n) => [
        ...(n.blueprint?.columns.map((c) => c.header) ?? []),
        ...(n.blueprint?.filters ?? []),
        n.summary ?? '',
      ])
      .join(' ');
    expect(text).not.toMatch(/ราคา|ต้นทุน|ยอดเงิน|มูลค่า|บาท|฿|price|cost|amount/i);
  });
});

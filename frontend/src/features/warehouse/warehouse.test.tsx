import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { Receipt, ReceiptDetail, StockRow, WarehouseContext } from './whApi';

/*
 * EP31 Warehouse screens (UI): the workspace from real counts, the receipt
 * editor (accepted / rejected, lot and expiry rules per item, allocations
 * that must add up), posting and reversal behind explicit confirmations, and
 * the inventory / lots / movement lists. The server enforces everything again
 * (backend/test/warehouse.test.ts); nothing here shows or sends a price.
 */

const X: BranchInfo = {
  id: 'b1',
  code: '00001',
  name: 'Demo Branch',
  type: 'BRANCH',
  status: 'ACTIVE',
  address: {
    line1: '1 Road',
    line2: null,
    subdistrict: null,
    district: 'Demo',
    province: 'Bangkok',
    postalCode: '10110',
    countryCode: 'TH',
  },
  phone: null,
  deactivatedAt: null,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
};
const REF = { id: 'b1', code: '00001', name: 'Demo Branch' };
const W = '/api/v1/warehouse';

const person = (role: CompanyRole, permissions: string[]) => ({
  ...signedIn(
    identity({ company: { id: 'c1', name: 'Alpha', isDemo: false, role, canEnterCore: true } }),
  ),
  'GET /api/v1/company/context': ok({
    company: { id: 'c1', displayName: 'Alpha' },
    role,
    scope: 'SELECTED_BRANCHES',
    branches: [X],
    selected: X,
    needsSelection: false,
    blocked: null,
    departments: ['WAREHOUSE'],
    permissions: permissions as BranchContext['permissions'],
  } satisfies BranchContext),
});

const ctx = (over: Partial<WarehouseContext> = {}): WarehouseContext => ({
  receiving: { view: true, process: true, cancel: false },
  inventory: { view: true },
  transfers: { create: true, approve: false, cancel: false },
  adjustments: { create: true, approve: false },
  cycleCounts: { create: true, approve: false },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  locations: [
    { id: 'l-main', code: 'MAIN', name: 'Main', branchId: 'b1', isDefault: true },
    { id: 'l-qc', code: 'QC', name: 'QC hold', branchId: 'b1', isDefault: false },
  ],
  counts: {
    pendingReceive: 2,
    draftReceipts: 1,
    stockRows: 7,
    expiring: 1,
    expired: 0,
    draftTransfers: 1,
    submittedAdjustments: 0,
    activeCounts: 0,
  },
  expiringSoonDays: 30,
  today: '2026-11-03',
  ...over,
});

const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'gr1',
  number: 'GR-202611-000001',
  status: 'DRAFT',
  branch: REF,
  order: { id: 'po1', number: 'PO-202611-000003' },
  supplier: { code: 'SUP-000001', name: 'Siam Supply' },
  receivedAt: '2026-11-03T02:00:00.000Z',
  createdBy: { name: 'Demo Warehouse' },
  postedAt: null,
  lineCount: 1,
  updatedAt: '2026-11-03T02:00:00.000Z',
  defaultLocation: { id: 'l-main', code: 'MAIN', name: 'Main' },
  note: null,
  createdAt: '2026-11-03T02:00:00.000Z',
  postedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lines: [
    {
      id: 'ln1',
      lineNo: 1,
      orderLine: { id: 'pol1', lineNo: 1 },
      item: {
        id: 'i1',
        code: 'FG-000001',
        name: 'Serum',
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      },
      unit: { code: 'PCS', name: 'Piece', precision: 0 },
      ordered: '30',
      receivedElsewhere: '10',
      remaining: '20',
      acceptedQuantity: '0',
      rejectedQuantity: '0',
      rejectReason: null,
      rejectNote: null,
      replacementRequired: true,
      note: null,
      allocations: [],
    },
  ],
  actions: ['edit', 'post', 'cancel'],
  ...over,
});
const detail = (r: Receipt): ReceiptDetail => ({
  receipt: r,
  timeline: [{ type: 'GOODS_RECEIPT_CREATED', at: r.createdAt, actor: { name: 'Demo Warehouse' } }],
});

const warehouse = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...person('DEPARTMENT_STAFF', [
    'warehouse.workspace.view',
    'warehouse.receiving.view',
    'warehouse.receiving.process',
    'warehouse.inventory.view',
  ]),
  [`GET ${W}/context`]: ok(ctx()),
  ...extra,
});

describe('Warehouse receiving and inventory (EP31)', () => {
  it('the workspace shows real counts and only the sections this person may open', async () => {
    fakeApi(warehouse());
    renderRoute('/core/warehouse?lang=en');
    expect(await screen.findByRole('heading', { level: 1, name: 'Warehouse' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Warehouse' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'Pending receive',
      'Goods receipts',
      'Inventory',
      'Lots & expiry',
      'Movements',
      'Transfers',
      'Adjustments',
      'Cycle counts',
    ]);
    const tile = (name: string) => screen.getByText(name).closest('a')!;
    expect(tile('Draft transfers')).toHaveAttribute(
      'href',
      '/core/warehouse/transfers?status=DRAFT',
    );
    expect(tile('Orders to receive')).toHaveTextContent('2');
    expect(tile('Lots expiring soon')).toHaveAttribute(
      'href',
      '/core/warehouse/lots?expiry=EXPIRING_SOON',
    );
  });

  it('receipt editor: lot and expiry are required for this item, allocations must add up, then posts', async () => {
    let current = receipt();
    const api = fakeApi(
      warehouse({
        [`GET ${W}/receipts/gr1`]: () => ok(detail(current)),
        [`PUT ${W}/receipts/gr1/lines/ln1`]: (body) => {
          const b = body as {
            acceptedQuantity: string;
            allocations: {
              lotNumber: string;
              expiryDate: string;
              quantity: string;
              locationId: string;
            }[];
          };
          current = receipt({
            lines: [
              {
                ...current.lines[0]!,
                acceptedQuantity: b.acceptedQuantity,
                allocations: b.allocations.map((a, i) => ({
                  id: `a${i}`,
                  location: {
                    id: a.locationId,
                    code: a.locationId === 'l-qc' ? 'QC' : 'MAIN',
                    name: '',
                  },
                  lotNumber: a.lotNumber,
                  lotId: null,
                  expiryDate: a.expiryDate,
                  manufacturedDate: null,
                  quantity: a.quantity,
                })),
              },
            ],
          });
          return ok(detail(current));
        },
        [`POST ${W}/receipts/gr1/post`]: () => {
          current = {
            ...current,
            status: 'POSTED',
            actions: [],
            postedAt: '2026-11-03T03:00:00.000Z',
          };
          return ok(detail(current));
        },
      }),
    );
    renderRoute('/core/warehouse/receipts/gr1?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'GR-202611-000001' }),
    ).toBeInTheDocument();
    const figures = within(document.querySelector('[data-figures]') as HTMLElement);
    expect(figures.getByText('Still to receive').nextElementSibling).toHaveTextContent('20 PCS');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit #1 FG-000001' }));
    await user.type(screen.getByLabelText('Accept now (PCS)'), '15');
    // One location row, quantity filled, but no lot: refused before sending.
    await user.type(screen.getByLabelText('Quantity (PCS)'), '15');
    await user.click(screen.getByRole('button', { name: 'Save #1' }));
    expect(await screen.findByText('This item needs a lot number.')).toBeInTheDocument();
    expect(api.called(`PUT ${W}/receipts/gr1/lines/ln1`)).toHaveLength(0);
    // Split: 10 in MAIN, 5 in QC — the second row added and moved to QC.
    await user.type(screen.getByLabelText('Lot number *'), 'LOT-A');
    await user.clear(screen.getByLabelText('Quantity (PCS)'));
    await user.type(screen.getByLabelText('Quantity (PCS)'), '10');
    await user.click(screen.getByRole('button', { name: '+ Add location / lot' }));
    const rows = document.querySelectorAll('[data-allocation]');
    const second = within(rows[1] as HTMLElement);
    await user.selectOptions(second.getByLabelText('Location #2'), 'l-qc');
    await user.type(second.getByLabelText('Lot number *'), 'LOT-A');
    await user.type(second.getByLabelText('Quantity (PCS)'), '5');
    await user.click(screen.getByRole('button', { name: 'Save #1' }));
    expect(await screen.findByText('Lots of this item need an expiry date.')).toBeInTheDocument();
    for (const [i, row] of [...rows].entries()) {
      await user.type(within(row as HTMLElement).getByLabelText('Expiry date *'), '2027-06-01');
      expect(i).toBeLessThan(2);
    }
    await user.click(screen.getByRole('button', { name: 'Save #1' }));
    await waitFor(() => expect(api.called(`PUT ${W}/receipts/gr1/lines/ln1`)).toHaveLength(1));
    expect(api.called(`PUT ${W}/receipts/gr1/lines/ln1`)[0]!.body).toEqual({
      acceptedQuantity: '15',
      rejectedQuantity: '0',
      rejectReason: null,
      rejectNote: null,
      replacementRequired: true,
      allocations: [
        { locationId: 'l-main', lotNumber: 'LOT-A', expiryDate: '2027-06-01', quantity: '10' },
        { locationId: 'l-qc', lotNumber: 'LOT-A', expiryDate: '2027-06-01', quantity: '5' },
      ],
    });
    // Posting is confirmed in place and explains what happens.
    await user.click(await screen.findByRole('button', { name: 'Post receipt' }));
    expect(screen.getByText(/Stock will be added and the receipt locked/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Post receipt' }));
    expect(await screen.findByText('Posted — stock added')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit #1/ })).toBeNull();
    expect(screen.getByText('Posted', { selector: '[data-gr-status]' })).toBeInTheDocument();
    // Nothing on the page is money.
    expect(document.body.textContent).not.toMatch(/price|THB|total|amount/i);
  });

  it('rejecting needs a reason; the server refusal is shown in words (TH)', async () => {
    fakeApi(
      warehouse({
        [`GET ${W}/receipts/gr1`]: ok(detail(receipt())),
        [`PUT ${W}/receipts/gr1/lines/ln1`]: fail(422, 'LOT_EXPIRED'),
      }),
    );
    renderRoute('/core/warehouse/receipts/gr1?lang=th');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /แก้ไข #1/ }));
    await user.type(screen.getByLabelText('ปฏิเสธครั้งนี้ (PCS)'), '2');
    await user.click(screen.getByRole('button', { name: 'บันทึก #1' }));
    expect(await screen.findByText('กรุณาระบุเหตุผลที่ปฏิเสธ')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('เหตุผลที่ปฏิเสธ'), 'EXPIRED');
    await user.click(screen.getByRole('button', { name: 'บันทึก #1' }));
    expect(
      await screen.findByText('สินค้าหมดอายุแล้ว รับเข้าไม่ได้ — บันทึกเป็นปฏิเสธ (หมดอายุ)'),
    ).toBeInTheDocument();
  });

  it('reversing a posted receipt needs a reason and says what happens to stock', async () => {
    const posted = receipt({
      status: 'POSTED',
      actions: ['cancel'],
      postedAt: '2026-11-03T03:00:00.000Z',
    });
    const api = fakeApi(
      warehouse({
        [`GET ${W}/receipts/gr1`]: ok(detail(posted)),
        [`POST ${W}/receipts/gr1/cancel`]: ok(
          detail({ ...posted, status: 'CANCELLED', actions: [] }),
        ),
      }),
    );
    renderRoute('/core/warehouse/receipts/gr1?lang=en');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cancel and reverse stock' }));
    expect(screen.getByText(/Reversal movements will remove the stock/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel and reverse stock' }));
    expect(api.called(`POST ${W}/receipts/gr1/cancel`)).toHaveLength(0);
    await user.type(screen.getByLabelText('Reason'), 'Wrong delivery note');
    await user.click(screen.getByRole('button', { name: 'Cancel and reverse stock' }));
    await waitFor(() => expect(api.called(`POST ${W}/receipts/gr1/cancel`)).toHaveLength(1));
    expect(api.called(`POST ${W}/receipts/gr1/cancel`)[0]!.body).toEqual({
      reason: 'Wrong delivery note',
    });
  });

  it('lots & expiry: FEFO order from the server, expiry states in words, no value column (ZH)', async () => {
    const row = (
      lot: string,
      expiryDate: string,
      state: StockRow['expiryState'],
      days: number,
    ): StockRow => ({
      id: lot,
      branch: REF,
      location: { id: 'l-main', code: 'MAIN', name: 'Main' },
      item: {
        id: 'i1',
        code: 'FG-000001',
        name: 'Serum',
        lotTracking: 'REQUIRED',
        expiryTracking: 'REQUIRED',
      },
      unit: { code: 'PCS' },
      lot: { id: lot, lotNumber: lot, expiryDate, manufacturedDate: null },
      quantityOnHand: '6',
      expiryState: state,
      daysToExpiry: days,
      firstReceivedAt: '2026-11-03T02:00:00.000Z',
      updatedAt: '2026-11-03T02:00:00.000Z',
    });
    const api = fakeApi(
      warehouse({
        [`GET ${W}/stock`]: ok({
          items: [
            row('FG-DEMO-B', '2026-11-15', 'EXPIRING_SOON', 12),
            row('FG-DEMO-A', '2026-12-18', 'OK', 45),
          ],
          total: 2,
          page: 1,
          hasMore: false,
          today: '2026-11-03',
          expiringSoonDays: 30,
        }),
      }),
    );
    renderRoute('/core/warehouse/lots?lang=zh-CN');
    expect(
      await screen.findByRole('heading', { level: 1, name: '批次与有效期' }),
    ).toBeInTheDocument();
    await screen.findByText('FG-DEMO-B');
    const lots = [...document.querySelectorAll('[data-stock-row]')].map((r) =>
      r.getAttribute('data-stock-row'),
    );
    expect(lots).toEqual(['FG-DEMO-B', 'FG-DEMO-A']);
    expect(screen.getByText(/即将到期/, { selector: '[data-expiry-state]' })).toHaveTextContent(
      '12 天',
    );
    expect(api.called(`GET ${W}/stock`)[0]!.query).toMatchObject({ view: 'lots' });
    const heads = [...document.querySelectorAll('[data-stock-rows] th')].map((t) => t.textContent);
    expect(heads).toEqual(['物料', '批次', '有效期', '库位', '在库数量', '操作']);
  });

  it('a view-only member sees receipts but no edit, post or cancel control', async () => {
    fakeApi({
      ...person('VIEWER', ['warehouse.workspace.view', 'warehouse.receiving.view']),
      [`GET ${W}/context`]: ok(
        ctx({
          receiving: { view: true, process: false, cancel: false },
          inventory: { view: false },
        }),
      ),
      [`GET ${W}/receipts/gr1`]: ok(detail(receipt({ actions: [] }))),
      [`GET ${W}/receipts`]: ok({ items: [], total: 0, page: 1, hasMore: false, counts: {} }),
    });
    renderRoute('/core/warehouse/receipts/gr1?lang=en');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'GR-202611-000001' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Post|Cancel/ })).toBeNull();
    // The list's section links follow the same capabilities: no inventory sections.
    renderRoute('/core/warehouse/receipts?lang=en');
    const nav = await screen.findByRole('navigation', { name: 'Warehouse' });
    expect(within(nav).queryByText('Inventory')).toBeNull();
    expect(within(nav).getByText('Goods receipts')).toBeInTheDocument();
  });
});

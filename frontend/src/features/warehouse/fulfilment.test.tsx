import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo } from '@/features/company/api';
import type { SalesContext, SalesOrder } from '@/features/sales/salesApi';
import { fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { Pack, Pick, Shipment } from './ctlApi';
import type { PickOrder, WarehouseContext } from './whApi';

/*
 * EP35 fulfilment screens (UI): Pending Pick creates a pick (only with the
 * picking code); a pick is confirmed with what was taken (a short line names
 * why); picked goods are packed, a pack is shipped; only a manager sees
 * Dispatch, which asks first in the exact words (stock is deducted then);
 * delivery and exceptions are recorded per shipment; Sales sees per-line
 * progress and shipments. Nothing commercial anywhere. The server enforces
 * everything again (backend/test/sales-fulfilment.test.ts).
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
const MAIN = { id: 'l-main', code: 'MAIN', name: 'Main' };
const ITEM = { id: 'i1', code: 'PK-000001', name: 'Box' };
const UNIT = { code: 'PCS', precision: 0 };
const W = '/api/v1/warehouse';
const MONEY = /price|cost|amount|฿|THB|185|total/i;
const ORDER = { id: 'o1', number: 'SO-202611-000007', status: 'CONFIRMED', requestedDate: null };

const person = (role: CompanyRole, permissions: string[], departments = ['WAREHOUSE']) => ({
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
    departments: departments as BranchContext['departments'],
    permissions: permissions as BranchContext['permissions'],
  } satisfies BranchContext),
});

const ctx = (manager: boolean, pick = true): WarehouseContext => ({
  receiving: { view: true, process: true, cancel: manager },
  inventory: { view: true },
  transfers: { create: true, approve: manager, cancel: manager },
  adjustments: { create: true, approve: manager },
  cycleCounts: { create: true, approve: manager },
  fulfilment: { pick, dispatch: manager, deliver: manager },
  branches: [{ ...REF, type: 'BRANCH' }],
  selectedBranch: { ...REF, type: 'BRANCH' },
  locations: [{ ...MAIN, branchId: 'b1', isDefault: true }],
  counts: {
    pendingReceive: 0,
    draftReceipts: 0,
    stockRows: 1,
    expiring: 0,
    expired: 0,
    draftTransfers: 0,
    submittedAdjustments: 0,
    activeCounts: 0,
    pendingPick: 1,
    openPicks: 1,
    openPacks: 1,
    readyShipments: 1,
    inTransit: 0,
    deliveryExceptions: 1,
  },
  expiringSoonDays: 30,
  today: '2026-11-04',
});
const STAFF = ['warehouse.workspace.view', 'warehouse.inventory.view', 'warehouse.picking.process'];
const as = (manager: boolean, extra: Parameters<typeof fakeApi>[0] = {}, pick = true) => ({
  ...person(
    manager ? 'DEPARTMENT_MANAGER' : 'DEPARTMENT_STAFF',
    manager ? [...STAFF, 'warehouse.dispatch.confirm', 'warehouse.delivery.confirm'] : STAFF,
  ),
  [`GET ${W}/context`]: ok(ctx(manager, pick)),
  ...extra,
});

const common = {
  branch: REF,
  order: ORDER,
  lineCount: 1,
  createdBy: { name: 'Demo Warehouse' },
  createdAt: '2026-11-04T02:00:00.000Z',
  updatedAt: '2026-11-04T02:00:00.000Z',
  note: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
};
const pickDoc = (over: Partial<Pick> = {}): Pick => ({
  ...common,
  id: 'p1',
  number: 'PICK-202611-000001',
  status: 'IN_PROGRESS',
  startedAt: '2026-11-04T02:05:00.000Z',
  startedBy: { name: 'Demo Warehouse' },
  pickedAt: null,
  pickedBy: null,
  lines: [
    {
      id: 'pl1',
      lineNo: 1,
      orderLineNo: 1,
      item: ITEM,
      unit: UNIT,
      location: MAIN,
      lot: null,
      expiryState: 'NO_EXPIRY',
      planned: '10',
      picked: null,
      toPack: '0',
      packed: '0',
      dispatched: '0',
      discrepancy: null,
      discrepancyNote: null,
    },
  ],
  actions: ['confirm', 'cancel'],
  ...over,
});
const packDoc = (over: Partial<Pack> = {}): Pack => ({
  ...common,
  id: 'k1',
  number: 'PACK-202611-000001',
  status: 'PACKED',
  packageCount: 2,
  packageReference: 'BOX-7',
  shipment: null,
  packedAt: '2026-11-04T03:00:00.000Z',
  packedBy: { name: 'Demo Warehouse' },
  dispatchedAt: null,
  lines: [
    {
      id: 'kl1',
      lineNo: 1,
      pick: { id: 'p1', number: 'PICK-202611-000001' },
      item: ITEM,
      unit: UNIT,
      location: MAIN,
      lot: null,
      quantity: '8',
    },
  ],
  actions: ['cancel', 'ship'],
  ...over,
});
const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  ...common,
  id: 's1',
  number: 'SHP-202611-000001',
  status: 'READY',
  shipToName: 'Demo Shop',
  shipToAddress: '99/1 Demo Road',
  carrier: 'Own truck',
  trackingReference: null,
  handedOverTo: null,
  dispatchedAt: null,
  dispatchedBy: null,
  deliveredAt: null,
  reservationOk: true,
  packs: [{ id: 'k1', number: 'PACK-202611-000001', packageCount: 2 }],
  lines: [
    {
      id: 'sl1',
      lineNo: 1,
      pack: { id: 'k1', number: 'PACK-202611-000001' },
      item: ITEM,
      unit: UNIT,
      location: MAIN,
      lot: null,
      quantity: '8',
      delivered: '0',
      outstanding: '8',
    },
  ],
  events: [],
  actions: ['cancel', 'dispatch'],
  ...over,
});
const tl = (type: string) => [
  { type, at: '2026-11-04T02:00:00.000Z', actor: { name: 'Demo Warehouse' } },
];
const pendingOrder: PickOrder = {
  id: 'o1',
  number: 'SO-202611-000007',
  branch: REF,
  orderDate: '2026-11-04',
  requestedDate: null,
  confirmedAt: '2026-11-04T01:00:00.000Z',
  readiness: 'READY',
  lines: [
    {
      lineNo: 1,
      item: ITEM,
      unit: { code: 'PCS' },
      ordered: '12',
      allocated: '12',
      shortage: '0',
      picks: [
        {
          location: MAIN,
          lot: null,
          expiryState: 'NO_EXPIRY',
          quantity: '12',
          toPick: '7',
        },
      ],
    },
  ],
};
const page = <T,>(items: T[]) =>
  ok({ items, total: items.length, page: 1, pageSize: 20, hasMore: false, today: '2026-11-04' });

describe('Sales fulfilment (EP35)', () => {
  it('Pending Pick: picking staff create a pick of what is still to pick and open it; without the code there is no button', async () => {
    const api = fakeApi(
      as(false, {
        [`GET ${W}/pending-pick`]: page([pendingOrder]),
        [`POST ${W}/picks`]: ok({
          pick: pickDoc({ status: 'DRAFT', actions: ['start', 'confirm', 'cancel'] }),
          timeline: tl('SALES_PICK_CREATED'),
        }),
        [`GET ${W}/picks/p1`]: ok({
          pick: pickDoc({ status: 'DRAFT' }),
          timeline: tl('SALES_PICK_CREATED'),
        }),
      }),
    );
    const { unmount } = renderRoute('/core/warehouse/pending-pick?lang=en');
    const card = (await screen.findByText('SO-202611-000007')).closest('li')!;
    expect(card.textContent).toMatch(/12 PCS · To pick 7/);
    await userEvent.click(within(card).getByRole('button', { name: 'Create pick' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PICK-202611-000001' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${W}/picks`)[0]!.body).toEqual({ salesOrderId: 'o1' });
    unmount();

    fakeApi(as(false, { [`GET ${W}/pending-pick`]: page([pendingOrder]) }, false));
    renderRoute('/core/warehouse/pending-pick?lang=en');
    const ro = (await screen.findByText('SO-202611-000007')).closest('li')!;
    expect(within(ro).queryByRole('button')).toBeNull();
  });

  it('confirming a pick: a short line must name why; exact strings are sent; nothing commercial shows', async () => {
    let current = pickDoc();
    const api = fakeApi(
      as(false, {
        [`GET ${W}/picks/p1`]: () => ok({ pick: current, timeline: tl('SALES_PICK_UPDATED') }),
        [`POST ${W}/picks/p1/confirm`]: () => {
          current = pickDoc({
            status: 'PICKED',
            pickedAt: '2026-11-04T02:30:00.000Z',
            pickedBy: { name: 'Demo Warehouse' },
            lines: [{ ...pickDoc().lines[0]!, picked: '8', toPack: '8', discrepancy: 'DAMAGED' }],
            actions: ['pack'],
          });
          return ok({ pick: current, timeline: tl('SALES_PICK_CONFIRMED') });
        },
      }),
    );
    renderRoute('/core/warehouse/picks/p1?lang=en');
    const picked = await screen.findByLabelText('Picked (PCS)');
    expect(screen.queryByLabelText('Why short')).toBeNull();
    await userEvent.clear(picked);
    await userEvent.type(picked, '8');
    await userEvent.selectOptions(screen.getByLabelText('Why short'), 'DAMAGED');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm pick' }));
    await waitFor(() =>
      expect(document.querySelector('[data-doc-status="PICKED"]')).not.toBeNull(),
    );
    expect(api.called(`POST ${W}/picks/p1/confirm`)[0]!.body).toEqual({
      lines: [{ lineId: 'pl1', pickedQuantity: '8', discrepancy: 'DAMAGED' }],
    });
    expect(screen.getByText('Damaged')).toBeInTheDocument();
    // Picked goods can be packed from here.
    expect(screen.getByRole('button', { name: 'Pack picked goods' })).toBeInTheDocument();
    expect(document.getElementById('main')!.textContent).not.toMatch(MONEY);
  });

  it('packing what was picked sends the pick lines and package count, then opens the pack', async () => {
    const picked = pickDoc({
      status: 'PICKED',
      lines: [{ ...pickDoc().lines[0]!, picked: '10', toPack: '10' }],
      actions: ['pack'],
    });
    const api = fakeApi(
      as(false, {
        [`GET ${W}/picks/p1`]: ok({ pick: picked, timeline: tl('SALES_PICK_CONFIRMED') }),
        [`POST ${W}/packs`]: ok({
          pack: packDoc({ status: 'DRAFT', actions: ['confirm', 'cancel'] }),
          timeline: tl('SALES_PACK_CREATED'),
        }),
        [`GET ${W}/packs/k1`]: ok({
          pack: packDoc({ status: 'DRAFT', actions: ['confirm', 'cancel'] }),
          timeline: tl('SALES_PACK_CREATED'),
        }),
      }),
    );
    renderRoute('/core/warehouse/picks/p1?lang=en');
    const count = await screen.findByLabelText('Packages');
    await userEvent.clear(count);
    await userEvent.type(count, '2');
    await userEvent.click(screen.getByRole('button', { name: 'Pack picked goods' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PACK-202611-000001' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${W}/packs`)[0]!.body).toEqual({
      salesOrderId: 'o1',
      lines: [{ pickLineId: 'pl1', quantity: '10' }],
      packageCount: 2,
      packageReference: null,
    });
  });

  it('a packed pack becomes a shipment (blank ship-to = the order customer)', async () => {
    const api = fakeApi(
      as(false, {
        [`GET ${W}/packs/k1`]: ok({ pack: packDoc(), timeline: tl('SALES_PACK_CONFIRMED') }),
        [`POST ${W}/shipments`]: ok({
          shipment: shipment({ actions: ['cancel'] }),
          timeline: tl('SALES_SHIPMENT_CREATED'),
        }),
        [`GET ${W}/shipments/s1`]: ok({
          shipment: shipment({ actions: ['cancel'] }),
          timeline: tl('SALES_SHIPMENT_CREATED'),
        }),
      }),
    );
    renderRoute('/core/warehouse/packs/k1?lang=en');
    await userEvent.type(await screen.findByLabelText('Carrier'), 'Own truck');
    await userEvent.click(screen.getByRole('button', { name: 'Create shipment' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'SHP-202611-000001' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${W}/shipments`)[0]!.body).toEqual({
      salesOrderId: 'o1',
      packIds: ['k1'],
      shipToName: null,
      shipToAddress: null,
      carrier: 'Own truck',
      trackingReference: null,
    });
    // Staff (no dispatch code) see no Dispatch button on a ready shipment.
    expect(screen.queryByRole('button', { name: 'Confirm dispatch' })).toBeNull();
  });

  it('dispatch asks first in exact words, by keyboard; focus returns to the title; Escape cancels', async () => {
    let current = shipment();
    const api = fakeApi(
      as(true, {
        [`GET ${W}/shipments/s1`]: () =>
          ok({ shipment: current, timeline: tl('SALES_SHIPMENT_CREATED') }),
        [`POST ${W}/shipments/s1/dispatch`]: () => {
          current = shipment({
            status: 'DISPATCHED',
            dispatchedAt: '2026-11-04T04:00:00.000Z',
            dispatchedBy: { name: 'Manager' },
            reservationOk: null,
            actions: ['deliver', 'exception'],
          });
          return ok({ shipment: current, timeline: tl('SALES_SHIPMENT_DISPATCHED') });
        },
      }),
    );
    renderRoute('/core/warehouse/shipments/s1?lang=en');
    expect(
      await screen.findByText('Every line is reserved — ready to dispatch.'),
    ).toBeInTheDocument();
    const dispatch = screen.getByRole('button', { name: 'Confirm dispatch' });
    await userEvent.click(dispatch);
    expect(
      screen.getByText(
        'Dispatching will deduct stock and consume the corresponding reservation. This action cannot be undone by editing the shipment.',
      ),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement?.textContent).toContain('SHP-202611-000001');
    expect(api.called(`POST ${W}/shipments/s1/dispatch`)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm dispatch' }));
    // The confirm button has focus: Enter dispatches.
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(document.querySelector('[data-doc-status="DISPATCHED"]')).not.toBeNull(),
    );
    expect(api.called(`POST ${W}/shipments/s1/dispatch`)).toHaveLength(1);
    expect(document.activeElement?.textContent).toContain('SHP-202611-000001');
    expect(screen.getByRole('button', { name: 'Record delivery' })).toBeInTheDocument();
  });

  it('a reservation no longer covering a line hides Dispatch and says why', async () => {
    fakeApi(
      as(true, {
        [`GET ${W}/shipments/s1`]: ok({
          shipment: shipment({ reservationOk: false }),
          timeline: tl('SALES_SHIPMENT_CREATED'),
        }),
      }),
    );
    renderRoute('/core/warehouse/shipments/s1?lang=en');
    expect(
      await screen.findByText('A line is no longer fully reserved — it cannot be dispatched.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm dispatch' })).toBeNull();
  });

  it('delivery: a partial quantity and the recipient are sent; an exception names its reason', async () => {
    const sent = shipment({
      status: 'DISPATCHED',
      dispatchedAt: '2026-11-04T04:00:00.000Z',
      dispatchedBy: { name: 'Manager' },
      reservationOk: null,
      actions: ['deliver', 'exception'],
    });
    const api = fakeApi(
      as(true, {
        [`GET ${W}/shipments/s1`]: ok({
          shipment: sent,
          timeline: tl('SALES_SHIPMENT_DISPATCHED'),
        }),
        [`POST ${W}/shipments/s1/deliver`]: ok({
          shipment: {
            ...sent,
            status: 'DELIVERY_EXCEPTION',
            lines: [{ ...sent.lines[0]!, delivered: '5', outstanding: '3' }],
            events: [
              {
                type: 'PARTIALLY_DELIVERED',
                reason: 'PARTIAL_DELIVERY',
                recipientName: 'Khun A',
                reference: null,
                note: null,
                occurredAt: '2026-11-04T05:00:00.000Z',
                recordedBy: { name: 'Manager' },
              },
            ],
          },
          timeline: tl('SALES_SHIPMENT_DELIVERED'),
        }),
        [`POST ${W}/shipments/s1/exception`]: ok({
          shipment: sent,
          timeline: tl('SALES_SHIPMENT_EXCEPTION'),
        }),
      }),
    );
    renderRoute('/core/warehouse/shipments/s1?lang=en');
    const qty = await screen.findByLabelText('PK-000001 · MAIN (PCS)');
    await userEvent.clear(qty);
    await userEvent.type(qty, '5');
    await userEvent.type(screen.getByLabelText('Received by'), 'Khun A');
    await userEvent.click(screen.getByRole('button', { name: 'Record delivery' }));
    await waitFor(() => expect(screen.getAllByText('Partly delivered').length).toBeGreaterThan(0));
    expect(api.called(`POST ${W}/shipments/s1/deliver`)[0]!.body).toEqual({
      lines: [{ lineId: 'sl1', quantity: '5' }],
      recipientName: 'Khun A',
      reference: null,
      note: null,
    });
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'RECIPIENT_UNAVAILABLE');
    await userEvent.click(screen.getByRole('button', { name: 'Record exception' }));
    await waitFor(() => expect(api.called(`POST ${W}/shipments/s1/exception`)).toHaveLength(1));
    expect(api.called(`POST ${W}/shipments/s1/exception`)[0]!.body).toEqual({
      reason: 'RECIPIENT_UNAVAILABLE',
    });
    expect(document.getElementById('main')!.textContent).not.toMatch(MONEY);
  });

  it('speaks Thai and Chinese (actions, statuses, the way back to the list)', async () => {
    fakeApi(
      as(true, {
        [`GET ${W}/shipments/s1`]: ok({
          shipment: shipment(),
          timeline: tl('SALES_SHIPMENT_CREATED'),
        }),
      }),
    );
    const { unmount } = renderRoute('/core/warehouse/shipments/s1?lang=th');
    expect(await screen.findByRole('button', { name: 'ยืนยันการส่งออก' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← การจัดส่ง' })).toBeInTheDocument();
    expect(screen.getByText('พร้อมส่งออก')).toBeInTheDocument();
    unmount();
    fakeApi(
      as(true, {
        [`GET ${W}/shipments/s1`]: ok({
          shipment: shipment(),
          timeline: tl('SALES_SHIPMENT_CREATED'),
        }),
      }),
    );
    renderRoute('/core/warehouse/shipments/s1?lang=zh');
    expect(await screen.findByRole('button', { name: '确认发运' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← 发运' })).toBeInTheDocument();
  });

  it('Sales sees per-line progress in its unit and the shipments — no location, lot or Warehouse link', async () => {
    const salesCtx: SalesContext = {
      orders: { view: true, create: true, confirm: false, cancel: false },
      branches: [{ ...REF, type: 'BRANCH' }],
      selectedBranch: { ...REF, type: 'BRANCH' },
      counts: { myDrafts: 0, awaitingConfirmation: 0, confirmed: 1, withShortage: 0 },
      today: '2026-11-04',
    };
    const order = {
      id: 'o1',
      number: 'SO-202611-000009',
      status: 'CONFIRMED',
      branch: REF,
      customer: { id: 'cu1', code: 'CUS-000001', name: 'Demo Shop', taxId: null, taxBranch: null },
      orderDate: '2026-11-04',
      requestedDate: null,
      lineCount: 1,
      currency: 'THB',
      grandTotal: '192.60',
      availability: 'AVAILABLE',
      allocationState: 'FULLY_ALLOCATED',
      pickReadiness: 'READY',
      createdBy: { name: 'Owner' },
      updatedAt: '2026-11-04T02:00:00.000Z',
      customerReference: null,
      note: null,
      subtotal: '180.00',
      discountTotal: '0.00',
      taxTotal: '12.60',
      taxTotalLabel: 'exclusive',
      shortageLines: 0,
      createdAt: '2026-11-04T01:00:00.000Z',
      submittedAt: null,
      submittedBy: null,
      confirmedAt: '2026-11-04T01:00:00.000Z',
      confirmedBy: { name: 'Owner' },
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      lines: [
        {
          id: 'l1',
          lineNo: 1,
          item: {
            id: 'i1',
            code: 'PK-000001',
            name: 'Box',
            type: 'PACKAGING',
            inventoryTracked: true,
          },
          unit: { code: 'PCS', name: 'Piece', precision: 0 },
          quantity: '10',
          unitPrice: '18',
          discountAmount: '0.00',
          taxRate: '7',
          lineSubtotal: '180.00',
          lineTax: '12.60',
          lineTotal: '192.60',
          note: null,
          availability: {
            state: 'AVAILABLE',
            onHand: '80',
            reserved: '40',
            available: '40',
            shortage: '0',
          },
          allocation: { allocated: '10', shortage: '0' },
          progress: {
            ordered: '10',
            allocated: '10',
            picked: '10',
            packed: '10',
            dispatched: '4',
            delivered: '4',
            toDispatch: '6',
            toDeliver: '0',
          },
        },
      ],
      actions: [],
    } as unknown as SalesOrder;
    fakeApi({
      ...person('DEPARTMENT_STAFF', ['sales.workspace.view', 'sales.orders.view'], ['SALES']),
      'GET /api/v1/sales/context': ok(salesCtx),
      'GET /api/v1/sales/orders/o1': ok({
        order,
        fulfilment: {
          state: 'PARTIALLY_DELIVERED',
          shipments: [
            {
              number: 'SHP-202611-000001',
              status: 'DELIVERED',
              dispatchedAt: '2026-11-04T04:00:00.000Z',
              deliveredAt: '2026-11-04T06:00:00.000Z',
              exception: null,
            },
          ],
        },
        timeline: [],
      }),
    });
    renderRoute('/core/sales/orders/o1?lang=en');
    const block = await waitFor(() => {
      const el = document.querySelector('[data-fulfilment]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(within(block).getByText('Partly delivered')).toBeInTheDocument();
    expect(block.textContent).toMatch(/Dispatched4 PCS/);
    expect(block.textContent).toMatch(/To dispatch6 PCS/);
    expect(within(block).getByText('SHP-202611-000001')).toBeInTheDocument();
    expect(within(block).queryByRole('link')).toBeNull();
    expect(block.textContent).not.toMatch(/MAIN|lot/i);
  });
});

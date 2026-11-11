import { Menu, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { getDepartment } from '@/config/departments';
import { departmentId, type DepartmentCode } from '@/features/company/api';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import type { BranchContext } from './api';
import { AreaLink } from './parts';

/*
 * EP38.4 — CORE operational navigation: one permission-driven model behind the
 * desktop sidebar, the mobile drawer and the home quick actions. Presentation
 * only: every route and action is checked again by its workspace and the server
 * (a link is never an authorization). Entries follow the codes the server
 * returned for this person (`context.permissions`), so a Sales Staff member
 * sees Sales orders and "New sales order", never a manager action.
 */

const th = {
  label: 'เมนู CORE',
  home: 'ภาพรวม CORE',
  menu: 'เมนู',
  close: 'ปิดเมนู',
  workingIn: 'สาขาที่ทำงาน',
  changeBranch: 'เปลี่ยนสาขา',
  controlCenter: 'Company Control Center',
  quick: 'ทางลัด',
  quickLead: 'งานที่คุณทำได้บ่อยที่สุด — ตามสิทธิ์ของคุณ',
  items: {
    salesOrders: 'คำสั่งขาย',
    newSalesOrder: 'สร้างคำสั่งขาย',
    purchaseRequests: 'ใบขอซื้อ',
    newPurchaseRequest: 'สร้างใบขอซื้อ',
    purchaseOrders: 'ใบสั่งซื้อ',
    shortages: 'วัตถุดิบขาดสำหรับการผลิต',
    production: 'การผลิต',
    newProductionOrder: 'สร้างใบสั่งผลิต',
    warehouseHome: 'ภาพรวมคลังสินค้า',
    inventory: 'สต็อกคงคลัง',
    pendingPick: 'รอหยิบสินค้า',
    finishedGoods: 'รับสินค้าสำเร็จรูป',
    newTransfer: 'สร้างใบโอนย้าย',
    deposits: 'มัดจำผู้ขาย',
    pendingReceive: 'รอรับสินค้า',
    receipts: 'ใบรับสินค้า',
    lots: 'ล็อตและวันหมดอายุ',
    movements: 'ความเคลื่อนไหว',
    transfers: 'โอนย้าย',
    adjustments: 'ปรับปรุงสต็อก',
    counts: 'ตรวจนับ',
    picks: 'ใบหยิบ',
    packs: 'แพ็กสินค้า',
    shipments: 'จัดส่ง',
    materialIssues: 'เบิกวัตถุดิบผลิต',
  },
  filters: {
    awaiting: 'รอยืนยัน',
    confirmed: 'ยืนยันแล้ว',
    shortage: 'สต็อกไม่พอ',
  },
  filtersLabel: 'กรองคำสั่งขาย',
};
type NavCopy = typeof th;
type ItemKey = keyof NavCopy['items'];

const CORE_NAV_COPY: Localized<NavCopy> = {
  th,
  en: {
    label: 'CORE menu',
    home: 'CORE overview',
    menu: 'Menu',
    close: 'Close menu',
    workingIn: 'Working branch',
    changeBranch: 'Change branch',
    controlCenter: 'Company Control Center',
    quick: 'Quick actions',
    quickLead: 'What you do most — within your permissions.',
    items: {
      salesOrders: 'Sales orders',
      newSalesOrder: 'New sales order',
      purchaseRequests: 'Purchase requests',
      newPurchaseRequest: 'New purchase request',
      purchaseOrders: 'Purchase orders',
      shortages: 'Production shortages',
      production: 'Production',
      newProductionOrder: 'New production order',
      warehouseHome: 'Warehouse overview',
      inventory: 'Inventory',
      pendingPick: 'Pending pick',
      finishedGoods: 'Finished goods',
      newTransfer: 'New transfer',
      deposits: 'Supplier deposits',
      pendingReceive: 'Pending receive',
      receipts: 'Goods receipts',
      lots: 'Lots & expiry',
      movements: 'Movements',
      transfers: 'Transfers',
      adjustments: 'Adjustments',
      counts: 'Cycle counts',
      picks: 'Picks',
      packs: 'Packing',
      shipments: 'Shipments',
      materialIssues: 'Production issues',
    },
    filters: {
      awaiting: 'Awaiting confirmation',
      confirmed: 'Confirmed',
      shortage: 'Short of stock',
    },
    filtersLabel: 'Filter sales orders',
  },
  'zh-CN': {
    label: 'CORE 菜单',
    home: 'CORE 概览',
    menu: '菜单',
    close: '关闭菜单',
    workingIn: '工作分支',
    changeBranch: '切换分支',
    controlCenter: 'Company Control Center',
    quick: '快捷操作',
    quickLead: '您最常用的操作 — 按您的权限显示。',
    items: {
      salesOrders: '销售订单',
      newSalesOrder: '新建销售订单',
      purchaseRequests: '请购单',
      newPurchaseRequest: '新建请购单',
      purchaseOrders: '采购订单',
      shortages: '生产缺料',
      production: '生产',
      newProductionOrder: '新建生产订单',
      warehouseHome: '仓库概览',
      inventory: '库存',
      pendingPick: '待拣货',
      finishedGoods: '成品入库',
      newTransfer: '新建调拨单',
      deposits: '供应商定金',
      pendingReceive: '待收货',
      receipts: '收货单',
      lots: '批次与有效期',
      movements: '库存变动',
      transfers: '调拨',
      adjustments: '库存调整',
      counts: '循环盘点',
      picks: '拣货单',
      packs: '包装',
      shipments: '发运',
      materialIssues: '生产领料',
    },
    filters: {
      awaiting: '待确认',
      confirmed: '已确认',
      shortage: '库存不足',
    },
    filtersLabel: '筛选销售订单',
  },
};

interface Item {
  to: string;
  key: ItemKey;
  /** The codes that open it (any one) — presentation only. */
  needs: RegExp;
  /** Shown as a quick action on the CORE home. */
  quick?: boolean;
  /**
   * EP42.3: a section page shown only while the person works in this department (the
   * group of the current page); elsewhere the group keeps its main entries short.
   */
  section?: boolean;
  /** EP42.3: list filters (query strings the list reads from its URL), under the entry. */
  filters?: [keyof NavCopy['filters'], string][];
}

const WH = '/core/warehouse';
const RECEIVING = /^warehouse\.receiving\.view$/;
const INVENTORY = /^warehouse\.inventory\.view$/;
const REQUEST_VIEW =
  /^(purchasing\.requests\.(view|create|approve)|[a-z]+\.purchase_requests\.(create|approve))$/;
const NAV: [DepartmentCode, Item[]][] = [
  [
    'SALES',
    [
      {
        to: '/core/sales',
        key: 'salesOrders',
        needs: /^sales\.orders\.view$/,
        filters: [
          ['awaiting', 'status=SUBMITTED'],
          ['confirmed', 'status=CONFIRMED'],
          ['shortage', 'availability=SHORTAGE'],
        ],
      },
      {
        to: '/core/sales/orders/new',
        key: 'newSalesOrder',
        needs: /^sales\.orders\.create$/,
        quick: true,
      },
    ],
  ],
  [
    'PURCHASING',
    [
      { to: '/core/purchasing/requests', key: 'purchaseRequests', needs: REQUEST_VIEW },
      {
        to: '/core/purchasing/requests/new',
        key: 'newPurchaseRequest',
        needs: /^(purchasing\.requests\.create|[a-z]+\.purchase_requests\.create)$/,
        quick: true,
      },
      { to: '/core/purchasing/orders', key: 'purchaseOrders', needs: /^purchasing\.orders\.view$/ },
      {
        to: '/core/purchasing/production-shortages',
        key: 'shortages',
        needs: /^purchasing\.production_shortages\.view$/,
      },
    ],
  ],
  [
    'OPERATIONS',
    [
      { to: '/core/production', key: 'production', needs: /^operations\.orders\.view$/ },
      {
        to: '/core/production/orders/new',
        key: 'newProductionOrder',
        needs: /^operations\.orders\.create$/,
        quick: true,
      },
    ],
  ],
  [
    'WAREHOUSE',
    [
      { to: '/core/warehouse', key: 'warehouseHome', needs: /^warehouse\.receiving\.view$/ },
      // EP42.3: every Warehouse section, as its tab strip shows them (same codes as the
      // workspace's own context); the sections appear while working in Warehouse.
      { to: `${WH}/pending-receive`, key: 'pendingReceive', needs: RECEIVING, section: true },
      { to: `${WH}/receipts`, key: 'receipts', needs: RECEIVING, section: true },
      { to: `${WH}/inventory`, key: 'inventory', needs: INVENTORY },
      { to: `${WH}/lots`, key: 'lots', needs: INVENTORY, section: true },
      { to: `${WH}/movements`, key: 'movements', needs: INVENTORY, section: true },
      { to: `${WH}/transfers`, key: 'transfers', needs: INVENTORY, section: true },
      { to: `${WH}/adjustments`, key: 'adjustments', needs: INVENTORY, section: true },
      { to: `${WH}/counts`, key: 'counts', needs: INVENTORY, section: true },
      {
        to: `${WH}/pending-pick`,
        key: 'pendingPick',
        needs: /^warehouse\.(picking\.process|inventory\.view)$/,
        quick: true,
      },
      { to: `${WH}/picks`, key: 'picks', needs: INVENTORY, section: true },
      { to: `${WH}/packs`, key: 'packs', needs: INVENTORY, section: true },
      { to: `${WH}/shipments`, key: 'shipments', needs: INVENTORY, section: true },
      {
        to: `${WH}/material-issues`,
        key: 'materialIssues',
        needs: /^warehouse\.material_issues\.view$/,
        section: true,
      },
      {
        to: `${WH}/finished-goods`,
        key: 'finishedGoods',
        needs: /^warehouse\.finished_goods\.view$/,
      },
      {
        to: '/core/warehouse/transfers/new',
        key: 'newTransfer',
        needs: /^warehouse\.transfers\.create$/,
        quick: true,
      },
    ],
  ],
  [
    'ACCOUNTING',
    [{ to: '/core/accounting/deposits', key: 'deposits', needs: /^accounting\.deposits\.view$/ }],
  ],
];

/** The groups and entries this person may open (any code of theirs matches). */
function navFor(context: BranchContext) {
  const codes = context.permissions ?? [];
  return NAV.map(([code, items]) => ({
    code,
    items: items.filter((i) => codes.some((x) => i.needs.test(x))),
  })).filter((g) => g.items.length > 0);
}

/** The entry the current path belongs to: the longest matching route wins. */
function currentOf(groups: ReturnType<typeof navFor>, path: string) {
  let best: string | null = null;
  for (const g of groups) {
    for (const i of g.items) {
      if ((path === i.to || path.startsWith(`${i.to}/`)) && i.to.length > (best?.length ?? 0)) {
        best = i.to;
      }
    }
  }
  return best;
}

const LINK =
  'flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-label transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none';

/** The navigation itself — shared by the sidebar and the drawer. */
function NavList({
  context,
  branchLabel,
  onNavigate,
}: {
  context: BranchContext;
  branchLabel: string | null;
  onNavigate?: () => void;
}) {
  const n = useCopy(CORE_NAV_COPY);
  const { locale } = useLocale();
  const { pathname, search } = useLocation();
  const groups = navFor(context);
  const current = pathname === '/core' ? '/core' : currentOf(groups, pathname);
  // A list filter is current when the page is its list with exactly that query.
  // (?lang= only names the language; it is not part of a filter.)
  const params = new URLSearchParams(search);
  params.delete('lang');
  const query = params.toString();
  const filtered =
    !!query &&
    groups.some((g) =>
      g.items.some((i) => i.to === current && i.filters?.some(([, q]) => q === query)),
    );
  const link = (to: string, label: string, plus = false, active = current === to && !filtered) => (
    <AreaLink
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        LINK,
        active
          ? 'bg-brand-primary/[0.12] font-semibold text-text-primary shadow-[inset_2px_0_0_rgb(62_240_192/0.9)]'
          : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
      )}
    >
      {plus && <Plus aria-hidden className="size-4 shrink-0 text-brand-glow" />}
      <span className="min-w-0">{label}</span>
    </AreaLink>
  );
  return (
    <div className="grid gap-5">
      {branchLabel && (
        <div className="rounded-xl bg-white/[0.025] px-3 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]">
          <p className="text-caption text-text-muted">{n.workingIn}</p>
          <p
            className="mt-0.5 text-label font-semibold break-words text-text-primary"
            data-nav-branch
          >
            {branchLabel}
          </p>
          {context.branches.length > 1 && (
            <AreaLink
              to="/core/branch"
              // EP39: back to this page after the change (the selector accepts CORE pages only).
              state={{ from: `${pathname}${search}` }}
              onClick={onNavigate}
              className="mt-1 inline-flex min-h-8 items-center text-caption font-medium text-brand-glow underline-offset-4 hover:underline"
            >
              {n.changeBranch}
            </AreaLink>
          )}
        </div>
      )}
      <ul className="grid gap-1">
        <li>{link('/core', n.home)}</li>
      </ul>
      {groups.map((g) => {
        const here = g.items.some((i) => i.to === current);
        return (
          <div key={g.code} data-nav-group={g.code} data-nav-current={here || undefined}>
            <p className="mb-1.5 px-3 font-mono text-[0.6875rem] tracking-[0.14em] text-text-muted uppercase">
              {getDepartment(departmentId(g.code), locale).name}
            </p>
            <ul className="grid gap-0.5">
              {g.items
                .filter((i) => here || !i.section)
                .map((i) => (
                  <li key={i.to}>
                    {link(i.to, n.items[i.key], /\/new$/.test(i.to))}
                    {here && i.filters && (
                      <ul
                        aria-label={n.filtersLabel}
                        className="mt-0.5 mb-1 ml-3 grid gap-0.5 border-l border-white/[0.08] pl-2"
                        data-nav-filters
                      >
                        {i.filters.map(([key, q]) => (
                          <li key={q}>
                            {link(
                              `${i.to}?${q}`,
                              n.filters[key],
                              false,
                              current === i.to && query === q,
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Desktop: a persistent sidebar beside every CORE page. */
export function CoreSidebar(props: { context: BranchContext; branchLabel: string | null }) {
  const n = useCopy(CORE_NAV_COPY);
  return (
    <nav
      aria-label={n.label}
      className="sticky top-0 hidden max-h-dvh overflow-y-auto border-r border-white/[0.06] px-4 py-6 xl:block"
      data-core-sidebar
    >
      <NavList {...props} />
    </nav>
  );
}

/** Mobile / tablet: a "Menu" button opening the same navigation in a drawer. */
export function CoreMenuButton(props: { context: BranchContext; branchLabel: string | null }) {
  const n = useCopy(CORE_NAV_COPY);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      } else if (e.key === 'Tab' && panel.current) {
        // A modal drawer: Tab and Shift+Tab wrap inside it, never into the page behind.
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button')];
        const first = items[0];
        const last = items[items.length - 1];
        const inside = panel.current.contains(document.activeElement);
        if (e.shiftKey && (!inside || document.activeElement === first)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={buttonClasses('secondary', 'md', 'px-3.5 xl:hidden')}
        data-core-menu
      >
        <Menu aria-hidden className="size-4" />
        <span className="max-sm:sr-only">{n.menu}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-80 xl:hidden">
          <div aria-hidden className="absolute inset-0 bg-black/60" onClick={close} />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto bg-surface-dark px-4 py-5 shadow-[inset_-1px_0_0_rgb(190_235_222/0.1)]"
            data-core-drawer
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-body font-semibold text-text-primary">
                {n.label}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={n.close}
                className={buttonClasses('ghost', 'md', 'px-3')}
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <nav aria-label={n.label}>
              <NavList {...props} onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

/** CORE home: the actions this person does most, one click away. */
export function QuickActions({ context }: { context: BranchContext }) {
  const n = useCopy(CORE_NAV_COPY);
  const quick = navFor(context).flatMap((g) => g.items.filter((i) => i.quick));
  if (!quick.length) return null;
  return (
    <section aria-labelledby="core-quick-title" className="grid gap-3" data-quick-actions>
      <div>
        <h2 id="core-quick-title" className="text-body font-semibold text-text-primary">
          {n.quick}
        </h2>
        <p className="mt-1 text-caption text-text-muted">{n.quickLead}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {quick.map((i) => (
          <li key={i.to}>
            <AreaLink
              to={i.to}
              className={buttonClasses(i.to.endsWith('/new') ? 'primary' : 'secondary', 'md')}
              data-quick={i.key}
            >
              {i.to.endsWith('/new') && <Plus aria-hidden className="size-4" />}
              {n.items[i.key]}
            </AreaLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

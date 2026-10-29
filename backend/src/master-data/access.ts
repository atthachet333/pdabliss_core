import type { AdminPermission, PermissionCode } from '../permissions/catalog.js';

/*
 * Who may read and maintain each kind of master record (EP28) — expressed
 * only in EP27 catalog codes; the resolver decides who holds them (role
 * default, department assignment, package, exceptions with DENY first).
 *
 *   resource    view (any of)                                   manage (any of)
 *   customers   sales / accounting customers.view               sales.customers.manage
 *   suppliers   purchasing / accounting suppliers.view          purchasing.suppliers.manage
 *   items       operations / sales / purchasing / warehouse     operations.items.manage
 *               items.view
 *   units       = items (units and categories classify items)
 *   categories  = items
 *   locations   warehouse.locations.view + branch access        warehouse.locations.manage
 *                                                                + branch access
 *
 * `company.master_data.manage` (Owner and System Admin) reads and maintains
 * everything, in every branch — company administration authority, as for
 * branches and people. No view grants a financial field: master records hold
 * none (identity only), and Warehouse reads exactly the same safe views.
 */

export const MASTER_ADMIN: AdminPermission = 'company.master_data.manage';

export const MASTER_RESOURCES = [
  'customers',
  'suppliers',
  'items',
  'units',
  'categories',
  'locations',
] as const;
export type MasterResource = (typeof MASTER_RESOURCES)[number];

type CompanyResource = Exclude<MasterResource, 'locations'>;

const ITEM_VIEW: readonly PermissionCode[] = [
  MASTER_ADMIN,
  'operations.items.view',
  'sales.items.view',
  'purchasing.items.view',
  'warehouse.items.view',
];
const ITEM_MANAGE: readonly PermissionCode[] = [MASTER_ADMIN, 'operations.items.manage'];

export const MASTER_ACCESS: Readonly<
  Record<CompanyResource, { view: readonly PermissionCode[]; manage: readonly PermissionCode[] }>
> = {
  customers: {
    view: [MASTER_ADMIN, 'sales.customers.view', 'accounting.customers.view'],
    manage: [MASTER_ADMIN, 'sales.customers.manage'],
  },
  suppliers: {
    view: [MASTER_ADMIN, 'purchasing.suppliers.view', 'accounting.suppliers.view'],
    manage: [MASTER_ADMIN, 'purchasing.suppliers.manage'],
  },
  items: { view: ITEM_VIEW, manage: ITEM_MANAGE },
  units: { view: ITEM_VIEW, manage: ITEM_MANAGE },
  categories: { view: ITEM_VIEW, manage: ITEM_MANAGE },
};

export const LOCATION_VIEW = 'warehouse.locations.view' as const;
export const LOCATION_MANAGE = 'warehouse.locations.manage' as const;

/** What a holder of these codes may do, per resource (screens only show / hide with it). */
export function masterCapabilities(permissions: readonly PermissionCode[]) {
  const any = (codes: readonly PermissionCode[]) => codes.some((c) => permissions.includes(c));
  const admin = permissions.includes(MASTER_ADMIN);
  const out = {} as Record<MasterResource, { view: boolean; manage: boolean }>;
  for (const r of MASTER_RESOURCES) {
    out[r] =
      r === 'locations'
        ? {
            view: admin || permissions.includes(LOCATION_VIEW),
            manage: admin || permissions.includes(LOCATION_MANAGE),
          }
        : { view: any(MASTER_ACCESS[r].view), manage: any(MASTER_ACCESS[r].manage) };
  }
  return { admin, resources: out };
}

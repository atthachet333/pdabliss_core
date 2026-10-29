import { apiRequest } from '@/lib/api';

/*
 * Typed client for EP28 operational master data (/api/v1/master-data/…).
 * Contracts: docs/OPERATIONAL_MASTER_DATA.md. The client never sends a
 * company id; every id is looked up inside the caller's company and every
 * call is authorized again by the server (capabilities only shape screens).
 */

export const RESOURCES = [
  'customers',
  'suppliers',
  'items',
  'units',
  'categories',
  'locations',
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Status = 'ACTIVE' | 'INACTIVE';
export type Tracking = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export const ITEM_TYPES = [
  'FINISHED_GOOD',
  'RAW_MATERIAL',
  'PACKAGING',
  'CONSUMABLE',
  'NON_STOCK',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export interface MasterBranch {
  id: string;
  code: string;
  name: string;
  type: 'HEAD_OFFICE' | 'BRANCH';
  status: string;
  canManage: boolean;
}

export interface MasterContext {
  capabilities: Record<Resource, { view: boolean; manage: boolean }>;
  companyWide: boolean;
  branches: MasterBranch[];
}

interface Ref {
  id: string;
  code: string;
  name: string;
  status: Status;
}

/** One record as the API returns it — the fields depend on the resource. */
export interface MasterRecord extends Ref {
  [field: string]: unknown;
  deactivatedAt?: string | null;
  updatedAt: string;
  // items
  type?: ItemType;
  baseUnit?: Ref & { symbol: string | null; precision: number };
  category?: Ref | null;
  inventoryTracked?: boolean;
  lotTracking?: Tracking;
  expiryTracking?: Tracking;
  // locations
  branch?: Omit<MasterBranch, 'canManage'>;
  parent?: Ref | null;
  isDefault?: boolean;
}

export interface MasterList {
  items: MasterRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  canManage: boolean;
}

/** The singular key each detail response uses (`{ customer: … }`). */
export const SINGULAR: Record<Resource, string> = {
  customers: 'customer',
  suppliers: 'supplier',
  items: 'item',
  units: 'unit',
  categories: 'category',
  locations: 'location',
};

export interface MasterDetail {
  record: MasterRecord;
  canManage: boolean;
  usage?: { items: number; activeItems: number };
  activeChildren?: number;
}

const BASE = '/api/v1/master-data';

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

const detail = (r: Resource, body: Record<string, unknown>): MasterDetail => ({
  record: body[SINGULAR[r]] as MasterRecord,
  canManage: body.canManage as boolean,
  usage: body.usage as MasterDetail['usage'],
  activeChildren: body.activeChildren as number | undefined,
});

export const masterApi = {
  context: () => apiRequest<MasterContext>('GET', `${BASE}/context`),
  list: (r: Resource, params: Record<string, string | number | undefined>) =>
    apiRequest<MasterList>('GET', `${BASE}/${r}${query(params)}`),
  get: async (r: Resource, id: string) =>
    detail(r, await apiRequest('GET', `${BASE}/${r}/${encodeURIComponent(id)}`)),
  create: async (r: Resource, body: Record<string, unknown>) =>
    detail(r, await apiRequest('POST', `${BASE}/${r}`, body)).record,
  update: async (r: Resource, id: string, body: Record<string, unknown>) =>
    detail(r, await apiRequest('PATCH', `${BASE}/${r}/${encodeURIComponent(id)}`, body)).record,
  structure: async (id: string, body: Record<string, unknown>) =>
    detail(
      'items',
      await apiRequest('PUT', `${BASE}/items/${encodeURIComponent(id)}/structure`, body),
    ).record,
  setStatus: async (r: Resource, id: string, active: boolean) =>
    detail(
      r,
      await apiRequest(
        'POST',
        `${BASE}/${r}/${encodeURIComponent(id)}/${active ? 'reactivate' : 'deactivate'}`,
      ),
    ).record,
};

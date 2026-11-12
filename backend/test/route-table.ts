import type { Harness } from './support.js';

/*
 * The API's REAL route table, parsed from Fastify's own registry (EP45; the
 * same parser the EP40 sweeps use). Used to sweep every route of a kind so a
 * route added later cannot silently skip a shared rule.
 */

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface Route {
  method: Method;
  path: string;
}

export function routesOf(h: Harness): Route[] {
  const stack: string[] = [];
  const out = new Set<string>();
  for (const line of h.app.printRoutes({ commonPrefix: false }).split('\n')) {
    const m = /^([│ ]*)[├└]── (.*?) \(([^)]+)\)$/.exec(line);
    if (!m) continue;
    const depth = m[1]!.length / 4;
    stack.length = depth;
    stack[depth] = m[2]!;
    const path = stack.join('').replace(/\/+/g, '/');
    if (path === '*') continue;
    for (const method of m[3]!.split(', ')) if (method !== 'HEAD') out.add(`${method} ${path}`);
  }
  return [...out].map((s) => {
    const [method, path] = s.split(' ');
    return { method: method as Method, path: path! };
  });
}

/** Route pattern → the record kind whose real id fills `:id` (and `:…Id`), as in EP40. */
export const ID_RULES: [RegExp, string][] = [
  [/^\/api\/v1\/sales\/orders\/:id/, 'so'],
  [/^\/api\/v1\/purchase-requests\/:id\/lines\/:lineId/, 'pr|prLine'],
  [/^\/api\/v1\/purchase-requests\/:id/, 'pr'],
  [/^\/api\/v1\/purchase-orders\/source-requests\/:id/, 'pr'],
  [/^\/api\/v1\/purchase-orders\/:id\/lines\/:lineId/, 'po|poLine'],
  [/^\/api\/v1\/purchase-orders\/:id/, 'po'],
  [/^\/api\/v1\/accounting\/deposits\/:id/, 'deposit'],
  [/^\/api\/v1\/warehouse\/pending-receive\/:id/, 'po'],
  [/^\/api\/v1\/warehouse\/receipts\/:id\/lines\/:lineId/, 'gr|grLine'],
  [/^\/api\/v1\/warehouse\/receipts\/:id/, 'gr'],
  [/^\/api\/v1\/warehouse\/transfers\/:id/, 'transfer'],
  [/^\/api\/v1\/warehouse\/adjustments\/:id/, 'adjustment'],
  [/^\/api\/v1\/warehouse\/counts\/:id/, 'count'],
  [/^\/api\/v1\/warehouse\/picks\/:id/, 'pick'],
  [/^\/api\/v1\/warehouse\/packs\/:id/, 'pack'],
  [/^\/api\/v1\/warehouse\/shipments\/:id/, 'shipment'],
  [/^\/api\/v1\/warehouse\/finished-goods\/receipts\/:id/, 'fgr'],
  [/^\/api\/v1\/warehouse\/material-issues\/:id/, 'issue'],
  [/^\/api\/v1\/production\/orders\/:id\/materials\/:materialId/, 'mo|material'],
  [/^\/api\/v1\/production\/orders\/:id/, 'mo'],
  [/^\/api\/v1\/production\/issues\/:id/, 'issue'],
  [/^\/api\/v1\/production\/outputs\/:id/, 'output'],
  [/^\/api\/v1\/production\/boms\/:id/, 'bom'],
  [/^\/api\/v1\/master-data\/items\/:id/, 'item'],
  [/^\/api\/v1\/master-data\/customers\/:id/, 'customer'],
  [/^\/api\/v1\/master-data\/suppliers\/:id/, 'supplier'],
  [/^\/api\/v1\/master-data\/units\/:id/, 'unit'],
  [/^\/api\/v1\/master-data\/categories\/:id/, 'category'],
  [/^\/api\/v1\/master-data\/locations\/:id/, 'location'],
  [/^\/api\/v1\/company\/current\/members\/:id/, 'member'],
  [/^\/api\/v1\/company\/current\/branches\/:id/, 'branch'],
];

/** A concrete URL for a route pattern, with real ids where known. */
export function urlWith(ids: Record<string, string | undefined>, path: string) {
  let out = path;
  const take = (key: string) => ids[key] ?? 'cm0000000000000000000000000';
  for (const [re, keys] of ID_RULES) {
    if (!re.test(path)) continue;
    const [first, second] = keys.split('|') as [string, string | undefined];
    out = out.replace(':id', take(first));
    if (second) out = out.replace(/:[a-zA-Z]+Id/, take(second));
    break;
  }
  return out.replace(':department', 'sales').replace(/:[a-zA-Z]+/g, 'cm0000000000000000000000000');
}

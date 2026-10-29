import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import { IdParams } from '../../company/input.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';
import {
  CategoryCreateBody,
  CategoryUpdateBody,
  CustomerCreateBody,
  CustomerListQuery,
  CustomerUpdateBody,
  ItemCreateBody,
  ItemListQuery,
  ItemStructureBody,
  ItemUpdateBody,
  ListQuery,
  LocationCreateBody,
  LocationListQuery,
  LocationUpdateBody,
  SupplierCreateBody,
  SupplierUpdateBody,
  UnitCreateBody,
  UnitUpdateBody,
} from '../../master-data/input.js';
import { MasterDataService } from '../../master-data/service.js';

/*
 * /api/v1/master-data — operational master data (EP28).
 *
 *   GET    /context                         what the caller may do; visible branches
 *   GET    /<resource>                      search / filters / sort / pages
 *   POST   /<resource>                      create (201)
 *   GET    /<resource>/:id                  one record
 *   PATCH  /<resource>/:id                  edit (codes and item types are fixed)
 *   POST   /<resource>/:id/deactivate       reversible; nothing is deleted
 *   POST   /<resource>/:id/reactivate
 *   PUT    /items/:id/structure             base unit + tracking (structure policy)
 *
 * resources: customers · suppliers · items · units · categories · locations.
 * No company id is ever taken from the client; every id is looked up inside
 * the caller's company, and every route goes through the EP27 guard (in the
 * service, first thing). Platform operators are refused (no company context).
 */

export const masterDataRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.addHook('preHandler', requireSession);
  const md = new MasterDataService(db);
  const auth = requireAuth;
  const meta = requestMeta;
  const idOf = (params: unknown) => parseInput(IdParams, params).id;
  const body = { bodyLimit: 16 * 1024 };

  app.get('/context', async (request) => md.context(auth(request)));

  // ---- customers
  app.get('/customers', async (r) => md.customers(auth(r), parseInput(CustomerListQuery, r.query)));
  app.post('/customers', body, async (r, reply) =>
    reply
      .status(201)
      .send(await md.createCustomer(auth(r), parseInput(CustomerCreateBody, r.body), meta(r))),
  );
  app.get('/customers/:id', async (r) => md.customer(auth(r), idOf(r.params)));
  app.patch('/customers/:id', body, async (r) =>
    md.updateCustomer(auth(r), idOf(r.params), parseInput(CustomerUpdateBody, r.body), meta(r)),
  );
  app.post('/customers/:id/deactivate', async (r) =>
    md.setCustomerStatus(auth(r), idOf(r.params), 'INACTIVE', meta(r)),
  );
  app.post('/customers/:id/reactivate', async (r) =>
    md.setCustomerStatus(auth(r), idOf(r.params), 'ACTIVE', meta(r)),
  );

  // ---- suppliers
  app.get('/suppliers', async (r) => md.suppliers(auth(r), parseInput(ListQuery, r.query)));
  app.post('/suppliers', body, async (r, reply) =>
    reply
      .status(201)
      .send(await md.createSupplier(auth(r), parseInput(SupplierCreateBody, r.body), meta(r))),
  );
  app.get('/suppliers/:id', async (r) => md.supplier(auth(r), idOf(r.params)));
  app.patch('/suppliers/:id', body, async (r) =>
    md.updateSupplier(auth(r), idOf(r.params), parseInput(SupplierUpdateBody, r.body), meta(r)),
  );
  app.post('/suppliers/:id/deactivate', async (r) =>
    md.setSupplierStatus(auth(r), idOf(r.params), 'INACTIVE', meta(r)),
  );
  app.post('/suppliers/:id/reactivate', async (r) =>
    md.setSupplierStatus(auth(r), idOf(r.params), 'ACTIVE', meta(r)),
  );

  // ---- units
  app.get('/units', async (r) => md.units(auth(r), parseInput(ListQuery, r.query)));
  app.post('/units', body, async (r, reply) =>
    reply
      .status(201)
      .send(await md.createUnit(auth(r), parseInput(UnitCreateBody, r.body), meta(r))),
  );
  app.get('/units/:id', async (r) => md.unit(auth(r), idOf(r.params)));
  app.patch('/units/:id', body, async (r) =>
    md.updateUnit(auth(r), idOf(r.params), parseInput(UnitUpdateBody, r.body), meta(r)),
  );
  app.post('/units/:id/deactivate', async (r) =>
    md.setUnitStatus(auth(r), idOf(r.params), 'INACTIVE', meta(r)),
  );
  app.post('/units/:id/reactivate', async (r) =>
    md.setUnitStatus(auth(r), idOf(r.params), 'ACTIVE', meta(r)),
  );

  // ---- categories
  app.get('/categories', async (r) => md.categories(auth(r), parseInput(ListQuery, r.query)));
  app.post('/categories', body, async (r, reply) =>
    reply
      .status(201)
      .send(await md.createCategory(auth(r), parseInput(CategoryCreateBody, r.body), meta(r))),
  );
  app.get('/categories/:id', async (r) => md.category(auth(r), idOf(r.params)));
  app.patch('/categories/:id', body, async (r) =>
    md.updateCategory(auth(r), idOf(r.params), parseInput(CategoryUpdateBody, r.body), meta(r)),
  );
  app.post('/categories/:id/deactivate', async (r) =>
    md.setCategoryStatus(auth(r), idOf(r.params), 'INACTIVE', meta(r)),
  );
  app.post('/categories/:id/reactivate', async (r) =>
    md.setCategoryStatus(auth(r), idOf(r.params), 'ACTIVE', meta(r)),
  );

  // ---- items
  app.get('/items', async (r) => md.items(auth(r), parseInput(ItemListQuery, r.query)));
  app.post('/items', body, async (r, reply) =>
    reply
      .status(201)
      .send(await md.createItem(auth(r), parseInput(ItemCreateBody, r.body), meta(r))),
  );
  app.get('/items/:id', async (r) => md.item(auth(r), idOf(r.params)));
  app.patch('/items/:id', body, async (r) =>
    md.updateItem(auth(r), idOf(r.params), parseInput(ItemUpdateBody, r.body), meta(r)),
  );
  app.put('/items/:id/structure', body, async (r) =>
    md.updateItemStructure(auth(r), idOf(r.params), parseInput(ItemStructureBody, r.body), meta(r)),
  );
  app.post('/items/:id/deactivate', async (r) =>
    md.setItemStatus(auth(r), idOf(r.params), 'INACTIVE', meta(r)),
  );
  app.post('/items/:id/reactivate', async (r) =>
    md.setItemStatus(auth(r), idOf(r.params), 'ACTIVE', meta(r)),
  );

  // ---- warehouse locations (branch-scoped)
  app.get('/locations', async (r) => md.locations(auth(r), parseInput(LocationListQuery, r.query)));
  app.post('/locations', body, async (r, reply) =>
    reply
      .status(201)
      .send(await md.createLocation(auth(r), parseInput(LocationCreateBody, r.body), meta(r))),
  );
  app.get('/locations/:id', async (r) => md.location(auth(r), idOf(r.params)));
  app.patch('/locations/:id', body, async (r) =>
    md.updateLocation(auth(r), idOf(r.params), parseInput(LocationUpdateBody, r.body), meta(r)),
  );
  app.post('/locations/:id/deactivate', async (r) =>
    md.setLocationStatus(auth(r), idOf(r.params), 'INACTIVE', meta(r)),
  );
  app.post('/locations/:id/reactivate', async (r) =>
    md.setLocationStatus(auth(r), idOf(r.params), 'ACTIVE', meta(r)),
  );

  return Promise.resolve();
};

import type { RequestMeta } from '../auth/audit.js';
import { masterEvent, recordCompanyEvent, type MasterAuditEntity } from '../company/audit.js';
import type { Db } from '../db/client.js';
import { CUSTOMER_PREFIX, ITEM_PREFIX, reserveThrough, SUPPLIER_PREFIX } from './codes.js';

/*
 * Demo master data (EP28) — a very small, coherent set for the demo company:
 * three units, two categories, three items, one customer, one supplier and
 * locations for the Head Office and the demo branch. Clearly labelled demo
 * data; no price, cost or margin anywhere.
 *
 * Stable codes make it idempotent: a record is created only when its code is
 * missing, and an existing one is never overwritten (an administrator's edit
 * or deactivation stays). Generated-form codes move their counter forward, so
 * the next code CORE generates follows them and seeding twice never mints
 * new numbers.
 */

const UNITS = [
  { code: 'PCS', name: 'ชิ้น', symbol: 'ชิ้น', precision: 0 },
  { code: 'KG', name: 'กิโลกรัม', symbol: 'กก.', precision: 3 },
  { code: 'BOX', name: 'กล่อง', symbol: 'กล่อง', precision: 0 },
] as const;

const CATEGORIES = [
  { code: 'FG', name: 'สินค้าสำเร็จรูป (ตัวอย่าง)' },
  { code: 'RM', name: 'วัตถุดิบ (ตัวอย่าง)' },
] as const;

const ITEMS = [
  {
    code: 'FG-000001',
    type: 'FINISHED_GOOD',
    name: 'ครีมบำรุงผิว 50 มล. (ตัวอย่าง)',
    unit: 'PCS',
    category: 'FG',
    lotTracking: 'REQUIRED',
    expiryTracking: 'REQUIRED',
  },
  {
    code: 'RM-000001',
    type: 'RAW_MATERIAL',
    name: 'น้ำมันมะพร้าวสกัดเย็น (ตัวอย่าง)',
    unit: 'KG',
    category: 'RM',
    lotTracking: 'OPTIONAL',
    expiryTracking: 'OPTIONAL',
  },
  {
    code: 'PK-000001',
    type: 'PACKAGING',
    name: 'กล่องบรรจุภัณฑ์ (ตัวอย่าง)',
    unit: 'BOX',
    category: null,
    lotTracking: 'NONE',
    expiryTracking: 'NONE',
  },
] as const;

const LOCATIONS = [
  { branch: '00000', code: 'MAIN', name: 'คลังหลัก สำนักงานใหญ่ (ตัวอย่าง)', isDefault: true },
  { branch: '00001', code: 'MAIN', name: 'คลังหลัก สาขาตัวอย่าง', isDefault: true },
  { branch: '00001', code: 'RECEIVING', name: 'จุดรับสินค้า (ตัวอย่าง)', isDefault: false },
] as const;

const seq = (code: string) => Number(code.split('-')[1]);

export async function seedDemoMasterData(db: Db, companyId: string, meta: RequestMeta) {
  let created = 0;
  const audit = (entity: MasterAuditEntity, id: string, code: string, name: string) =>
    recordCompanyEvent(db, meta, {
      action: masterEvent(entity, 'CREATED'),
      actorId: null,
      actorScope: 'seed',
      companyId,
      entityType: entity,
      entityId: id,
      details: { code, name },
    });

  const units = new Map<string, string>();
  for (const u of UNITS) {
    let row = await db.unit.findUnique({ where: { companyId_code: { companyId, code: u.code } } });
    if (!row) {
      row = await db.unit.create({ data: { companyId, ...u } });
      await audit('Unit', row.id, row.code, row.name);
      created++;
    }
    units.set(u.code, row.id);
  }

  const categories = new Map<string, string>();
  for (const c of CATEGORIES) {
    let row = await db.itemCategory.findUnique({
      where: { companyId_code: { companyId, code: c.code } },
    });
    if (!row) {
      row = await db.itemCategory.create({ data: { companyId, ...c } });
      await audit('ItemCategory', row.id, row.code, row.name);
      created++;
    }
    categories.set(c.code, row.id);
  }

  for (const i of ITEMS) {
    await db.$transaction(async (tx) => {
      await reserveThrough(tx, companyId, ITEM_PREFIX[i.type], seq(i.code));
    });
    if (await db.item.findUnique({ where: { companyId_code: { companyId, code: i.code } } }))
      continue;
    const row = await db.item.create({
      data: {
        companyId,
        code: i.code,
        type: i.type,
        name: i.name,
        baseUnitId: units.get(i.unit)!,
        categoryId: i.category ? categories.get(i.category)! : null,
        inventoryTracked: true,
        lotTracking: i.lotTracking,
        expiryTracking: i.expiryTracking,
      },
    });
    await audit('Item', row.id, row.code, row.name);
    created++;
  }

  const customerCode = `${CUSTOMER_PREFIX}-000001`;
  await db.$transaction((tx) => reserveThrough(tx, companyId, CUSTOMER_PREFIX, 1));
  if (
    !(await db.customer.findUnique({
      where: { companyId_code: { companyId, code: customerCode } },
    }))
  ) {
    const row = await db.customer.create({
      data: {
        companyId,
        code: customerCode,
        kind: 'BUSINESS',
        name: 'ร้านค้าตัวอย่าง (ข้อมูลสาธิต)',
        contactName: 'ฝ่ายจัดซื้อ (ตัวอย่าง)',
        billingAddress: '1 ถนนสาธิต (ข้อมูลสาธิต) กรุงเทพมหานคร 10900',
      },
    });
    await audit('Customer', row.id, row.code, row.name);
    created++;
  }

  const supplierCode = `${SUPPLIER_PREFIX}-000001`;
  await db.$transaction((tx) => reserveThrough(tx, companyId, SUPPLIER_PREFIX, 1));
  if (
    !(await db.supplier.findUnique({
      where: { companyId_code: { companyId, code: supplierCode } },
    }))
  ) {
    const row = await db.supplier.create({
      data: {
        companyId,
        code: supplierCode,
        name: 'ผู้ขายวัตถุดิบตัวอย่าง (ข้อมูลสาธิต)',
        contactName: 'ฝ่ายขาย (ตัวอย่าง)',
        address: '99 ถนนตัวอย่าง (ข้อมูลสาธิต) นนทบุรี 11000',
      },
    });
    await audit('Supplier', row.id, row.code, row.name);
    created++;
  }

  for (const l of LOCATIONS) {
    const branch = await db.branch.findUnique({
      where: { companyId_code: { companyId, code: l.branch } },
    });
    if (!branch) continue;
    const exists = await db.warehouseLocation.findUnique({
      where: { branchId_code: { branchId: branch.id, code: l.code } },
    });
    if (exists) continue;
    // A default only where the branch has none yet (an administrator's choice stays).
    const hasDefault = await db.warehouseLocation.count({
      where: { branchId: branch.id, defaultSlot: true },
    });
    const row = await db.warehouseLocation.create({
      data: {
        companyId,
        branchId: branch.id,
        code: l.code,
        name: l.name,
        defaultSlot: l.isDefault && !hasDefault ? true : null,
      },
    });
    await audit('WarehouseLocation', row.id, row.code, row.name);
    created++;
  }

  return created ? (`created ${created}` as const) : ('unchanged' as const);
}

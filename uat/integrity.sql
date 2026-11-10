-- Inventory ledger reconciliation (EP39, reused by the EP42.2 UAT tooling): every check counts violations; all must be 0.
WITH mv AS (
  SELECT "locationId", "itemId", COALESCE("lotId", '') AS lk, SUM("quantityDelta") q
  FROM "StockMovement" GROUP BY 1, 2, 3
), bal AS (
  SELECT "locationId", "itemId", "lotKey" AS lk, "quantityOnHand" q FROM "StockBalance"
), res AS (
  SELECT "locationId", "itemId", "lotKey" AS lk, SUM(quantity) q FROM (
    SELECT "locationId", "itemId", "lotKey", quantity FROM "SalesAllocation" WHERE status = 'ACTIVE'
    UNION ALL
    SELECT "locationId", "itemId", "lotKey", quantity FROM "ProductionMaterialAllocation" WHERE status = 'ACTIVE'
  ) x GROUP BY 1, 2, 3
)
SELECT
  (SELECT count(*) FROM bal FULL JOIN mv USING ("locationId", "itemId", lk)
     WHERE COALESCE(bal.q, 0) <> COALESCE(mv.q, 0)) AS balance_vs_ledger_mismatch,
  (SELECT count(*) FROM bal WHERE q < 0) AS negative_balances,
  (SELECT count(*) FROM res LEFT JOIN bal USING ("locationId", "itemId", lk)
     WHERE res.q > COALESCE(bal.q, 0)) AS over_reserved_identities,
  (SELECT count(*) FROM (SELECT "salesShipmentLineId", "lotId", "locationId" FROM "StockMovement"
     WHERE type = 'SALES_ISSUE' GROUP BY 1, 2, 3 HAVING count(*) > 1) d) AS duplicate_sales_issue,
  (SELECT count(*) FROM (SELECT "productionGoodsReceiptLineId" FROM "StockMovement"
     WHERE type = 'PRODUCTION_OUTPUT' GROUP BY 1 HAVING count(*) > 1) d) AS duplicate_production_output,
  (SELECT count(*) FROM (SELECT "productionMaterialIssueLineId", "lotId", "locationId" FROM "StockMovement"
     WHERE type = 'PRODUCTION_CONSUMPTION' GROUP BY 1, 2, 3 HAVING count(*) > 1) d) AS duplicate_consumption,
  (SELECT count(*) FROM (SELECT "goodsReceiptAllocationId" FROM "StockMovement"
     WHERE type = 'PURCHASE_RECEIPT' GROUP BY 1 HAVING count(*) > 1) d) AS duplicate_purchase_receipt,
  (SELECT count(*) FROM "SalesAllocation" WHERE status = 'CONSUMED' AND "salesShipmentLineId" IS NULL) AS consumed_sales_without_shipment,
  (SELECT count(*) FROM "ProductionMaterialAllocation" WHERE status = 'CONSUMED' AND "issueLineId" IS NULL) AS consumed_material_without_issue,
  (SELECT count(*) FROM "StockMovement" m JOIN "ProductionGoodsReceipt" g ON g.id = m."productionGoodsReceiptId"
     WHERE g.status <> 'POSTED' AND m.type = 'PRODUCTION_OUTPUT'
       AND NOT EXISTS (SELECT 1 FROM "StockMovement" r WHERE r."productionGoodsReceiptLineId" = m."productionGoodsReceiptLineId" AND r.type <> 'PRODUCTION_OUTPUT')) AS output_without_posted_receipt,
  (SELECT count(*) FROM "StockMovement") AS movements,
  (SELECT count(*) FROM "StockBalance") AS balances;

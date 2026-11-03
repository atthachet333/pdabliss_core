-- EP31 — the purchase-order status RECEIVED (additive). Its own migration: a new
-- enum value can only be used once this transaction has committed.

-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'RECEIVED';

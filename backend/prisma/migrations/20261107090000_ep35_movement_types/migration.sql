-- EP35 — the SALES_ISSUE movement type (additive). Its own migration: a new enum
-- value can only be used once this transaction has committed.

ALTER TYPE "StockMovementType" ADD VALUE 'SALES_ISSUE';

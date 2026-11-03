-- EP32 — new stock movement types (additive). Their own migration: a new enum
-- value can only be used once this transaction has committed.

ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_OUT_REVERSAL';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER_IN_REVERSAL';
ALTER TYPE "StockMovementType" ADD VALUE 'ADJUSTMENT_IN';
ALTER TYPE "StockMovementType" ADD VALUE 'ADJUSTMENT_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'ADJUSTMENT_IN_REVERSAL';
ALTER TYPE "StockMovementType" ADD VALUE 'ADJUSTMENT_OUT_REVERSAL';
ALTER TYPE "StockMovementType" ADD VALUE 'COUNT_CORRECTION';

-- EP37: new enum values, in their own migration (PostgreSQL cannot use a new enum value in the
-- transaction that adds it; the next migration's CHECKs and triggers use them).
ALTER TYPE "ProductionOrderStatus" ADD VALUE 'IN_PRODUCTION';
ALTER TYPE "ProductionOrderStatus" ADD VALUE 'PAUSED';
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION_CONSUMPTION';

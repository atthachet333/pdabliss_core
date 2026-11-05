-- EP38: new enum values in their own migration (PostgreSQL cannot use a value in the
-- transaction that adds it). Completion statuses, the finished goods movement types,
-- and the short-close release reason of production reservations.
ALTER TYPE "ProductionOrderStatus" ADD VALUE 'COMPLETION_REVIEW';
ALTER TYPE "ProductionOrderStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION_OUTPUT';
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION_OUTPUT_REVERSAL';
ALTER TYPE "ProductionAllocationRelease" ADD VALUE 'ORDER_CLOSED';

-- EP41 history protection (EP40-06): the audit trail and posted warehouse documents
-- cannot be edited or removed after the fact — not even by direct SQL with the
-- application's rights. Legitimate compensation stays possible: a posted receipt,
-- transfer or adjustment may still be REVERSED (status POSTED -> CANCELLED, with its
-- cancellation fields), which is how the application undoes stock. Drafts are untouched.

-- 1. The audit trail is append-only.
CREATE FUNCTION "audit_log_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog rows are immutable (%)', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER "AuditLog_immutable"
    BEFORE UPDATE OR DELETE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "audit_log_immutable"();

-- 2. A posted (or otherwise closed) document header is frozen.
--    TG_ARGV[0]: statuses after which the row is frozen (comma separated)
--    TG_ARGV[1]: the one transition still allowed out of a frozen status, e.g. 'POSTED>CANCELLED'
--    TG_ARGV[2]: the columns that transition may set (comma separated)
CREATE FUNCTION "posted_document_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    frozen   text[] := string_to_array(TG_ARGV[0], ',');
    allowed  text[] := string_to_array(NULLIF(TG_ARGV[1], ''), ',');
    settable text[] := COALESCE(string_to_array(NULLIF(TG_ARGV[2], ''), ','), '{}'::text[]);
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."status"::text = ANY (frozen) THEN
            RAISE EXCEPTION '% % is % and cannot be deleted', TG_TABLE_NAME, OLD."id", OLD."status"
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF NOT (OLD."status"::text = ANY (frozen)) THEN
        RETURN NEW;
    END IF;
    IF NEW."status" <> OLD."status" THEN
        IF allowed IS NULL OR NOT ((OLD."status"::text || '>' || NEW."status"::text) = ANY (allowed)) THEN
            RAISE EXCEPTION '% % cannot move from % to %', TG_TABLE_NAME, OLD."id", OLD."status", NEW."status"
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        IF (to_jsonb(NEW) - settable - 'status' - 'updatedAt')
            IS DISTINCT FROM (to_jsonb(OLD) - settable - 'status' - 'updatedAt') THEN
            RAISE EXCEPTION '% %: a reversal changes only its own fields', TG_TABLE_NAME, OLD."id"
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
        RAISE EXCEPTION '% % is % and cannot be changed', TG_TABLE_NAME, OLD."id", OLD."status"
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

-- 3. The lines (and allocations, locations) of a frozen document are frozen too.
--    TG_ARGV[0]: parent table   TG_ARGV[1]: parent key column in this table
--    TG_ARGV[2]: the parent's frozen statuses (comma separated)
--    (Posting writes its children while the header is still a draft, so it is never blocked.)
CREATE FUNCTION "posted_document_child_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    parent_id text;
    parent_status text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        parent_id := to_jsonb(OLD) ->> TG_ARGV[1];
    ELSE
        parent_id := to_jsonb(NEW) ->> TG_ARGV[1];
    END IF;
    EXECUTE format('SELECT "status"::text FROM %I WHERE "id" = $1', TG_ARGV[0])
        INTO parent_status USING parent_id;
    IF parent_status = ANY (string_to_array(TG_ARGV[2], ',')) THEN
        RAISE EXCEPTION '% rows of % % (%) cannot be changed (%)', TG_TABLE_NAME, TG_ARGV[0], parent_id, parent_status, TG_OP
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Goods receipts: frozen once POSTED or CANCELLED; a posted receipt may still be reversed.
CREATE TRIGGER "GoodsReceipt_posted_guard"
    BEFORE UPDATE OR DELETE ON "GoodsReceipt"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_guard"(
        'POSTED,CANCELLED', 'POSTED>CANCELLED', 'cancelledAt,cancelledByMemberId,cancellationReason');
CREATE TRIGGER "GoodsReceiptLine_posted_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "GoodsReceiptLine"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_child_guard"('GoodsReceipt', 'goodsReceiptId', 'POSTED,CANCELLED');
-- An allocation belongs to a receipt line; its receipt is one step further.
CREATE FUNCTION "goods_receipt_allocation_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    line_id text;
    receipt_status text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        line_id := OLD."goodsReceiptLineId";
    ELSE
        line_id := NEW."goodsReceiptLineId";
    END IF;
    SELECT r."status"::text INTO receipt_status
        FROM "GoodsReceiptLine" l JOIN "GoodsReceipt" r ON r."id" = l."goodsReceiptId"
        WHERE l."id" = line_id;
    IF receipt_status IN ('POSTED', 'CANCELLED') THEN
        RAISE EXCEPTION 'GoodsReceiptAllocation rows of a % receipt cannot be changed (%)', receipt_status, TG_OP
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "GoodsReceiptAllocation_posted_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "GoodsReceiptAllocation"
    FOR EACH ROW EXECUTE FUNCTION "goods_receipt_allocation_guard"();

-- Inventory transfers: frozen once POSTED or CANCELLED; a posted transfer may still be reversed.
CREATE TRIGGER "InventoryTransfer_posted_guard"
    BEFORE UPDATE OR DELETE ON "InventoryTransfer"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_guard"(
        'POSTED,CANCELLED', 'POSTED>CANCELLED', 'cancelledAt,cancelledByMemberId,cancellationReason');
CREATE TRIGGER "InventoryTransferLine_posted_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "InventoryTransferLine"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_child_guard"('InventoryTransfer', 'transferId', 'POSTED,CANCELLED');

-- Stock adjustments: frozen once POSTED, REJECTED or CANCELLED; a posted adjustment may still be reversed.
CREATE TRIGGER "StockAdjustment_posted_guard"
    BEFORE UPDATE OR DELETE ON "StockAdjustment"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_guard"(
        'POSTED,REJECTED,CANCELLED', 'POSTED>CANCELLED', 'cancelledAt,cancelledByMemberId,cancellationReason');
CREATE TRIGGER "StockAdjustmentLine_posted_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "StockAdjustmentLine"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_child_guard"('StockAdjustment', 'adjustmentId', 'POSTED,REJECTED,CANCELLED');

-- Cycle counts: frozen once POSTED or CANCELLED (a posted count has no reversal).
CREATE TRIGGER "CycleCount_posted_guard"
    BEFORE UPDATE OR DELETE ON "CycleCount"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_guard"('POSTED,CANCELLED', '', '');
CREATE TRIGGER "CycleCountLine_posted_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "CycleCountLine"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_child_guard"('CycleCount', 'cycleCountId', 'POSTED,CANCELLED');
CREATE TRIGGER "CycleCountLocation_posted_guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "CycleCountLocation"
    FOR EACH ROW EXECUTE FUNCTION "posted_document_child_guard"('CycleCount', 'cycleCountId', 'POSTED,CANCELLED');

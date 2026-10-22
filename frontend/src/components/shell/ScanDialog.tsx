import { ScanBarcode } from 'lucide-react';
import { Button, Modal } from '@/components/core';

/**
 * Warehouse scan entry point (barcode / QR). Camera scanning arrives with the
 * stock module; the dialog shows where it will live so floor staff can
 * review the flow now.
 */
export function ScanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="สแกนบาร์โค้ด / QR"
      description="การสแกนด้วยกล้องจะเปิดใช้เมื่อเชื่อมระบบสต็อก — ต้นแบบนี้แสดงตำแหน่งของปุ่มและขั้นตอนเท่านั้น"
      footer={
        <Button variant="secondary" onClick={onClose}>
          ปิด
        </Button>
      }
    >
      <div className="flex aspect-[4/3] items-center justify-center rounded-panel border border-dashed border-line-strong bg-canvas">
        <div className="relative flex size-36 items-center justify-center">
          {/* Viewfinder corners */}
          {[
            'top-0 left-0 border-t-2 border-l-2',
            'top-0 right-0 border-t-2 border-r-2',
            'bottom-0 left-0 border-b-2 border-l-2',
            'right-0 bottom-0 border-r-2 border-b-2',
          ].map((c) => (
            <span
              key={c}
              aria-hidden
              className={`absolute size-6 rounded-sm border-[var(--ws-accent)] ${c}`}
            />
          ))}
          <ScanBarcode className="size-10 text-fg-muted" aria-hidden />
        </div>
      </div>
      <p className="mt-3 text-caption text-fg-muted">
        หลังสแกน ระบบจะเปิดรายการรับสินค้า Lot หรือสต็อกที่ตรงกับรหัสโดยอัตโนมัติ
      </p>
    </Modal>
  );
}

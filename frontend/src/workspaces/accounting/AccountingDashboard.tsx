import { CircleCheck, CircleDashed, Receipt, Wallet } from 'lucide-react';
import { EmptyState, Metric, Panel, SampleTag, WorkspaceHero } from '@/components/app/primitives';
import { WORKSPACES } from '../registry';

/* Minimal sample content for UX review only. Amounts are illustrative. */

const PENDING = [
  { kind: 'มัดจำ', ref: 'PO ตัวอย่าง 1', amount: '฿ 25,000', due: 'ครบกำหนดวันนี้' },
  { kind: 'ส่วนที่เหลือ', ref: 'PO ตัวอย่าง 2', amount: '฿ 48,500', due: 'ครบกำหนดใน 5 วัน' },
];

const REQUIRED_DOCS = [
  { name: 'ใบสั่งซื้อ (PO) ได้รับอนุมัติ', ready: true },
  { name: 'ใบรับสินค้า (GR) จากคลัง', ready: true },
  { name: 'ใบแจ้งหนี้จากซัพพลายเออร์', ready: false },
];

export default function AccountingDashboard() {
  const ws = WORKSPACES.accounting;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="การจ่ายเงิน"
        subtitle={ws.tagline}
        motif={ws.motif}
      />

      <section aria-labelledby="acc-summary" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="acc-summary" className="text-body font-semibold text-text-primary">
            สรุป
          </h2>
          <SampleTag />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="คำขอจ่ายเงิน" value={0} icon={Receipt} hint="รอตรวจเอกสาร" />
          <Metric label="รอชำระ" value={2} icon={Wallet} hint="มัดจำ 1 · ส่วนที่เหลือ 1" />
          <Metric label="ยอดค้างจ่าย" value="฿ 73,500" icon={Wallet} hint="ซัพพลายเออร์ 2 ราย" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-6">
          <Panel
            title="คำขอจ่ายเงิน"
            subtitle="จ่ายได้เมื่อได้รับอนุมัติและเอกสารอ้างอิงครบเท่านั้น"
          >
            <EmptyState
              icon={Receipt}
              title="ไม่มีคำขอจ่ายเงินที่รอดำเนินการ"
              description="คำขอจ่ายเงินที่ผูกกับใบสั่งซื้อและใบรับสินค้าจะเข้ามาที่นี่"
              compact
            />
          </Panel>

          <Panel title="รอชำระ" action={<SampleTag />}>
            <ul className="space-y-3">
              {PENDING.map((p) => (
                <li
                  key={p.ref}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border-soft bg-surface-raised/50 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-label font-medium text-text-primary">
                      {p.kind} <span className="font-normal text-text-muted">· {p.ref}</span>
                    </p>
                    <p className="mt-0.5 text-caption text-text-muted">{p.due}</p>
                  </div>
                  <p className="shrink-0 text-body font-semibold text-text-primary tabular">
                    {p.amount}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="เงื่อนไขก่อนจ่าย" subtitle="ระบบตรวจเอกสารที่เชื่อมโยงกันให้อัตโนมัติ">
          <ul className="space-y-4">
            {REQUIRED_DOCS.map((d) => (
              <li key={d.name} className="flex items-center gap-3 text-label">
                {d.ready ? (
                  <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleDashed className="size-5 shrink-0 text-text-muted" aria-hidden />
                )}
                <span className={d.ready ? 'text-text-primary' : 'text-text-muted'}>{d.name}</span>
                <span className="sr-only">{d.ready ? 'ครบ' : 'ยังไม่มี'}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-surface-highlight text-label text-text-muted disabled:cursor-not-allowed"
          >
            บันทึกการจ่าย — รอเอกสารครบ
          </button>
          <p className="mt-3 text-caption text-text-muted">
            ตัวอย่างการป้องกันความผิดพลาด: ปุ่มจ่ายจะเปิดเมื่อเอกสารครบทุกใบ
          </p>
        </Panel>
      </div>
    </>
  );
}

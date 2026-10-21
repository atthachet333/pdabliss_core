import {
  CircleCheck,
  CircleDashed,
  FileWarning,
  HandCoins,
  Lock,
  Receipt,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { KpiTile, PageTitle, Panel, StatusPill } from '@/components/app/primitives';
import { cn } from '@/lib/cn';
import { formatBaht } from '@/lib/format';

/* EP00 mock data — Accounting workspace. Amounts are illustrative. */

interface PaymentRequest {
  id: string;
  supplier: string;
  kind: 'มัดจำ' | 'ส่วนที่เหลือ';
  amount: number;
  ref: string;
  docs: { name: string; ok: boolean }[];
  approved: boolean;
}

const REQUESTS: PaymentRequest[] = [
  {
    id: 'PAY-0331',
    supplier: 'Siam Metal Supply',
    kind: 'ส่วนที่เหลือ',
    amount: 151_620,
    ref: 'PO-0922',
    docs: [
      { name: 'PO', ok: true },
      { name: 'ใบรับสินค้า (GR)', ok: true },
      { name: 'ใบแจ้งหนี้', ok: true },
    ],
    approved: true,
  },
  {
    id: 'PAY-0334',
    supplier: 'Chem Partner Asia',
    kind: 'ส่วนที่เหลือ',
    amount: 77_400,
    ref: 'PO-0918',
    docs: [
      { name: 'PO', ok: true },
      { name: 'ใบรับสินค้า (GR)', ok: false },
      { name: 'ใบแจ้งหนี้', ok: false },
    ],
    approved: false,
  },
  {
    id: 'PAY-0336',
    supplier: 'Bangkok Packaging',
    kind: 'มัดจำ',
    amount: 14_250,
    ref: 'PO-0925',
    docs: [
      { name: 'PO', ok: true },
      { name: 'เงื่อนไขมัดจำ', ok: true },
    ],
    approved: false,
  },
];

const AGING = [
  { bucket: '0–30 วัน', amount: 1_120_000 },
  { bucket: '31–60 วัน', amount: 486_000 },
  { bucket: '61–90 วัน', amount: 172_000 },
  { bucket: 'เกิน 90 วัน', amount: 64_000 },
];

export default function AccountingDashboard() {
  const maxAging = Math.max(...AGING.map((a) => a.amount));
  const totalAging = AGING.reduce((s, a) => s + a.amount, 0);

  return (
    <>
      <PageTitle
        title="การจ่ายเงินและยอดค้างจ่าย"
        subtitle="จ่ายได้เมื่อได้รับอนุมัติและเอกสารอ้างอิงครบเท่านั้น"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="รอชำระมัดจำ" value="4" icon={HandCoins} />
        <KpiTile label="รอชำระส่วนที่เหลือ" value="7" icon={Wallet} />
        <KpiTile label="คำขอจ่ายเงิน" value="3" icon={Receipt} tone="brand" />
        <KpiTile label="ยอดค้างจ่ายซัพพลายเออร์" value="฿1.84 ล้าน" icon={WalletCards} />
        <KpiTile label="เอกสารไม่ครบ" value="2" icon={FileWarning} tone="warning" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="คำขอจ่ายเงิน"
          subtitle="ตรวจความครบถ้วนของเอกสารที่เชื่อมโยงกันโดยอัตโนมัติ"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border-soft">
            {REQUESTS.map((r) => {
              const complete = r.docs.every((d) => d.ok);
              const payable = complete && r.approved;
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label font-semibold text-text-primary">
                        {r.id} · {r.supplier}
                      </p>
                      <p className="text-caption text-text-muted">
                        {r.kind} · อ้างอิง {r.ref}
                      </p>
                    </div>
                    <p className="text-body font-semibold text-text-primary tabular">
                      {formatBaht(r.amount)}
                    </p>
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="เอกสารที่ต้องใช้">
                    {r.docs.map((d) => (
                      <li
                        key={d.name}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-caption',
                          d.ok
                            ? 'border-success/30 bg-success/10 text-success'
                            : 'border-border-strong bg-surface-overlay text-text-muted',
                        )}
                      >
                        {d.ok ? (
                          <CircleCheck className="size-3" aria-hidden />
                        ) : (
                          <CircleDashed className="size-3" aria-hidden />
                        )}
                        {d.name}
                        <span className="sr-only">{d.ok ? 'ครบ' : 'ยังไม่มี'}</span>
                      </li>
                    ))}
                    <li>
                      <StatusPill tone={r.approved ? 'success' : 'warning'}>
                        {r.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                      </StatusPill>
                    </li>
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!payable}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-primary px-4 text-label font-medium text-text-inverse disabled:cursor-not-allowed disabled:bg-surface-highlight disabled:text-text-muted"
                    >
                      {!payable && <Lock className="size-3.5" aria-hidden />}
                      บันทึกการจ่าย (เดโม)
                    </button>
                    {!payable && (
                      <span className="text-caption text-text-muted">
                        {!complete
                          ? 'จ่ายไม่ได้จนกว่าเอกสารจะครบ'
                          : 'จ่ายไม่ได้จนกว่าจะได้รับอนุมัติ'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="อายุเจ้าหนี้" subtitle={`ยอดค้างจ่ายรวม ${formatBaht(totalAging)}`}>
          <ul className="space-y-4">
            {AGING.map((a, i) => (
              <li key={a.bucket}>
                <div className="mb-1.5 flex justify-between text-label">
                  <span className="text-text-secondary">{a.bucket}</span>
                  <span className="font-medium text-text-primary tabular">
                    {formatBaht(a.amount)}
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-surface-highlight"
                  aria-hidden
                >
                  <div
                    className={cn('h-full rounded-full', i >= 2 ? 'bg-warning' : 'bg-chart-1')}
                    style={{ width: `${(a.amount / maxAging) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-caption text-text-muted">
            ยอดที่เกิน 60 วันแสดงด้วยสีเตือนเพื่อให้ติดตามก่อน
          </p>
        </Panel>
      </div>
    </>
  );
}

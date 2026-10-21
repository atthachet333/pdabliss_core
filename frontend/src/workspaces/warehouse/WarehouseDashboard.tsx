import {
  CalendarX,
  Hourglass,
  ListChecks,
  Lock,
  PackageCheck,
  PackageMinus,
  ScanBarcode,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  KpiTile,
  PageTitle,
  Panel,
  ProgressBar,
  StatusPill,
  TableWrap,
  td,
  th,
  type Tone,
} from '@/components/app/primitives';
import { cn } from '@/lib/cn';
import { formatNumber, formatShortDate } from '@/lib/format';
import { COUNT_TASKS, FEFO_LOTS, INCOMING, TODAY_TASKS, type IncomingReceipt } from './data';
import { useWarehouseStock } from './useWarehouseStock';

const STAGE: Record<IncomingReceipt['stage'], { tone: Tone; label: string }> = {
  arriving: { tone: 'neutral', label: 'กำลังมาถึง' },
  unloading: { tone: 'brand', label: 'กำลังลงสินค้า' },
  qc: { tone: 'warning', label: 'รอตรวจ QC' },
};

function expiryTone(days: number): { tone: Tone; label: string } {
  if (days < 0) return { tone: 'danger', label: `หมดอายุแล้ว ${-days} วัน · ห้ามจ่าย` };
  if (days <= 30) return { tone: 'warning', label: `เหลือ ${days} วัน · จ่ายก่อน` };
  return { tone: 'success', label: `เหลือ ${days} วัน` };
}

export default function WarehouseDashboard() {
  const stock = useWarehouseStock();
  const low = stock.items.filter((i) => i.available < i.reorderPoint);

  return (
    <>
      <PageTitle
        title="งานคลังวันนี้"
        subtitle="คลังหลัก WH-MAIN และคลังสารเคมี WH-CHEM"
        actions={
          <button
            type="button"
            disabled
            title="การสแกนบาร์โค้ดจะเปิดใช้ในรอบพัฒนาถัดไป"
            className="hidden h-11 items-center gap-2 rounded-full border border-border-strong px-5 text-label text-text-secondary disabled:opacity-70 sm:inline-flex"
          >
            <ScanBarcode className="size-4" aria-hidden />
            สแกนบาร์โค้ด (เร็ว ๆ นี้)
          </button>
        }
      />

      <p className="mb-5 flex items-start gap-2.5 rounded-panel border border-border-brand bg-brand-primary/8 px-4 py-3 text-label text-brand-soft">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          พื้นที่ทำงานนี้แสดงเฉพาะจำนวน ล็อต และวันที่ —{' '}
          <strong className="font-semibold">ข้อมูลต้นทุนและราคาไม่ถูกส่งมาจากเซิร์ฟเวอร์</strong>
        </span>
      </p>

      {/* Task-first tiles: large touch targets for the floor */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          size="lg"
          label="รอรับสินค้า"
          value={TODAY_TASKS.waitingReceipts}
          icon={Truck}
          tone="brand"
        />
        <KpiTile
          size="lg"
          label="รอตรวจ QC"
          value={TODAY_TASKS.pendingQc}
          icon={ShieldCheck}
          tone="warning"
        />
        <KpiTile
          size="lg"
          label="สินค้าใกล้หมด"
          value={TODAY_TASKS.lowStock}
          icon={PackageMinus}
          tone="warning"
        />
        <KpiTile
          size="lg"
          label="ล็อตใกล้หมดอายุ"
          value={TODAY_TASKS.expiringLots}
          icon={Hourglass}
          tone="warning"
        />
        <KpiTile
          size="lg"
          label="ล็อตหมดอายุ"
          value={TODAY_TASKS.expiredLots}
          icon={CalendarX}
          tone="danger"
        />
        <KpiTile size="lg" label="งานตรวจนับ" value={TODAY_TASKS.countTasks} icon={ListChecks} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Panel
          title="สินค้าที่จะเข้าวันนี้"
          subtitle="รับตาม PO — ระบบไม่อนุญาตให้รับเกินจำนวนที่สั่ง"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border-soft">
            {INCOMING.map((r) => (
              <li key={r.po} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-overlay">
                  <PackageCheck className="size-5 text-brand-soft" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label font-medium text-text-primary">{r.item}</p>
                  <p className="text-caption text-text-muted">
                    {r.po} · {r.supplier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-label font-semibold text-text-primary tabular">
                    {formatNumber(r.expected)} {r.unit}
                  </p>
                  <p className="text-caption text-text-muted">
                    {r.eta} น. · {r.dock}
                  </p>
                </div>
                <StatusPill tone={STAGE[r.stage].tone}>{STAGE[r.stage].label}</StatusPill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="ล็อตตามลำดับ FEFO" subtitle="หมดอายุก่อน จ่ายออกก่อน" bodyClassName="p-0">
          <ul className="divide-y divide-border-soft">
            {FEFO_LOTS.map((l) => {
              const exp = expiryTone(l.daysLeft);
              return (
                <li key={l.lot} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-label font-medium text-text-primary">{l.item}</p>
                      <p className="text-caption text-text-muted">
                        {l.lot} · ตำแหน่ง {l.location} · {l.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-caption text-text-secondary">
                      {formatShortDate(l.expiresOn)}
                    </p>
                  </div>
                  <StatusPill tone={exp.tone} className="mt-2">
                    {exp.label}
                  </StatusPill>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="ยอดสต็อก"
          subtitle="จำนวนคงเหลือ จอง และพร้อมใช้"
          action={
            <span className="text-caption text-text-muted">
              {stock.source === 'api'
                ? 'ข้อมูลจาก API (warehouse contract)'
                : stock.source === 'loading'
                  ? 'กำลังโหลด…'
                  : 'ข้อมูลเดโมออฟไลน์'}
            </span>
          }
        >
          <TableWrap label="ตารางยอดสต็อก">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th scope="col" className={th}>
                    สินค้า
                  </th>
                  <th scope="col" className={th}>
                    คลัง / ล็อต
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    คงเหลือ
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    จอง
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    พร้อมใช้
                  </th>
                  <th scope="col" className={th}>
                    หมดอายุ
                  </th>
                </tr>
              </thead>
              <tbody>
                {stock.items.map((i) => {
                  const isLow = i.available < i.reorderPoint;
                  return (
                    <tr key={i.id} className="border-b border-border-soft last:border-0">
                      <td className={td}>
                        <span className="block font-medium">{i.name}</span>
                        <span className="text-caption text-text-muted">{i.sku}</span>
                      </td>
                      <td className={cn(td, 'text-text-secondary')}>
                        {i.warehouseCode}
                        <span className="block text-caption text-text-muted">
                          {i.lotNo ?? 'ไม่มีล็อต'}
                        </span>
                      </td>
                      <td className={cn(td, 'text-right tabular')}>{formatNumber(i.onHand)}</td>
                      <td className={cn(td, 'text-right text-text-secondary tabular')}>
                        {formatNumber(i.reserved)}
                      </td>
                      <td
                        className={cn(
                          td,
                          'text-right font-semibold tabular',
                          isLow && 'text-warning',
                        )}
                      >
                        {formatNumber(i.available)}{' '}
                        <span className="text-caption font-normal text-text-muted">{i.unit}</span>
                      </td>
                      <td className={cn(td, 'text-text-secondary')}>
                        {i.expiresOn ? formatShortDate(i.expiresOn) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Panel>

        <div className="grid gap-5">
          <Panel title="สินค้าต่ำกว่าจุดสั่งซื้อ" subtitle="พร้อมใช้เทียบจุดสั่งซื้อซ้ำ">
            <ul className="space-y-4">
              {low.map((i) => (
                <li key={i.id}>
                  <div className="mb-1.5 flex justify-between gap-3 text-label">
                    <span className="truncate text-text-primary">{i.name}</span>
                    <span className="shrink-0 text-text-secondary tabular">
                      {formatNumber(i.available)} / {formatNumber(i.reorderPoint)}
                    </span>
                  </div>
                  <ProgressBar
                    value={(i.available / i.reorderPoint) * 100}
                    tone="warning"
                    label={`${i.name} พร้อมใช้เทียบจุดสั่งซื้อ`}
                  />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="งานตรวจนับสต็อก">
            <ul className="space-y-4">
              {COUNT_TASKS.map((t) => (
                <li key={t.id}>
                  <div className="mb-1.5 flex justify-between gap-3 text-label">
                    <span className="truncate text-text-primary">
                      {t.id} · {t.zone}
                    </span>
                    <span className="shrink-0 text-text-muted">{t.due}</span>
                  </div>
                  <ProgressBar
                    value={(t.counted / t.total) * 100}
                    label={`${t.id} ความคืบหน้าการนับ`}
                  />
                  <p className="mt-1 text-caption text-text-muted tabular">
                    นับแล้ว {t.counted} จาก {t.total} รายการ
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Mobile: floor staff reach scanning with one thumb */}
      <button
        type="button"
        disabled
        aria-label="สแกนบาร์โค้ด (จะเปิดใช้ในรอบพัฒนาถัดไป)"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-brand-primary text-text-inverse shadow-glow-md disabled:opacity-90 sm:hidden"
      >
        <ScanBarcode className="size-6" aria-hidden />
      </button>
    </>
  );
}

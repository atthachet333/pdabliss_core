import {
  ArrowUpRight,
  ClipboardCheck,
  Eye,
  Gauge,
  PackageX,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import { KpiTile, PageTitle, Panel, StatusPill, type Tone } from '@/components/app/primitives';
import { WORKSPACES } from '../registry';
import { DEPARTMENT_PULSE, EXCEPTIONS, type ExceptionItem } from './data';
import OrderTrendChart from './OrderTrendChart';

const SEVERITY: Record<ExceptionItem['severity'], { tone: Tone; label: string }> = {
  critical: { tone: 'danger', label: 'วิกฤต' },
  high: { tone: 'warning', label: 'สูง' },
  medium: { tone: 'info', label: 'ปานกลาง' },
};

export default function ExecutiveDashboard() {
  return (
    <>
      <PageTitle
        title="ภาพรวมองค์กร"
        subtitle="วันอังคารที่ 21 ตุลาคม 2569 · ข้อมูลจากทุกแผนกบนข้อมูลชุดเดียวกัน"
        actions={
          <StatusPill tone="neutral">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" aria-hidden /> มุมมองอ่านเป็นหลัก
            </span>
          </StatusPill>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          label="คำสั่งซื้อเดือนนี้"
          value="128"
          icon={ShoppingCart}
          hint="ส่งแล้ว 96 · ค้างส่ง 32"
        />
        <KpiTile label="ส่งมอบตรงเวลา" value="94%" icon={Gauge} tone="brand" hint="เป้าหมาย 95%" />
        <KpiTile
          label="ข้อยกเว้นที่เปิดอยู่"
          value={EXCEPTIONS.length}
          icon={TriangleAlert}
          tone="warning"
          hint="วิกฤต 2 รายการ"
        />
        <KpiTile
          label="รออนุมัติจากคุณ"
          value="2"
          icon={ClipboardCheck}
          hint="PR-0412 · PAY-0331"
        />
      </div>

      {/* Department pulse — drill down into each workspace */}
      <section aria-labelledby="pulse-title" className="mt-6">
        <h2 id="pulse-title" className="mb-3 text-body font-semibold text-text-primary">
          ชีพจรรายแผนก
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {DEPARTMENT_PULSE.map((d) => {
            const ws = WORKSPACES[d.workspace];
            const Icon = ws.icon;
            return (
              <li key={d.workspace}>
                <Link
                  to={`/app/${d.workspace}`}
                  className="group flex h-full flex-col rounded-panel border border-border-soft bg-surface-base p-4 transition-[border-color,background-color] hover:border-border-brand hover:bg-surface-raised"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <Icon className="size-4 text-brand-glow" aria-hidden />
                      {ws.nameTh.replace('พื้นที่ทำงาน', '')}
                    </span>
                    <ArrowUpRight
                      className="size-4 text-text-muted transition-colors group-hover:text-brand-glow"
                      aria-hidden
                    />
                  </div>
                  <StatusPill tone={d.status.tone} className="mt-2 self-start">
                    {d.status.label}
                  </StatusPill>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
                    {d.metrics.map((m) => (
                      <div key={m.label}>
                        <dt className="text-caption text-text-muted">{m.label}</dt>
                        <dd className="text-body font-semibold text-text-primary tabular">
                          {m.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title="คำสั่งซื้อเข้าเทียบส่งมอบ"
          subtitle="รายสัปดาห์ · 8 สัปดาห์ล่าสุด (จำนวนใบสั่งขาย)"
        >
          <OrderTrendChart />
        </Panel>

        <Panel
          title="Exception Center"
          subtitle="เรียงตามความรุนแรงและอายุของปัญหา"
          action={
            <Link
              to="/app/executive/exceptions"
              className="text-caption font-medium text-brand-glow hover:underline"
            >
              ดูทั้งหมด
            </Link>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border-soft">
            {EXCEPTIONS.map((ex) => {
              const sev = SEVERITY[ex.severity];
              const Icon = ex.workspace === 'warehouse' ? PackageX : WORKSPACES[ex.workspace].icon;
              return (
                <li key={ex.id} className="flex gap-3 px-5 py-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-overlay">
                    <Icon className="size-4 text-text-secondary" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-label font-medium text-text-primary">{ex.title}</p>
                      <StatusPill tone={sev.tone}>{sev.label}</StatusPill>
                    </div>
                    <p className="mt-0.5 truncate text-caption text-text-secondary">{ex.detail}</p>
                    <p className="mt-0.5 text-caption text-text-muted">
                      ผู้รับผิดชอบ: {ex.owner} · เปิดมา {ex.age}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}

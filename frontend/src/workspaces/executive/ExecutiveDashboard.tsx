import { ArrowUpRight, Eye, ShieldAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  Metric,
  Panel,
  SampleTag,
  StatusPill,
  WorkspaceHero,
  type Tone,
} from '@/components/app/primitives';
import { WORKSPACES, type WorkspaceId } from '../registry';

/* Minimal sample content for UX review only. */

const SUMMARY = [
  { label: 'คำสั่งซื้อที่เปิดอยู่', value: 12 },
  { label: 'งานล่าช้า', value: 1, tone: 'warning' as const },
  { label: 'ข้อยกเว้นที่ต้องตัดสินใจ', value: 2, tone: 'warning' as const },
  { label: 'รอการอนุมัติ', value: 0 },
];

const DEPARTMENTS: {
  id: Exclude<WorkspaceId, 'executive' | 'admin'>;
  status: { tone: Tone; label: string };
  metrics: [string, string][];
}[] = [
  {
    id: 'sales',
    status: { tone: 'success', label: 'ปกติ' },
    metrics: [
      ['คำสั่งซื้อ', '12'],
      ['รอจัดส่ง', '3'],
    ],
  },
  {
    id: 'operations',
    status: { tone: 'warning', label: 'ต้องติดตาม' },
    metrics: [
      ['กำลังทำ', '4'],
      ['ล่าช้า', '1'],
    ],
  },
  {
    id: 'warehouse',
    status: { tone: 'success', label: 'ปกติ' },
    metrics: [
      ['รอรับเข้า', '2'],
      ['ใกล้หมดอายุ', '1'],
    ],
  },
  {
    id: 'purchasing',
    status: { tone: 'warning', label: 'ต้องติดตาม' },
    metrics: [
      ['PR รออนุมัติ', '2'],
      ['ส่งล่าช้า', '1'],
    ],
  },
  {
    id: 'accounting',
    status: { tone: 'success', label: 'ปกติ' },
    metrics: [
      ['รอชำระ', '2'],
      ['เอกสารไม่ครบ', '0'],
    ],
  },
];

const EXCEPTIONS: {
  title: string;
  detail: string;
  dept: WorkspaceId;
  tone: Tone;
  severity: string;
}[] = [
  {
    title: 'ซัพพลายเออร์ส่งของล่าช้า',
    detail: 'ใบสั่งซื้อเลยกำหนดส่ง 1 วัน — กระทบใบสั่งงานที่รอวัตถุดิบ',
    dept: 'purchasing',
    tone: 'danger',
    severity: 'สูง',
  },
  {
    title: 'ใบสั่งงานเสี่ยงล่าช้า',
    detail: 'ความคืบหน้าต่ำกว่าแผน และใกล้กำหนดส่งให้ลูกค้า',
    dept: 'operations',
    tone: 'warning',
    severity: 'ปานกลาง',
  },
];

export default function ExecutiveDashboard() {
  const ws = WORKSPACES.executive;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="ภาพรวมองค์กร"
        subtitle="ทุกแผนกบนข้อมูลชุดเดียวกัน — ผู้บริหารดูภาพรวมและตัดสินใจจากข้อยกเว้น"
        motif={ws.motif}
        actions={
          <StatusPill tone="neutral">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" aria-hidden /> มุมมองอ่านเป็นหลัก
            </span>
          </StatusPill>
        }
      />

      <section aria-labelledby="exec-summary" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="exec-summary" className="text-body font-semibold text-text-primary">
            สรุปวันนี้
          </h2>
          <SampleTag />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SUMMARY.map((m) => (
            <Metric key={m.label} label={m.label} value={m.value} tone={m.tone} />
          ))}
        </div>
      </section>

      <section aria-labelledby="exec-departments" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="exec-departments" className="text-body font-semibold text-text-primary">
            แผนก
          </h2>
          <SampleTag />
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {DEPARTMENTS.map((d) => {
            const dept = WORKSPACES[d.id];
            const Icon = dept.icon;
            return (
              <li key={d.id} style={{ '--ws-accent': dept.accent } as CSSProperties}>
                <Link
                  to={`/app/${d.id}`}
                  className="group flex h-full flex-col rounded-panel border border-border-soft bg-surface-base p-5 transition-colors hover:border-[color-mix(in_oklab,var(--ws-accent)_45%,transparent)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-label font-semibold text-text-primary">
                      <Icon className="size-4.5 text-[var(--ws-accent)]" aria-hidden />
                      {dept.shortTh}
                    </span>
                    <ArrowUpRight
                      className="size-4 text-text-muted transition-colors group-hover:text-[var(--ws-accent)]"
                      aria-hidden
                    />
                  </div>
                  <StatusPill tone={d.status.tone} className="mt-4 self-start">
                    {d.status.label}
                  </StatusPill>
                  <dl className="mt-5 grid grid-cols-2 gap-3">
                    {d.metrics.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-caption text-text-muted">{label}</dt>
                        <dd className="mt-0.5 text-h3 text-text-primary tabular">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Panel
        title="ข้อยกเว้นที่ต้องตัดสินใจ"
        subtitle="ยกขึ้นมาเฉพาะสิ่งที่ผิดไปจากแผน เรียงตามความรุนแรง"
        action={<SampleTag />}
      >
        <ul className="space-y-3">
          {EXCEPTIONS.map((ex) => {
            const dept = WORKSPACES[ex.dept];
            return (
              <li
                key={ex.title}
                className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface-raised/50 p-5 sm:flex-row sm:items-center"
              >
                <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-label font-medium text-text-primary">{ex.title}</p>
                  <p className="mt-0.5 text-caption text-text-muted">{ex.detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-text-secondary">{dept.shortTh}</span>
                  <StatusPill tone={ex.tone}>{ex.severity}</StatusPill>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

import { KeyRound, UserPlus } from 'lucide-react';
import { EmptyState, Panel, StatusPill, WorkspaceHero } from '@/components/app/primitives';
import { WORKSPACE_ORDER, WORKSPACES } from '../registry';

/*
 * Admin shows configuration concepts only. There are no stored users yet — the
 * prototype reviewer account is not a user record.
 */

const ROLES = [
  { code: 'SYSTEM_ADMIN', name: 'ผู้ดูแลระบบ', note: 'จัดการผู้ใช้ แผนก และการตั้งค่า' },
  { code: 'EXECUTIVE', name: 'ผู้บริหาร', note: 'ดูภาพรวมทุกแผนก อนุมัติได้เมื่อได้รับสิทธิ์' },
  { code: 'DEPARTMENT_MANAGER', name: 'หัวหน้าแผนก', note: 'ดูแลงานและอนุมัติภายในแผนก' },
  { code: 'STAFF', name: 'พนักงาน', note: 'ทำงานประจำวันของแผนก' },
  { code: 'VIEWER', name: 'ผู้ดูข้อมูล', note: 'ดูข้อมูลอย่างเดียว' },
];

export default function AdminDashboard() {
  const ws = WORKSPACES.admin;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="ผู้ใช้ แผนก และบทบาท"
        subtitle="หนึ่งพื้นที่ทำงาน CORE สำหรับหนึ่งบริษัท — ผู้ดูแลระบบไม่ใช่ผู้บริหาร"
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="ผู้ใช้งาน" subtitle="ผู้ใช้แต่ละคนจะมีแผนกหลักที่เข้าสู่ระบบแล้วเปิดทันที">
          <EmptyState
            icon={UserPlus}
            title="ยังไม่มีผู้ใช้ในระบบ"
            description="การเชิญผู้ใช้จะเปิดใช้พร้อมระบบยืนยันตัวตนจริง บัญชีทดลอง user1 ใช้สำหรับตรวจต้นแบบเท่านั้นและไม่ได้ถูกบันทึกเป็นผู้ใช้"
            action="เชิญผู้ใช้"
          />
        </Panel>

        <Panel title="แผนก" subtitle="รหัสแผนกเป็นตัวระบุภายใน ไม่ใช่ชื่อที่แสดง">
          <ul className="divide-y divide-border-soft">
            {WORKSPACE_ORDER.map((id) => {
              const w = WORKSPACES[id];
              const Icon = w.icon;
              return (
                <li key={id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className="size-4.5 shrink-0" style={{ color: w.accent }} aria-hidden />
                  <span className="flex-1 text-label text-text-primary">{w.shortTh}</span>
                  <code className="rounded-md bg-surface-overlay px-2 py-0.5 text-caption text-text-secondary">
                    {id}
                  </code>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <section aria-labelledby="admin-roles" className="mt-12">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="admin-roles" className="text-body font-semibold text-text-primary">
            บทบาท
          </h2>
          <StatusPill tone="neutral">โครงร่าง — สิทธิ์ละเอียดกำหนดในรอบถัดไป</StatusPill>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <li
              key={r.code}
              className="rounded-panel border border-border-soft bg-surface-base p-5"
            >
              <KeyRound className="size-4.5 text-[var(--ws-accent)]" aria-hidden />
              <p className="mt-3 text-label font-semibold text-text-primary">{r.name}</p>
              <code className="mt-1 block text-[0.75rem] text-text-muted">{r.code}</code>
              <p className="mt-3 text-caption text-text-muted">{r.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

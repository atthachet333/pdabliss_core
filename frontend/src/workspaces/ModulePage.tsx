import { CircleDashed } from 'lucide-react';
import { EmptyState, Panel, WorkspaceHero } from '@/components/app/primitives';
import { WORKSPACES, type WorkspaceId } from './registry';

/** Module placeholder: states intent and planned capabilities. No fake records. */
export default function ModulePage({ workspace, path }: { workspace: WorkspaceId; path: string }) {
  const ws = WORKSPACES[workspace];
  const item = ws.nav.find((n) => n.path === path);
  if (!item) return null;

  return (
    <>
      <WorkspaceHero
        icon={item.icon}
        eyebrow={ws.shortTh}
        title={item.label}
        subtitle={item.summary ?? ''}
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="รายการ">
          <EmptyState
            icon={item.icon}
            title={`ยังไม่มีข้อมูลใน${item.label}`}
            description="โมดูลนี้จะเชื่อมกับข้อมูลจริงในรอบพัฒนาถัดไป ต้นแบบนี้แสดงเฉพาะโครงสร้างหน้าจอ"
          />
        </Panel>
        {item.planned && (
          <Panel title="สิ่งที่จะมีในโมดูลนี้">
            <ul className="space-y-3">
              {item.planned.map((p) => (
                <li key={p} className="flex items-center gap-3 text-label text-text-secondary">
                  <CircleDashed className="size-4 shrink-0 text-[var(--ws-accent)]" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}

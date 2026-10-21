import { CircleDashed, Construction } from 'lucide-react';
import { Link } from 'react-router';
import { PageTitle, Panel } from '@/components/app/primitives';
import { WORKSPACES, type WorkspaceId } from './registry';

/** Placeholder for modules scheduled after EP00. Describes intent; performs no fake business logic. */
export default function ModulePage({ workspace, path }: { workspace: WorkspaceId; path: string }) {
  const ws = WORKSPACES[workspace];
  const item = ws.nav.find((n) => n.path === path);
  if (!item) return null;
  const Icon = item.icon;

  return (
    <>
      <PageTitle title={item.label} subtitle={ws.nameTh} />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="โมดูลนี้จะทำอะไร" subtitle="อยู่ในแผนพัฒนารอบถัดไป">
          <div className="flex gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border-brand bg-brand-primary/10">
              <Icon className="size-5 text-brand-glow" aria-hidden />
            </span>
            <p className="text-body text-text-secondary">{item.summary}</p>
          </div>
          {item.planned && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-3">
              {item.planned.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface-raised/60 px-3 py-3 text-label text-text-primary"
                >
                  <CircleDashed className="size-4 shrink-0 text-brand-soft" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="สถานะการพัฒนา">
          <div className="flex items-start gap-3 text-label text-text-secondary">
            <Construction className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>
              EP00 วางโครงสร้างพื้นที่ทำงานและเส้นทางของโมดูลนี้ไว้แล้ว ฟังก์ชันจริงจะเชื่อมกับ API
              ที่ตรวจสอบสิทธิ์และเวิร์กโฟลว์ที่เซิร์ฟเวอร์ในรอบพัฒนาถัดไป
            </p>
          </div>
          <Link
            to={`/app/${workspace}`}
            className="mt-5 inline-block text-label font-medium text-brand-glow hover:underline"
          >
            กลับไปหน้าภาพรวม
          </Link>
        </Panel>
      </div>
    </>
  );
}

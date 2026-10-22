import {
  BellRing,
  CheckCheck,
  ClipboardCheck,
  ListTodo,
  Settings2,
  Stamp,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button, Drawer, EmptyState, PrototypeTag, Tabs } from '@/components/core';
import { cn } from '@/lib/cn';
import { SAMPLE_NOTIFICATIONS, type NotificationCategory } from './notifications';

const CATEGORY: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  task: { label: 'งาน', icon: ListTodo },
  approval: { label: 'อนุมัติ', icon: Stamp },
  alert: { label: 'แจ้งเตือน', icon: BellRing },
  system: { label: 'ระบบ', icon: Settings2 },
};

/** Notification panel (right drawer). Read state is local to this page view. */
export function NotificationCenter({
  open,
  onClose,
  unread,
  onMarkRead,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  unread: ReadonlySet<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const [tab, setTab] = useState<'all' | NotificationCategory>('all');
  const items = SAMPLE_NOTIFICATIONS.filter((n) => tab === 'all' || n.category === tab);
  const countFor = (c: NotificationCategory) =>
    SAMPLE_NOTIFICATIONS.filter((n) => n.category === c && unread.has(n.id)).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="การแจ้งเตือน"
      headerExtra={<PrototypeTag>ตัวอย่าง</PrototypeTag>}
      footer={
        <Button
          variant="ghost"
          size="sm"
          icon={CheckCheck}
          onClick={onMarkAllRead}
          disabled={unread.size === 0}
        >
          ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
        </Button>
      }
    >
      <Tabs
        label="หมวดการแจ้งเตือน"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        tabs={[
          { id: 'all', label: 'ทั้งหมด', count: unread.size || undefined },
          ...(Object.keys(CATEGORY) as NotificationCategory[]).map((c) => ({
            id: c,
            label: CATEGORY[c].label,
            count: countFor(c) || undefined,
          })),
        ]}
      >
        {items.length === 0 ? (
          <EmptyState
            kind="clear"
            layout="compact"
            icon={ClipboardCheck}
            title="ไม่มีการแจ้งเตือนในหมวดนี้"
          />
        ) : (
          <ul className="-mx-2 space-y-1">
            {items.map((n) => {
              const meta = CATEGORY[n.category];
              const Icon = meta.icon;
              const isUnread = unread.has(n.id);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-control px-3 py-3 text-left transition-colors hover:bg-fill-hover',
                      isUnread && 'bg-fill-hover',
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-raised">
                      <Icon className="size-4 text-fg-secondary" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span
                          className={cn(
                            'flex-1 text-label',
                            isUnread ? 'font-medium text-fg-primary' : 'text-fg-secondary',
                          )}
                        >
                          {n.title}
                        </span>
                        {isUnread && (
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-[var(--ws-accent)]">
                            <span className="sr-only">ยังไม่อ่าน</span>
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-caption text-fg-muted">{n.body}</span>
                      <span className="mt-1 block text-[0.75rem] text-fg-muted">
                        {meta.label} · {n.time}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Tabs>
    </Drawer>
  );
}

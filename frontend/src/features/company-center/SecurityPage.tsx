import { KeyRound, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { DEPARTMENT_CODES, type DepartmentCode } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { controlApi, type ActivityItem } from './api';
import { RequirePermission } from './CompanyShell';
import { ADMIN_COPY } from './adminCopy';
import { CONTROL_COPY } from './copy';
import { PERMISSION_COPY } from './permissionCopy';
import { errorText, eventLabel, useDateFormat, useDepartmentName, useLoad } from './model';
import { Loading, PageTitle, Section } from './parts';

/*
 * /company/security — what changed in the company and members' sign-in and
 * security events (Owner, System Admin). The server sends safe fields only:
 * no IP addresses, user agents, hashes or tokens; PDA BLISS operators appear
 * as "PDA BLISS", never by name.
 */

type Scope = 'all' | 'admin' | 'security';

export function SecurityPage() {
  return (
    <RequirePermission permission="company.activity.view">
      <Security />
    </RequirePermission>
  );
}

function Security() {
  const c = useCopy(CONTROL_COPY);
  const [scope, setScope] = useState<Scope>('all');
  return (
    <div className="grid gap-8">
      <PageTitle title={c.security.title} lead={c.security.lead} />
      <div role="radiogroup" aria-label={c.security.filterLabel} className="flex flex-wrap gap-2">
        {(['all', 'admin', 'security'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={scope === s}
            onClick={() => setScope(s)}
            className={cn(
              'min-h-11 rounded-full px-4 text-label transition-colors motion-reduce:transition-none',
              scope === s
                ? 'bg-brand-primary/[0.12] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                : 'text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] hover:text-text-primary',
            )}
          >
            {c.security.filters[s]}
          </button>
        ))}
      </div>
      <Timeline key={scope} scope={scope} />
    </div>
  );
}

function Timeline({ scope }: { scope: Scope }) {
  const c = useCopy(CONTROL_COPY);
  const { state } = useLoad(() => controlApi.activity(scope));
  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const items = state.data.items;
  return (
    <Section id="timeline-title" title={c.security.filters[scope]}>
      {items.length === 0 ? (
        <p className="text-label text-text-secondary">{c.security.empty}</p>
      ) : (
        <ol className="grid" data-activity={scope}>
          {items.map((item) => (
            <Entry key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ol>
      )}
    </Section>
  );
}

const isDepartment = (v: unknown): v is DepartmentCode =>
  typeof v === 'string' && (DEPARTMENT_CODES as readonly string[]).includes(v);

/**
 * A short, human detail line from the event's safe details: who was invited,
 * from → to (roles, statuses), which branch or department. Unknown keys are
 * not shown.
 */
function detailText(
  item: ActivityItem,
  words: Record<string, string>,
  dept: (code: DepartmentCode) => string,
) {
  const d = item.details;
  const word = (v: string) => words[v] ?? v;
  const parts: string[] = [];
  if (typeof d.email === 'string') parts.push(d.email);
  if (typeof d.from === 'string' && typeof d.to === 'string') {
    parts.push(`${word(d.from)} → ${word(d.to)}`);
  } else if (typeof d.role === 'string') parts.push(word(d.role));
  if (typeof d.code === 'string') parts.push(isDepartment(d.code) ? dept(d.code) : d.code);
  if (typeof d.name === 'string') parts.push(d.name);
  if (Array.isArray(d.departments))
    parts.push(d.departments.filter(isDepartment).map(dept).join(', '));
  return parts.join(' · ');
}

function Entry({ item }: { item: ActivityItem }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const { dateTime } = useDateFormat();
  const dept = useDepartmentName();
  const statusWords: Record<string, string> = {
    ACTIVE: c.common.active,
    INACTIVE: c.common.inactive,
    DEACTIVATED: c.common.deactivated,
  };
  const ad = useCopy(ADMIN_COPY);
  const pc = useCopy(PERMISSION_COPY);
  const label = eventLabel(item, c, ad, pc);
  const who =
    item.actor.kind === 'platform'
      ? c.security.platform
      : item.actor.kind === 'system'
        ? c.security.system
        : (item.actor.fullName ?? item.actor.email);
  const detail = detailText(item, { ...a.roles, ...statusWords }, dept);
  const Icon = item.kind === 'security' ? KeyRound : Settings2;
  return (
    <li
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-white/[0.05] py-3 last:border-0"
      data-event={item.type}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-8 place-items-center rounded-full',
          item.kind === 'security'
            ? 'bg-white/[0.05] text-text-secondary'
            : 'bg-brand-primary/[0.1] text-brand-soft',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-label text-text-primary">{label}</p>
        <p className="text-caption break-words text-text-muted">
          {who}
          {detail && ` · ${detail}`}
          {' · '}
          <time dateTime={item.occurredAt}>{dateTime(item.occurredAt)}</time>
        </p>
      </div>
    </li>
  );
}

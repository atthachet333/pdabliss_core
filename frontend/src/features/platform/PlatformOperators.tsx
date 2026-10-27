import { Crown, ShieldCheck } from 'lucide-react';
import { platformApi, type Identity, type PlatformOperator } from '@/features/auth/api';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { PLATFORM_COPY } from './copy';
import { formatDate, useLoad } from './model';
import { PLATFORM_OPS_COPY } from './opsCopy';
import { LoadErrorMessage, StateMessage } from './parts';
import { PlatformShell } from './PlatformShell';

/*
 * /platform/operators (EP24.1.2): the platform team by authority — the one
 * Platform Owner above, Platform Admins below. Read-only. The list is
 * owner-only on the server (403 for an admin); an admin who opens the page
 * sees the reason, not an error.
 */
export function PlatformOperators({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  const o = useCopy(PLATFORM_OPS_COPY);
  const v = o.operators;
  const owner = identity.platformRole === 'PLATFORM_OWNER';
  usePageMeta(v.title, p.meta.description, { index: false });

  return (
    <PlatformShell identity={identity}>
      <header className="max-w-3xl">
        <p className="font-mono text-[0.6875rem] tracking-[0.18em] text-warning uppercase">
          {v.kicker}
        </p>
        <h1 className="mt-3 text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] leading-tight font-semibold tracking-tight text-text-primary">
          {v.title}
        </h1>
        <p className="mt-2 text-label text-text-secondary">{v.lead}</p>
      </header>
      {owner ? (
        <OperatorList />
      ) : (
        <div className="mt-6">
          <StateMessage kind="forbidden" text={v.reserved} />
        </div>
      )}
    </PlatformShell>
  );
}

function OperatorList() {
  const p = useCopy(PLATFORM_COPY);
  const o = useCopy(PLATFORM_OPS_COPY);
  const v = o.operators;
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const { state, retry } = useLoad(() => platformApi.operators(), 'operators');
  if (state.status === 'loading') {
    return (
      <div className="mt-6">
        <StateMessage kind="loading" text="…" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="mt-6">
        <LoadErrorMessage error={state.error} p={p} onRetry={retry} />
      </div>
    );
  }
  const owners = state.value.operators.filter((x) => x.role === 'PLATFORM_OWNER');
  const admins = state.value.operators.filter((x) => x.role === 'PLATFORM_ADMIN');
  const Row = ({ op }: { op: PlatformOperator }) => (
    <li className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5 sm:px-6">
      <span className="min-w-0">
        <span className="block truncate text-label font-medium text-text-primary">
          {op.fullName ?? op.email}
        </span>
        {op.fullName && (
          <span className="block text-caption break-all text-text-muted">{op.email}</span>
        )}
      </span>
      <span className="text-caption text-text-muted">
        {v.since} <time dateTime={op.since}>{formatDate(op.since, lang)}</time>
      </span>
    </li>
  );
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2" data-operators>
      {[
        {
          key: 'owner',
          title: v.ownerTitle,
          text: v.ownerText,
          list: owners,
          icon: <Crown aria-hidden className="size-5" />,
          tone: 'owner',
        },
        {
          key: 'admin',
          title: v.adminTitle,
          text: v.adminText,
          list: admins,
          icon: <ShieldCheck aria-hidden className="size-5" />,
          tone: 'admin',
        },
      ].map((g) => (
        <section
          key={g.key}
          aria-labelledby={`op-${g.key}`}
          data-operator-group={g.key}
          className={cn(
            'min-w-0 rounded-[1.375rem] bg-[rgb(8_16_24/0.7)]',
            g.tone === 'owner'
              ? 'shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]'
              : 'shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
          )}
        >
          <div className="flex gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <span className={g.tone === 'owner' ? 'text-warning' : 'text-brand-soft'}>
              {g.icon}
            </span>
            <div className="min-w-0">
              <h2 id={`op-${g.key}`} className="text-body font-semibold text-text-primary">
                {g.title}
              </h2>
              <p className="mt-0.5 text-caption text-text-muted">{g.text}</p>
            </div>
          </div>
          {g.list.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {g.list.map((op) => (
                <Row key={op.userId} op={op} />
              ))}
            </ul>
          ) : (
            <p className="px-6 py-4 text-caption text-text-muted">{v.noAdmins}</p>
          )}
        </section>
      ))}
      <p className="text-caption text-text-muted xl:col-span-2">{v.actionsNote}</p>
    </div>
  );
}

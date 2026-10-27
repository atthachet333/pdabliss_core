import { useState } from 'react';
import { platformApi, type ActivityScope, type Identity } from '@/features/auth/api';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { ActivityList } from './ActivityList';
import { PLATFORM_COPY } from './copy';
import { useLoad } from './model';
import { PLATFORM_OPS_COPY } from './opsCopy';
import { LoadErrorMessage, StateMessage } from './parts';
import { PlatformShell } from './PlatformShell';

/*
 * /platform/activity (EP24.1.2): the full security and company timeline that
 * the overview only samples. Read-only; three views over the same feed.
 */

const SCOPES: ActivityScope[] = ['all', 'security', 'company'];

export function PlatformActivity({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  const o = useCopy(PLATFORM_OPS_COPY);
  const a = o.activity;
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  usePageMeta(a.title, p.meta.description, { index: false });
  const [scope, setScope] = useState<ActivityScope>('all');
  const { state, retry } = useLoad(() => platformApi.activity(100, scope), scope);

  return (
    <PlatformShell identity={identity}>
      <header className="max-w-3xl">
        <p className="font-mono text-[0.6875rem] tracking-[0.18em] text-brand-soft uppercase">
          {a.kicker}
        </p>
        <h1 className="mt-3 text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] leading-tight font-semibold tracking-tight text-text-primary">
          {a.title}
        </h1>
        <p className="mt-2 text-label text-text-secondary">{a.lead}</p>
      </header>

      <div role="group" aria-label={a.scopeLabel} className="mt-6 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={scope === s}
            onClick={() => setScope(s)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full px-4 text-label transition-colors motion-reduce:transition-none',
              scope === s
                ? 'bg-white/[0.08] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                : 'bg-white/[0.02] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] hover:text-text-primary',
            )}
          >
            {a.scopes[s]}
          </button>
        ))}
      </div>

      <section
        aria-label={a.scopes[scope]}
        className="mt-5 min-w-0 rounded-[1.375rem] bg-[rgb(8_16_24/0.7)] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]"
      >
        {state.status === 'loading' ? (
          <div className="p-5">
            <StateMessage kind="loading" text={a.loading} />
          </div>
        ) : state.status === 'error' ? (
          <div className="p-5">
            <LoadErrorMessage error={state.error} p={p} onRetry={retry} />
          </div>
        ) : state.value.items.length === 0 ? (
          <p className="px-6 py-5 text-caption text-text-muted">{a.empty}</p>
        ) : (
          <ActivityList items={state.value.items} p={p} o={o} lang={lang} />
        )}
      </section>
    </PlatformShell>
  );
}

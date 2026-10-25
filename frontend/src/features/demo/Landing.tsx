import { ArrowRight, Check, EyeOff, Eye } from 'lucide-react';
import { useState } from 'react';
import { Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { DEMO_COPY } from './copy';
import { ROLE_ICON } from './format';
import { ROLES, type Role } from './machine';

/*
 * The demo's orientation (EP14): one H1, a brief "one work item · five views
 * · one shared state", and the role question. No sign-up, no form — the
 * visitor chooses a view and starts. After starting, the intro collapses to
 * a compact heading above the workspace.
 */

export function DemoIntro({ compact }: { compact: boolean }) {
  const c = useCopy(DEMO_COPY);
  return (
    <header className={cn(compact ? 'mb-5' : 'mb-10 lg:mb-0')}>
      <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
        <span aria-hidden className="h-px w-6 bg-current opacity-70" />
        {c.intro.eyebrow}
        <span className="rounded-md bg-warning/15 px-2 py-0.5 text-caption font-semibold tracking-[0.2em] text-warning">
          {c.demoTag}
        </span>
      </p>
      <h1
        id="demo-title"
        className={cn(
          'mt-4 font-semibold tracking-tight text-text-primary',
          compact
            ? 'text-[clamp(1.375rem,1.1rem+1vw,1.875rem)] leading-[1.3]'
            : 'text-[clamp(2rem,1.2rem+2.8vw,3.5rem)] leading-[1.18]',
        )}
      >
        <Lines text={c.intro.title} />
      </h1>
      {!compact && (
        <>
          <p className="mt-6 max-w-xl text-body-lg text-text-secondary">{c.intro.lead}</p>
          <ul data-trio className="mt-8 flex flex-wrap gap-2">
            {c.intro.trio.map((t, i) => (
              <li
                key={t}
                className={cn(
                  'rounded-full px-4 py-2 text-label font-semibold',
                  i === 2
                    ? 'bg-brand-primary/15 text-brand-glow'
                    : 'bg-white/[0.05] text-text-primary',
                )}
              >
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-caption text-text-muted">{c.intro.noSignup}</p>
        </>
      )}
      <p data-disclosure-intro className="mt-2 text-caption text-warning/80">
        {c.disclosure}
      </p>
    </header>
  );
}

export function RoleSelect({ initial, onStart }: { initial: Role; onStart: (r: Role) => void }) {
  const c = useCopy(DEMO_COPY);
  const [role, setRole] = useState<Role>(initial);
  return (
    <div data-role-select>
      <fieldset>
        <legend className="text-h3 text-text-primary">{c.intro.question}</legend>
        <div className="mt-5 grid grid-cols-1 gap-2.5">
          {ROLES.map((r) => {
            const on = r === role;
            const Icon = ROLE_ICON[r];
            const t = c.roles[r];
            return (
              <label key={r} data-role-option={r} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name="demo-role"
                  value={r}
                  checked={on}
                  onChange={() => setRole(r)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    'grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 rounded-2xl px-4 py-3.5 transition-[background-color,box-shadow] peer-focus-visible:ring-2 peer-focus-visible:ring-brand-glow',
                    on
                      ? 'bg-brand-primary/10 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.55)]'
                      : 'bg-white/[0.03] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:bg-white/[0.05]',
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white/[0.05]">
                    <Icon
                      aria-hidden
                      className="size-4"
                      style={{ color: `var(--color-ws-${r})` }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      {t.name}
                      {on && <Check aria-hidden className="size-4 text-brand-glow" />}
                    </span>
                    <span className="mt-0.5 block text-caption text-text-secondary">
                      {t.responsible}
                    </span>
                    <span className="mt-1.5 grid grid-cols-1 gap-1 text-caption sm:grid-cols-2 sm:gap-4">
                      <span className="flex items-baseline gap-1.5 text-text-secondary">
                        <Eye
                          aria-hidden
                          className="size-3 shrink-0 translate-y-[0.1em] text-brand-soft"
                        />
                        <span>
                          <span className="sr-only">{c.intro.sees}: </span>
                          {t.sees}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-1.5 text-text-muted">
                        <EyeOff aria-hidden className="size-3 shrink-0 translate-y-[0.1em]" />
                        <span>
                          <span className="sr-only">{c.intro.notSees}: </span>
                          {t.notSees}
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <button
        type="button"
        data-start
        onClick={() => onStart(role)}
        className="mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-7 text-body font-semibold text-text-inverse shadow-glow-sm transition-colors hover:bg-brand-glow sm:w-auto"
      >
        {c.intro.start}
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PreviewFrameProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  nav: readonly string[];
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
}

/** Window chrome for illustrative product mockups (decorative, not a live app). */
export function PreviewFrame({
  icon: Icon,
  title,
  subtitle,
  nav,
  children,
  className,
  badge,
}: PreviewFrameProps) {
  return (
    <div
      className={cn(
        '@container overflow-hidden rounded-card border border-border-strong bg-surface-base shadow-raised',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border-soft bg-surface-raised/80 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-text-muted/40" />
          <span className="size-2.5 rounded-full bg-text-muted/40" />
          <span className="size-2.5 rounded-full bg-text-muted/40" />
        </span>
        <span className="ml-2 truncate text-[0.75rem] text-text-muted">core.pdabliss.com/app</span>
      </div>
      <div className="flex min-h-0">
        <div className="hidden w-36 shrink-0 border-r border-border-soft bg-surface-dark/60 p-3 @xl:block">
          <div className="mb-3 flex items-center gap-2 px-1.5">
            <Icon className="size-4 text-brand-glow" aria-hidden />
            <span className="truncate text-[0.75rem] font-semibold text-text-primary">{title}</span>
          </div>
          <ul className="space-y-0.5">
            {nav.map((item, i) => (
              <li
                key={item}
                className={cn(
                  'truncate rounded-lg px-2 py-1.5 text-[0.75rem]',
                  i === 0 ? 'bg-brand-primary/12 text-brand-soft' : 'text-text-muted',
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 flex-1 p-4 @xl:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-label font-semibold text-text-primary">{subtitle}</p>
              <p className="text-[0.75rem] text-text-muted @xl:hidden">{title}</p>
            </div>
            {badge}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger' | 'brand';
}) {
  const toneClass = {
    default: 'text-text-primary',
    brand: 'text-brand-glow',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];
  return (
    <div className="rounded-xl border border-border-soft bg-surface-raised/70 p-3">
      <p className="truncate text-[0.75rem] text-text-muted">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular', toneClass)}>{value}</p>
    </div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { panelSurface } from './styles';

/*
 * Loading placeholders that occupy exactly the space of the content they
 * stand in for, so nothing jumps when data arrives. A gentle pulse only —
 * stopped entirely under prefers-reduced-motion (see styles/index.css).
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('block animate-pulse rounded-md bg-fill-muted', className)} />
  );
}

function Busy({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function KpiSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Busy label="กำลังโหลดตัวเลขสรุป" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(panelSurface, 'p-5')}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </Busy>
  );
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Busy label="กำลังโหลด" className={cn(panelSurface, 'p-5 sm:p-6', className)}>
      <Skeleton className="h-4 w-40" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </Busy>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Busy label="กำลังโหลดรายการ" className="w-full">
      {/* Desktop rows */}
      <div className="hidden md:block">
        <div className="flex gap-6 border-b border-line bg-panel-raised/60 px-5 py-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className={cn('h-3', i === 0 ? 'w-32' : 'w-20')} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-0"
          >
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-40' : 'w-20')} />
            ))}
          </div>
        ))}
      </div>
      {/* Mobile card rows */}
      <div className="space-y-3 p-4 md:hidden">
        {Array.from({ length: Math.min(rows, 3) }, (_, r) => (
          <div key={r} className="rounded-control border border-line p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Full page placeholder: header, KPI row, one table panel. Used as the route Suspense fallback. */
export function PageSkeleton() {
  return (
    <Busy label="กำลังโหลดหน้า" className="space-y-8">
      <div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-4 h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn(panelSurface, 'p-5')}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className={cn(panelSurface, 'overflow-hidden')}>
        <div className="px-5 pt-5 pb-4">
          <Skeleton className="h-4 w-32" />
        </div>
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className="flex items-center gap-6 border-t border-line px-5 py-4">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="hidden h-3.5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

import { Sparkles } from 'lucide-react';
import { useMediaQuery } from '@/components/core/hooks';
import { Frame } from '@/components/editorial/Layout';
import { Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { CONTACT_COPY } from './copy';
import type { Inquiry, Prefill } from './model';
import { Summary } from './Summary';
import { useDeptName } from './summaryText';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';

/*
 * /contact surroundings (EP13; consolidated in EP24.1.4.1–EP24.1.4.2): the
 * hero, the context the visitor arrived with and the live summary that follows
 * the consultation. Phone, LINE and email are offered by the consultation
 * itself (its final hand-off), so the page does not repeat them.
 */

const PLAN_NAMES = {
  starter: 'Starter',
  business: 'Business',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

export function ContactHero() {
  const c = useCopy(CONTACT_COPY).hero;
  return (
    <section aria-labelledby="contact-title" className="relative isolate overflow-hidden">
      <svg
        aria-hidden
        className="absolute inset-0 -z-10 size-full opacity-60"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {[22, 48, 74].map((y, i) => (
          <path
            key={y}
            d={`M 0 ${y} C 30 ${y - 8 + i * 4}, 60 ${y + 10 - i * 3}, 100 ${y - 4}`}
            fill="none"
            stroke="#3ef0c0"
            strokeOpacity="0.06"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_60%_at_85%_10%,rgb(62_224_180/0.08),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-10 sm:pt-32 lg:pt-32 lg:pb-12">
        <div className="grid grid-cols-1 gap-10 lg:max-w-4xl">
          <div>
            <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
              <span aria-hidden className="h-px w-6 bg-current opacity-70" />
              {c.eyebrow}
            </p>
            <h1
              id="contact-title"
              className="mt-5 text-[clamp(2rem,1.2rem+2.9vw,3.75rem)] leading-[1.18] font-semibold tracking-tight text-text-primary"
            >
              <Lines text={c.title} />
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{c.lead}</p>
          </div>
        </div>
      </Frame>
    </section>
  );
}

/** What we already know from the page the visitor came from. */
export function ContextBanner({ prefill }: { prefill: Prefill }) {
  const c = useCopy(CONTACT_COPY);
  const deptName = useDeptName();
  const lines: string[] = [];
  if (prefill.plan === 'enterprise' || (!prefill.plan && prefill.type === 'enterprise'))
    lines.push(c.context.enterprise);
  else if (prefill.plan) lines.push(c.context.plan(PLAN_NAMES[prefill.plan]));
  if (prefill.department) lines.push(c.context.department(deptName(prefill.department)));
  if (prefill.industry) lines.push(c.context.industry(c.industries[prefill.industry]));
  if (!lines.length) return null;
  return (
    <div
      data-context
      className="mb-6 rounded-2xl bg-brand-primary/[0.07] px-5 py-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]"
    >
      <p className="flex items-center gap-2 text-caption font-semibold text-brand-soft">
        <Sparkles aria-hidden className="size-3.5" />
        {c.context.label}
      </p>
      <ul className="mt-2 space-y-1">
        {lines.map((l) => (
          <li key={l} data-context-line className="text-label font-semibold text-text-primary">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the visitor has chosen so far, beside the consultation it follows.
 * Open on wide screens; a disclosure on phones (never sticky).
 */
export function LiveSummary({ inquiry }: { inquiry: Inquiry }) {
  const c = useCopy(CONTACT_COPY).panel;
  const wide = useMediaQuery('(min-width: 64rem)');
  return (
    <details
      key={wide ? 'wide' : 'narrow'}
      data-live-summary
      open={wide || undefined}
      className="group mt-4 rounded-2xl px-5 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:px-6 lg:pointer-events-none"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-caption font-semibold text-text-muted lg:cursor-default">
        {c.summaryTitle}
        <DisclosureIcon size="sm" className="lg:hidden" />
      </summary>
      <Summary inquiry={inquiry} includeContact={false} className="mt-1 pb-2" />
    </details>
  );
}

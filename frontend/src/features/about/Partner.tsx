import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { companyName } from '@/config/company';
import { INSIGHT_PARTNER } from '@/config/partners';
import { StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { ABOUT_CHAPTER } from './model';
import { PARTNER } from './partnerCopy';

/* ------------------------------------------------------------------ */
/* 07 Business insight — PDA BLISS × S2 (EP24.1, owner-approved)        */
/* ------------------------------------------------------------------ */

/*
 * Not a logo strip: two companies with different roles meeting at CORE.
 * Left, PDA BLISS — technology and platform design. Right, S2 ACCOUNTING
 * CONSULTANT — accounting, advisory and business-process insight. Between
 * them, the one thing they share: CORE is checked against how work and
 * documents really move. A closing line states plainly that they are
 * separate companies.
 */
export function PartnerChapter() {
  const c = useCopy(PARTNER);
  const { locale } = useLocale();
  const s2Name = locale === 'th' ? INSIGHT_PARTNER.legalNameTh : INSIGHT_PARTNER.legalName;
  // Thai stays on Thai pages (EN / ZH carry no Thai beyond the approved exceptions).
  const s2Secondary = locale === 'th' ? INSIGHT_PARTNER.legalName : INSIGHT_PARTNER.brand;

  return (
    <Chapter id={ABOUT_CHAPTER.partner} labelledBy="business-insight-title" plane="deep" space="lg">
      <Frame width="wide">
        <StoryHead
          index="07"
          ghost
          kicker={c.kicker}
          id="business-insight-title"
          title={c.title}
          lead={c.lead}
        />

        <Stage className="mt-14 p-5 sm:p-8 lg:p-12" glow="warm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,17rem)_minmax(0,1fr)] lg:items-stretch lg:gap-0">
            {/* PDA BLISS */}
            <Side
              data="pda"
              mark={
                <span className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,rgb(18_44_52),rgb(7_16_24))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]">
                  <LogoMark className="size-8" />
                </span>
              }
              name={companyName(locale)}
              secondary="PDA BLISS"
              role={c.pda.role}
              points={c.pda.points}
              tone="clear"
            />

            {/* The bridge */}
            <div
              data-bridge
              className="relative flex flex-col items-center justify-center px-2 py-4 text-center lg:px-6"
            >
              <span
                aria-hidden
                className="absolute inset-x-[-1rem] top-1/2 hidden h-px -translate-y-[2.75rem] bg-[linear-gradient(90deg,rgb(62_240_192/0.45),rgb(190_235_222/0.1)_50%,rgb(245_184_75/0.45))] lg:block"
              />
              <span
                aria-hidden
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgb(62_240_192/0.4),rgb(190_235_222/0.08)_50%,rgb(245_184_75/0.4))] lg:hidden"
              />
              <span
                aria-hidden
                className="relative grid size-[4.5rem] place-items-center rounded-full bg-surface-dark font-mono text-[0.75rem] font-semibold tracking-[0.2em] text-brand-glow shadow-[0_0_0_6px_rgb(6_13_20),inset_0_0_0_1px_rgb(62_240_192/0.45),0_0_60px_-10px_rgb(62_240_192/0.45)]"
              >
                {c.bridge.core}
              </span>
              <div className="relative mt-5 rounded-2xl bg-surface-dark/90 px-4 py-3 lg:bg-transparent lg:px-0">
                <p className="text-label font-semibold text-text-primary">{c.bridge.title}</p>
                <p className="mt-2 text-caption leading-relaxed text-text-secondary">
                  {c.bridge.body}
                </p>
              </div>
            </div>

            {/* S2 */}
            <Side
              data="s2"
              mark={
                INSIGHT_PARTNER.logo ? (
                  <img
                    src={INSIGHT_PARTNER.logo}
                    alt={c.logoAlt}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="size-14 rounded-2xl bg-white object-contain p-1.5"
                  />
                ) : (
                  <span
                    aria-hidden
                    data-typographic-mark
                    className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,rgb(52_40_18),rgb(20_15_8))] text-[1.25rem] font-semibold tracking-tight text-[#f3cf8a] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]"
                  >
                    {INSIGHT_PARTNER.brand}
                  </span>
                )
              }
              name={s2Name}
              secondary={s2Secondary}
              role={c.s2.role}
              points={c.s2.points}
              tone="warm"
              action={
                <a
                  href={INSIGHT_PARTNER.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonClasses('secondary', 'md'), 'mt-7')}
                  data-partner-link
                >
                  {c.visit}
                  <ArrowUpRight aria-hidden className="size-4" />
                  <span className="sr-only">{c.external}</span>
                </a>
              }
            />
          </div>
        </Stage>

        <p
          data-boundary
          className="mt-10 max-w-3xl border-l-2 border-warning/40 pl-4 text-label text-text-secondary"
        >
          {c.boundary}
        </p>
      </Frame>
    </Chapter>
  );
}

function Side({
  data,
  mark,
  name,
  secondary,
  role,
  points,
  tone,
  action,
}: {
  data: string;
  mark: ReactNode;
  name: string;
  secondary: string;
  role: string;
  points: readonly string[];
  tone: 'clear' | 'warm';
  action?: ReactNode;
}) {
  return (
    <article
      data-side={data}
      className={cn(
        'relative min-w-0 rounded-[1.5rem] bg-[rgb(7_14_21/0.72)] p-6 sm:p-7',
        tone === 'clear'
          ? 'shadow-[inset_0_0_0_1px_rgb(62_240_192/0.14)]'
          : 'shadow-[inset_0_0_0_1px_rgb(245_184_75/0.16)]',
      )}
    >
      <div className="flex items-center gap-4">
        {mark}
        <div className="min-w-0">
          <h3 className="text-body font-semibold break-words text-text-primary">{name}</h3>
          <p className="text-caption break-words text-text-muted">{secondary}</p>
        </div>
      </div>
      <Kicker tone={tone} className="mt-6">
        {role}
      </Kicker>
      <ul className="mt-4 space-y-3">
        {points.map((pt) => (
          <li key={pt} className="flex gap-3 text-label leading-relaxed text-text-secondary">
            <span
              aria-hidden
              className={cn(
                'mt-[0.6em] size-1.5 shrink-0 rounded-full',
                tone === 'clear' ? 'bg-brand-glow' : 'bg-warning',
              )}
            />
            {pt}
          </li>
        ))}
      </ul>
      {action}
    </article>
  );
}

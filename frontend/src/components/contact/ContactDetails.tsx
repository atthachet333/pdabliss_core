import { Mail, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';

const linkClass =
  'rounded-sm text-text-primary transition-colors duration-200 hover:text-brand-glow';

function Row({
  icon: Icon,
  label,
  compact,
  children,
}: {
  icon: LucideIcon;
  label: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={cn('flex', compact ? 'gap-3' : 'gap-3.5')}>
      {compact ? (
        <Icon className="mt-[0.3rem] size-4 shrink-0 text-text-muted" aria-hidden />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-base/70">
          <Icon className="size-4 text-brand-soft" aria-hidden />
        </span>
      )}
      <div className={cn('min-w-0', !compact && 'pt-1.5')}>
        <p className="sr-only">{label}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Company contact details — address, all phone numbers, email and LINE —
 * read from the central CONTACT config. Used by the footer and /contact.
 * `compact` (EP18, footer): plain icons and tighter rows instead of tiles.
 */
export function ContactDetails({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useLocale();
  return (
    <address className={cn('not-italic', className)}>
      <ul className={cn('text-label', compact ? 'space-y-3' : 'space-y-4')}>
        <Row compact={compact} icon={MapPin} label={t.footer.address}>
          <p lang="th" className="text-text-secondary">
            {CONTACT.address}
          </p>
        </Row>
        <Row compact={compact} icon={Phone} label={t.footer.phone}>
          <p className="tabular">
            <a href={telHref()} className={linkClass}>
              {CONTACT.phone.display}
            </a>{' '}
            <span className="text-text-muted">({t.contact.phoneLabel})</span>
          </p>
        </Row>
        <Row compact={compact} icon={Mail} label={t.footer.emailLabel}>
          <a href={mailtoHref()} className={cn(linkClass, 'break-all')}>
            {CONTACT.email}
          </a>
        </Row>
        <Row compact={compact} icon={MessageCircle} label={t.footer.lineLabel}>
          <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <span className="block text-text-muted">{t.contact.lineLabel}</span>
            {CONTACT.lineId}
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
        </Row>
      </ul>
    </address>
  );
}

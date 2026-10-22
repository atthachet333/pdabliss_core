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
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-base/70">
        <Icon className="size-4 text-brand-soft" aria-hidden />
      </span>
      <div className="min-w-0 pt-1.5">
        <p className="sr-only">{label}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Company contact details — address, all phone numbers, email and LINE —
 * read from the central CONTACT config. Used by the footer and /contact.
 */
export function ContactDetails({ className }: { className?: string }) {
  const { t } = useLocale();
  return (
    <address className={cn('not-italic', className)}>
      <ul className="space-y-4 text-label">
        <Row icon={MapPin} label={t.footer.address}>
          <p lang="th" className="text-text-secondary">
            {CONTACT.address}
          </p>
        </Row>
        <Row icon={Phone} label={t.footer.phone}>
          <ul className="space-y-1">
            {CONTACT.phones.map((p) => (
              <li key={p.id} className="tabular">
                <a href={telHref(p)} className={linkClass}>
                  {p.display}
                </a>{' '}
                <span className="text-text-muted">({t.contact.phoneLabels[p.id]})</span>
              </li>
            ))}
          </ul>
        </Row>
        <Row icon={Mail} label={t.footer.emailLabel}>
          <a href={mailtoHref()} className={cn(linkClass, 'break-all')}>
            {CONTACT.email}
          </a>
        </Row>
        <Row icon={MessageCircle} label={t.footer.lineLabel}>
          <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            LINE {CONTACT.lineId}
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
        </Row>
      </ul>
    </address>
  );
}

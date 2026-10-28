import { Navigate, useSearchParams } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { OrganizationSchema } from '@/components/seo/OrganizationSchema';
import { ConsultationInvite, ContactIntro } from '@/features/contact/ContactOverview';
import { CONTACT_PAGE_COPY } from '@/features/contact/contactPageCopy';
import { CoreLocation } from '@/features/contact/Location';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /contact (EP24.1.4.3): the company contact page — "How can I reach
 * PDA BLISS and where are you?" Intro with the three direct channels, the
 * location with a large live map and directions, and the way into
 * /consultation for people who are not sure where to start. The six-step
 * consultation lives on its own route and is not loaded here.
 *
 * Older enquiry links (`/contact?interest=…&plan=…`) are forwarded to
 * /consultation with the same context, so bookmarks and external links keep
 * landing on the right step.
 */
const ENQUIRY_PARAMS = ['interest', 'topic', 'plan', 'industry', 'department'] as const;

export default function ContactPage() {
  const c = useCopy(CONTACT_PAGE_COPY);
  const { href } = useLocale();
  usePageMeta(c.meta.title, c.meta.description);
  const [params] = useSearchParams();

  const forwarded = new URLSearchParams();
  for (const key of ENQUIRY_PARAMS) {
    const value = params.get(key);
    if (value) forwarded.set(key === 'interest' ? 'topic' : key, value);
  }
  if (forwarded.size) {
    return <Navigate to={`${href('/consultation')}?${forwarded.toString()}`} replace />;
  }

  return (
    <>
      <OrganizationSchema />
      <ContactIntro />
      <Frame width="wide" className="grid gap-16 pt-14 pb-16 sm:gap-20 sm:pt-16 sm:pb-20 lg:gap-24 lg:pt-20">
        <CoreLocation />
        <ConsultationInvite />
      </Frame>
    </>
  );
}

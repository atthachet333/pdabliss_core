import { useReducer } from 'react';
import { useSearchParams } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { OrganizationSchema } from '@/components/seo/OrganizationSchema';
import { ContactFlow } from '@/features/contact/ContactFlow';
import { CONTACT_COPY } from '@/features/contact/copy';
import { parsePrefill } from '@/features/contact/model';
import { ContactHero, ContextBanner, DirectPanel } from '@/features/contact/Panels';
import { flowReducer, initialFlow } from '@/features/contact/state';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /contact (EP13): a consultation, not a support ticket. The visitor picks
 * why they want to talk, adds as much context as they like, and reviews a
 * summary. Nothing is sent by the website today — the review hands the
 * prepared message to email, LINE OA or phone (see features/contact/delivery.ts).
 * `?interest=`, `?plan=`, `?industry=` and `?department=` prefill the flow.
 */
export default function ContactPage() {
  const c = useCopy(CONTACT_COPY);
  usePageMeta(c.meta.title, c.meta.description);
  const [params] = useSearchParams();
  const [state, dispatch] = useReducer(flowReducer, params, (p) => initialFlow(parsePrefill(p)));
  return (
    <>
      <OrganizationSchema />
      <ContactHero />
      <Frame width="wide" className="pb-24 sm:pb-32">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <ContextBanner prefill={state.inquiry.source} />
            <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.85),rgb(6_13_20/0.9))] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08),0_50px_140px_-70px_rgb(0_0_0/0.9)] sm:p-8 lg:p-10">
              <ContactFlow s={state} dispatch={dispatch} />
            </div>
          </div>
          <div className="lg:sticky lg:top-24">
            <DirectPanel inquiry={state.inquiry} />
          </div>
        </div>
      </Frame>
    </>
  );
}

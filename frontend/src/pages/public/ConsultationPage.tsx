import { useReducer } from 'react';
import { useSearchParams } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { ContactFlow } from '@/features/contact/ContactFlow';
import { CONTACT_COPY } from '@/features/contact/copy';
import { parsePrefill } from '@/features/contact/model';
import {
  ConsultationFallback,
  ConsultationHero,
  ContextBanner,
  LiveSummary,
} from '@/features/contact/Panels';
import { flowReducer, initialFlow } from '@/features/contact/state';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /consultation (EP24.1.4.3): the guided conversation, moved off /contact so
 * each page does one job. "I'm not sure where to start — help me explain what
 * my organization needs." The EP13 wizard is reused unchanged: six steps
 * (topic · organization · situation · reply method · details · review), its
 * validation, focus handling and the honest hand-off to email, LINE OA or
 * phone (nothing is "sent" by the website — see features/contact/delivery.ts).
 *
 * `?topic=` (or the older `?interest=`), `?plan=`, `?industry=` and
 * `?department=` prefill the first steps; unknown values are ignored. Only
 * those reach the URL — what the visitor types stays in memory.
 */
export default function ConsultationPage() {
  const c = useCopy(CONTACT_COPY);
  usePageMeta(c.meta.title, c.meta.description);
  const [params] = useSearchParams();
  const [state, dispatch] = useReducer(flowReducer, params, (p) => initialFlow(parsePrefill(p)));
  return (
    <>
      <ConsultationHero />
      <Frame width="wide" className="pb-20 sm:pb-28">
        <div
          data-consultation
          className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-12"
        >
          <div data-conversation className="min-w-0">
            <ContextBanner prefill={state.inquiry.source} />
            <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.85),rgb(6_13_20/0.9))] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08),0_50px_140px_-70px_rgb(0_0_0/0.9)] sm:p-8 lg:p-12">
              <ContactFlow s={state} dispatch={dispatch} />
            </div>
          </div>
          <div data-consultation-side className="grid gap-8 xl:sticky xl:top-24">
            <LiveSummary inquiry={state.inquiry} />
            <ConsultationFallback />
          </div>
        </div>
      </Frame>
    </>
  );
}

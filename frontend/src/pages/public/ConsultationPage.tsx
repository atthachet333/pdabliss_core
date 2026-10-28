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
      <Frame width="wide" className="pb-20 sm:pb-24">
        {/* EP24.1.4.4: one workspace (≈ three quarters) and a light context rail
            beside it, divided by a hairline — no card around the conversation. */}
        <div
          data-consultation
          className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-0 xl:grid-cols-[minmax(0,1fr)_18rem]"
        >
          <div data-conversation className="min-w-0 lg:pr-12 xl:pr-16">
            <ContextBanner prefill={state.inquiry.source} />
            <ContactFlow s={state} dispatch={dispatch} />
          </div>
          <div
            data-consultation-side
            className="grid gap-6 lg:sticky lg:top-24 lg:border-l lg:border-white/[0.07] lg:pl-8"
          >
            <LiveSummary inquiry={state.inquiry} step={state.step} />
            <ConsultationFallback />
          </div>
        </div>
      </Frame>
    </>
  );
}

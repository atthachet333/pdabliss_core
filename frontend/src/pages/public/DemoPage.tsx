import { useEffect, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { DEMO_COPY } from '@/features/demo/copy';
import { DemoIntro, RoleSelect } from '@/features/demo/Landing';
import { initialSession, ROLES, sessionReducer, type Role } from '@/features/demo/machine';
import { DemoShell } from '@/features/demo/Shell';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /demo (EP14): a public, in-browser CORE demo. One work item (SO-1042)
 * moves through five role views on one shared state. No login, no form,
 * no persistence — refresh or "Reset" starts over. `?role=` preselects a
 * view; `?scenario=customer-order` is the only scenario.
 */
export default function DemoPage() {
  const c = useCopy(DEMO_COPY);
  usePageMeta(c.meta.title, c.meta.description);
  const [params] = useSearchParams();
  const asked = params.get('role');
  const initialRole: Role = (ROLES as readonly string[]).includes(asked ?? '') ? (asked as Role) : 'sales';
  const [s, dispatch] = useReducer(sessionReducer, initialRole, initialSession);
  const [historyOpen, setHistoryOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // Entering the workspace: bring it into view and land on the active role tab.
  useEffect(() => {
    if (!s.started) return;
    top.current?.scrollIntoView?.({ block: 'start' });
    document.querySelector<HTMLElement>('[data-role-tabs] [aria-selected="true"]')?.focus();
  }, [s.started]);

  return (
    <section aria-labelledby="demo-title" className="relative isolate">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(ellipse_55%_60%_at_75%_0%,rgb(62_224_180/0.08),transparent_70%)]"
      />
      <Frame width="full" className="pt-24 pb-24 sm:pt-28">
        <div ref={top} className="scroll-mt-20">
          {s.started ? (
            <>
              <DemoIntro compact />
              <DemoShell s={s} dispatch={dispatch} historyOpen={historyOpen} setHistoryOpen={setHistoryOpen} />
            </>
          ) : (
            <div className="grid grid-cols-1 gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-12">
              <DemoIntro compact={false} />
              <RoleSelect initial={s.role} onStart={(role) => dispatch({ kind: 'start', role })} />
            </div>
          )}
        </div>
      </Frame>
    </section>
  );
}

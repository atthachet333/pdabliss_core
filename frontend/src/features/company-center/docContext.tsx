import { ArrowRight, ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { DepartmentCode } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { DOC_COPY, type LineSummary } from './docModel';
import { useDepartmentName } from './model';
import { AreaLink, Loading } from './parts';

/*
 * EP42.3 — document context for CORE lists, shared by every department:
 *  - <LineSummaryText>: what a document holds (first item, quantity, unit, "+N more"),
 *    from the server's operational `summary` (never a price — safe for Warehouse);
 *  - <NextStep>: which department the document waits on, derived from its state with
 *    the same transitions the server enforces (presentation only, never an action);
 *  - <Preview>: a read-only, keyboard-operable row disclosure — the lines and a link to
 *    the full document, fetched on first open and kept for the list's lifetime.
 */

/** "FG-000003 Sunscreen 100 ml · 12 PCS  + 2 more" — or a dash for an empty document. */
export function LineSummaryText({ s }: { s: LineSummary | undefined }) {
  const d = useCopy(DOC_COPY);
  if (!s) return <span className="text-text-muted">—</span>;
  return (
    <span className="block min-w-0" data-line-summary>
      <span className="line-clamp-2 break-words">
        {s.code && <span className="font-mono text-caption text-text-muted">{s.code} </span>}
        {s.name}
      </span>
      <span className="text-caption text-text-secondary tabular-nums">
        {s.quantity}
        {s.unit && ` ${s.unit}`}
        {s.more > 0 && <span className="ml-2 text-text-muted">{d.more(s.more)}</span>}
      </span>
    </span>
  );
}

/** "→ Warehouse": the department this document waits on (null = nothing pending). */
export function NextStep({ dept }: { dept: DepartmentCode | null }) {
  const d = useCopy(DOC_COPY);
  const name = useDepartmentName();
  if (!dept) return null;
  return (
    <span
      className="mt-1 flex items-center gap-1 text-caption whitespace-nowrap text-text-muted"
      data-next-dept={dept}
    >
      <span className="sr-only">{d.next}: </span>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-brand-soft" />
      {name(dept)}
    </span>
  );
}

export interface PreviewLine {
  key: string;
  code: string | null;
  name: string;
  quantity: string;
  unit: string | null;
  /** A short operational note for the line (e.g. "received 4 · 2 to go"). */
  extra?: ReactNode;
}

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; lines: PreviewLine[] };

/**
 * A table row with a read-only preview: `row(toggle)` renders the row with the toggle
 * placed in its number cell; the expanded panel follows it as its own row. Nothing in
 * the panel acts on the document — the full page does.
 */
export function Previewable({
  load,
  href,
  label,
  colSpan,
  row,
}: {
  load: () => Promise<PreviewLine[]>;
  href: string;
  /** The document number (names the toggle and the panel). */
  label: string;
  colSpan: number;
  row: (toggle: ReactNode) => ReactNode;
}) {
  const { button, panel } = usePreview(load, href, label);
  return (
    <>
      {row(button)}
      {panel(colSpan)}
    </>
  );
}

function usePreview(load: () => Promise<PreviewLine[]>, href: string, label: string) {
  const d = useCopy(DOC_COPY);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state.status !== 'ready') {
      setState({ status: 'loading' });
      load().then(
        (lines) => setState({ status: 'ready', lines }),
        () => setState({ status: 'error' }),
      );
    }
  };
  const button = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={id}
      aria-label={`${open ? d.hide : d.preview} — ${label}`}
      title={open ? d.hide : d.preview}
      className="ml-1 inline-grid size-11 shrink-0 place-items-center rounded-lg align-middle text-text-muted hover:bg-white/[0.05] hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:size-8"
      data-preview-toggle
    >
      <ChevronDown
        aria-hidden
        className={cn(
          'size-4 transition-transform motion-reduce:transition-none',
          open && 'rotate-180',
        )}
      />
    </button>
  );
  const panel = (colSpan: number) =>
    open ? (
      <tr className="max-md:block" data-preview-row>
        <td colSpan={colSpan} className="block pb-4 md:table-cell md:px-4">
          <div
            id={id}
            role="region"
            aria-label={`${d.preview} — ${label}`}
            className="rounded-xl bg-white/[0.025] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
            data-preview
          >
            {state.status === 'loading' ? (
              <Loading label={d.loading} />
            ) : state.status === 'error' ? (
              <p role="alert" className="py-2 text-caption text-[#f3cf8a]">
                {d.failed}
              </p>
            ) : state.lines.length === 0 ? (
              <p className="py-2 text-caption text-text-muted">{d.none}</p>
            ) : (
              <ol
                className="grid gap-x-8 gap-y-2 py-1 text-label lg:grid-cols-2"
                data-preview-lines
              >
                {state.lines.map((l) => (
                  <li key={l.key} className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words">
                      {l.code && (
                        <span className="font-mono text-caption text-text-muted">{l.code} </span>
                      )}
                      {l.name}
                      {l.extra && (
                        <span className="block text-caption text-text-muted">{l.extra}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                      {l.quantity}
                      {l.unit && ` ${l.unit}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <AreaLink
              to={href}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-caption font-semibold text-brand-soft underline-offset-4 hover:underline md:min-h-8"
            >
              {d.open}
              <ArrowRight aria-hidden className="size-3.5" />
            </AreaLink>
          </div>
        </td>
      </tr>
    ) : null;
  return { button, panel };
}

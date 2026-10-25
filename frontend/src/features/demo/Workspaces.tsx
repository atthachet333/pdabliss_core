import {
  ArrowRight,
  Ban,
  Circle,
  CircleCheck,
  Clock,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useState, type Dispatch, type ReactNode } from 'react';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { DEMO_COPY } from './copy';
import { ROLE_ICON, useDemoFormat } from './format';
import {
  AVAILABLE,
  type ActionId,
  isTerminal,
  OWNER,
  type DemoSession,
  type Role,
  type SessionAction,
} from './machine';
import { SCENARIO } from './scenario';
import {
  accountingView,
  executiveView,
  purchasingView,
  salesView,
  warehouseView,
  type DocState,
} from './views';

/*
 * The five role workspaces (EP14). Each renders only its own view-model
 * (views.ts) — never DemoState directly — so a workspace cannot show what
 * its role does not receive.
 */

type Tone = 'ok' | 'wait' | 'alert' | 'idle';
const TONE_ICON: Record<Tone, LucideIcon> = {
  ok: CircleCheck,
  wait: Clock,
  alert: TriangleAlert,
  idle: Circle,
};
const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-success/10 text-success shadow-[inset_0_0_0_1px_rgb(52_211_153/0.3)]',
  wait: 'bg-info/10 text-info shadow-[inset_0_0_0_1px_rgb(108_184_255/0.3)]',
  alert: 'bg-warning/10 text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.4)]',
  idle: 'bg-white/[0.04] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
};

/** A status chip — always an icon and words, never colour alone. */
export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

function Card({
  title,
  children,
  className,
  data,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  data?: string;
}) {
  return (
    <section
      data-card={data}
      className={cn(
        'rounded-2xl bg-[#0b161f] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:p-5',
        className,
      )}
    >
      {title && <h4 className="mb-3 text-caption font-semibold text-text-muted">{title}</h4>}
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-caption text-text-muted">{k}</dt>
          <dd className="mt-0.5 text-label break-words text-text-primary tabular">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ordered / received / outstanding as numbers and a bar (the bar is decorative). */
function Quantities({
  ordered,
  received,
  outstanding,
  alert,
}: {
  ordered: number;
  received: number;
  outstanding: number;
  alert: boolean;
}) {
  const c = useCopy(DEMO_COPY).ws.warehouse;
  const u = useCopy(DEMO_COPY).ws.units;
  const f = useDemoFormat();
  return (
    <div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {(
          [
            [c.ordered, ordered, false],
            [c.received, received, false],
            [c.outstanding, outstanding, alert && outstanding > 0],
          ] as const
        ).map(([k, v, warn]) => (
          <div
            key={k}
            data-qty={k}
            className={cn('rounded-xl px-2 py-2.5', warn ? 'bg-warning/10' : 'bg-white/[0.03]')}
          >
            <dt className={cn('text-caption', warn ? 'text-warning' : 'text-text-muted')}>{k}</dt>
            <dd
              className={cn(
                'mt-0.5 text-[1.375rem] leading-none font-semibold tabular',
                warn ? 'text-warning' : 'text-text-primary',
              )}
            >
              {f.num(v)}
              <span className="ml-1 text-caption font-normal text-text-muted">{u}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-brand-glow transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${(received / ordered) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The task strip: the owner's actions, or where the work is            */
/* ------------------------------------------------------------------ */

function TaskStrip({ s, dispatch }: { s: DemoSession; dispatch: Dispatch<SessionAction> }) {
  const c = useCopy(DEMO_COPY);
  const owner = OWNER[s.state.status];
  const actions = AVAILABLE[s.state.status].filter(
    (a): a is Exclude<ActionId, 'recordLot'> => a !== 'recordLot',
  );
  if (isTerminal(s.state.status)) return null;
  if (s.role === 'executive') {
    return (
      <p data-task="observer" className="text-label text-text-secondary">
        {c.observer}
      </p>
    );
  }
  if (s.role !== owner) {
    return (
      <div
        data-task="elsewhere"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-label text-text-secondary">
          {c.noAction} · {c.elsewhere(c.roles[owner].name)}
        </p>
        <button
          type="button"
          onClick={() => dispatch({ kind: 'role', role: owner })}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 text-label text-text-primary hover:bg-white/[0.1]"
        >
          {c.switchTo(c.roles[owner].name)}
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div data-task="mine" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {actions.map((a, i) => (
        <button
          key={a}
          type="button"
          data-action={a}
          onClick={() => dispatch({ kind: 'act', action: { id: a } })}
          className={cn(
            'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-label font-semibold transition-colors',
            i === 0
              ? 'bg-brand-primary text-text-inverse hover:bg-brand-glow'
              : 'bg-white/[0.06] text-text-primary hover:bg-white/[0.1]',
          )}
        >
          {c.actions[a]}
          <ArrowRight aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  );
}

function Workspace({
  role,
  s,
  dispatch,
  children,
}: {
  role: Role;
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
  children: ReactNode;
}) {
  const c = useCopy(DEMO_COPY);
  const Icon = ROLE_ICON[role];
  const title = c.ws[role].title;
  return (
    <div data-workspace={role}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-h3 text-text-primary">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.05]">
            <Icon aria-hidden className="size-4" style={{ color: `var(--color-ws-${role})` }} />
          </span>
          {title}
        </h3>
        <span className="flex items-center gap-2 text-caption text-text-muted tabular">
          <DeptDot id={role} />
          {SCENARIO.order.id}
        </span>
      </div>
      <div className="mt-4 rounded-2xl bg-white/[0.025] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)]">
        <TaskStrip s={s} dispatch={dispatch} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sales                                                                */
/* ------------------------------------------------------------------ */

function SalesWorkspace({ s, dispatch }: { s: DemoSession; dispatch: Dispatch<SessionAction> }) {
  const c = useCopy(DEMO_COPY).ws;
  const f = useDemoFormat();
  const v = salesView(s.state);
  const tone: Tone =
    v.fulfilment === 'ready' || v.fulfilment === 'delivered'
      ? 'ok'
      : v.fulfilment === 'notChecked'
        ? 'idle'
        : v.fulfilment === 'waitingPartial'
          ? 'alert'
          : 'wait';
  return (
    <Workspace role="sales" s={s} dispatch={dispatch}>
      <Card title={c.sales.fulfilment} data="fulfilment">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Pill tone={tone}>{c.sales.fulfilments[v.fulfilment]}</Pill>
          {v.delivery && (
            <span className="text-caption text-text-secondary tabular">
              {c.sales.delivery} {v.delivery}
            </span>
          )}
        </div>
        <Facts
          rows={[
            [
              c.sales.available,
              v.available === null
                ? c.sales.notChecked
                : `${f.num(v.available)} / ${f.num(v.order.qty)} ${c.units}`,
            ],
            [c.sales.shortage, `${f.num(v.shortage)} ${c.units}`],
          ]}
        />
      </Card>
      <Card title={c.sales.order} data="order">
        <Facts
          rows={[
            [c.sales.order, v.order.id],
            [c.sales.customer, c.sales.customerName],
            [c.sales.customerPo, v.order.customerPo],
            [c.sales.item, `${c.sales.itemName} · ${SCENARIO.item.sku}`],
            [c.sales.qty, `${f.num(v.order.qty)} ${c.units}`],
            [c.sales.value, f.money(v.order.value, v.order.currency)],
            [c.sales.requestedBy, f.date(v.order.requestedBy)],
          ]}
        />
      </Card>
    </Workspace>
  );
}

/* ------------------------------------------------------------------ */
/* Warehouse — quantities, places, lots and dates only                  */
/* ------------------------------------------------------------------ */

function LotForm({ s, dispatch }: { s: DemoSession; dispatch: Dispatch<SessionAction> }) {
  const c = useCopy(DEMO_COPY);
  const f = useDemoFormat();
  const [pick, setPick] = useState(0);
  const lot = s.state.lot;
  const blocked = !lot && s.last && !s.last.ok && s.last.reason === 'lotRequired';
  return (
    <Card
      title={c.ws.warehouse.lotForm}
      data="lot-form"
      className={cn(blocked && 'shadow-[inset_0_0_0_1px_rgb(245_184_75/0.55)]')}
    >
      {blocked && (
        <div
          role="alert"
          data-prevented
          className="mb-4 flex gap-3 rounded-xl bg-warning/10 px-4 py-3"
        >
          <Ban aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="text-caption font-semibold tracking-[0.2em] text-warning">
              {c.prevent.principle}
            </p>
            <p className="text-label font-semibold text-text-primary">{c.prevent.title}</p>
            <p className="text-label text-text-secondary">{c.prevent.body}</p>
          </div>
        </div>
      )}
      {lot ? (
        <p
          data-lot-recorded
          className="flex flex-wrap items-center gap-2 text-label text-text-primary"
        >
          <Pill tone="ok">{c.ws.warehouse.lotRecorded}</Pill>
          <span className="tabular">
            {lot.code} · {c.ws.warehouse.expiry} {f.date(lot.expiry)}
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="text-caption text-text-muted">{c.ws.warehouse.lotSelect}</span>
            <select
              data-lot-select
              value={pick}
              onChange={(e) => setPick(Number(e.target.value))}
              className="mt-1 block h-11 w-full rounded-xl border border-border-strong bg-surface-raised px-3 text-label text-text-primary"
            >
              {SCENARIO.lotOptions.map((l, i) => (
                <option key={l.code} value={i}>
                  {l.code} · {f.date(l.expiry)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-action="recordLot"
            onClick={() =>
              dispatch({
                kind: 'act',
                action: { id: 'recordLot', lot: SCENARIO.lotOptions[pick]! },
              })
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-5 text-label font-semibold text-text-primary hover:bg-white/[0.12]"
          >
            {c.actions.recordLot}
          </button>
        </div>
      )}
    </Card>
  );
}

function WarehouseWorkspace({
  s,
  dispatch,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
}) {
  const c = useCopy(DEMO_COPY);
  const w = c.ws.warehouse;
  const f = useDemoFormat();
  const v = warehouseView(s.state);
  const mine = s.role === 'warehouse' && OWNER[s.state.status] === 'warehouse';
  return (
    <Workspace role="warehouse" s={s} dispatch={dispatch}>
      {/* The lot form sits right under the task, so a PREVENT message is next to the action. */}
      {v.task === 'closeReceipt' && mine && <LotForm s={s} dispatch={dispatch} />}
      <Card data="task">
        <p className="text-caption text-text-muted">{w.task}</p>
        <p className="mt-1 text-label font-semibold text-text-primary">{w.tasks[v.task]}</p>
        <Facts
          rows={[
            [w.sku, v.sku],
            [w.location, v.location],
          ]}
        />
      </Card>
      {v.receipt && (
        <Card title={w.receipt} data="receipt">
          {s.state.status === 'PARTIAL_RECEIPT' && (
            <p data-detect className="mb-3 flex items-center gap-2 text-label text-warning">
              <TriangleAlert aria-hidden className="size-4" />
              <span className="text-caption font-semibold tracking-[0.2em]">
                {c.detect.principle}
              </span>
              {c.detect.body(v.receipt.outstanding)}
            </p>
          )}
          <Quantities
            ordered={v.receipt.ordered}
            received={v.receipt.received}
            outstanding={v.receipt.outstanding}
            alert
          />
          <Facts
            rows={[
              ['PO', v.receipt.po],
              [w.expected, f.date(v.receipt.expected)],
              ...(v.receipt.receiptId
                ? [[w.receiptId, v.receipt.receiptId] as [string, string]]
                : []),
            ]}
          />
        </Card>
      )}
      <Card title={w.lots} data="lots">
        <ul className="divide-y divide-border-soft">
          {v.lots.map((l) => (
            <li
              key={l.code}
              data-lot={l.code}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="text-label text-text-primary tabular">
                {l.code}
                <span className="ml-2 text-caption text-text-muted">
                  {w.expiry} {f.date(l.expiry)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-label text-text-secondary tabular">
                  {f.num(l.qty)} {c.ws.units}
                </span>
                {l.fefo && <Pill tone={l.fefo === 1 ? 'ok' : 'idle'}>{w.fefo(l.fefo)}</Pill>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {v.pick && (
        <Card title={w.pick} data="pick">
          <p className="mb-3 flex items-start gap-2 text-caption text-text-secondary">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-soft" />
            {w.fefoNote}
          </p>
          <ol className="space-y-2">
            {v.pick.plan.map((p, i) => (
              <li
                key={p.code}
                data-pick={p.code}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
              >
                <span className="text-label text-text-primary tabular">
                  {i + 1}. {p.code}
                  {i === 0 && (
                    <span className="ml-2 text-caption text-brand-soft">{w.fefoSuggest}</span>
                  )}
                </span>
                <span className="text-label text-text-secondary tabular">
                  {f.num(p.qty)} {c.ws.units}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-caption text-text-muted tabular">
            {w.needed} {f.num(v.pick.needed)} {c.ws.units}
          </p>
        </Card>
      )}
      <p data-no-finance className="flex items-start gap-2 text-caption text-text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {w.noFinance}
      </p>
    </Workspace>
  );
}

/* ------------------------------------------------------------------ */
/* Purchasing                                                           */
/* ------------------------------------------------------------------ */

function PurchasingWorkspace({
  s,
  dispatch,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
}) {
  const c = useCopy(DEMO_COPY);
  const p = c.ws.purchasing;
  const f = useDemoFormat();
  const v = purchasingView(s.state);
  return (
    <Workspace role="purchasing" s={s} dispatch={dispatch}>
      <Card title={p.requirement} data="requirement">
        {v.requirement > 0 ? (
          <p className="text-[1.5rem] leading-none font-semibold text-text-primary tabular">
            {f.num(v.requirement)}
            <span className="ml-1 text-caption font-normal text-text-muted">{c.ws.units}</span>
            <span className="ml-3 text-caption font-normal text-text-secondary">{v.orderId}</span>
          </p>
        ) : (
          <p className="text-label text-text-secondary">{p.noRequirement}</p>
        )}
      </Card>
      {v.po && (
        <Card title={p.po} data="po">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill
              tone={
                v.po.status === 'partial' ? 'alert' : v.po.status === 'complete' ? 'ok' : 'wait'
              }
            >
              {p.statuses[v.po.status]}
            </Pill>
            {v.po.status === 'partial' && (
              <span
                data-detect
                className="text-caption font-semibold tracking-[0.2em] text-warning"
              >
                {c.detect.principle}
              </span>
            )}
          </div>
          <Quantities
            ordered={v.po.qty}
            received={v.po.received}
            outstanding={v.po.outstanding}
            alert={v.po.status === 'partial'}
          />
          <Facts
            rows={[
              [p.po, v.po.id],
              [p.supplier, p.supplierName],
              [p.value, f.money(v.po.value, v.po.currency)],
              [p.expected, f.date(v.po.expected)],
            ]}
          />
        </Card>
      )}
    </Workspace>
  );
}

/* ------------------------------------------------------------------ */
/* Accounting — operational finance only                                */
/* ------------------------------------------------------------------ */

const DOC_TONE: Record<DocState, Tone> = { missing: 'idle', waiting: 'alert', ready: 'ok' };

function AccountingWorkspace({
  s,
  dispatch,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
}) {
  const c = useCopy(DEMO_COPY);
  const a = c.ws.accounting;
  const f = useDemoFormat();
  const v = accountingView(s.state);
  return (
    <Workspace role="accounting" s={s} dispatch={dispatch}>
      <p data-scope className="text-caption text-text-muted">
        {a.scope}
      </p>
      <Card title={a.documents} data="documents">
        <ul className="divide-y divide-border-soft">
          {v.documents.map((d) => (
            <li
              key={d.id}
              data-doc={d.id}
              data-state={d.state}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="text-label text-text-primary">
                {a.docs[d.id]}
                {d.ref && (
                  <span className="ml-2 text-caption text-text-muted tabular">{d.ref}</span>
                )}
              </span>
              <Pill tone={DOC_TONE[d.state]}>{a.docStates[d.state]}</Pill>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={a.readiness} data="readiness">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Pill
            tone={v.readiness === 'ready' ? 'ok' : v.readiness === 'waiting' ? 'alert' : 'idle'}
          >
            {a.readinessStates[v.readiness]}
          </Pill>
          {v.invoice && (
            <span className="text-label text-text-secondary tabular">
              {a.invoiceAmount}: {f.money(v.invoice.amount, v.invoice.currency)}
            </span>
          )}
        </div>
      </Card>
    </Workspace>
  );
}

/* ------------------------------------------------------------------ */
/* Executive — exceptions and flow, never transactions                  */
/* ------------------------------------------------------------------ */

function ExecutiveWorkspace({
  s,
  dispatch,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
}) {
  const c = useCopy(DEMO_COPY);
  const e = c.ws.executive;
  const f = useDemoFormat();
  const v = executiveView(s.state);
  return (
    <Workspace role="executive" s={s} dispatch={dispatch}>
      <p className="text-label text-brand-soft">{e.principle}</p>
      <div className="grid grid-cols-2 gap-3">
        <Card data="open-count">
          <p className="text-caption text-text-muted">{e.open}</p>
          <p
            className={cn(
              'mt-1 text-[2rem] leading-none font-semibold tabular',
              v.open ? 'text-warning' : 'text-text-primary',
            )}
          >
            {v.open}
          </p>
        </Card>
        <Card data="resolved-count">
          <p className="text-caption text-text-muted">{e.resolved}</p>
          <p className="mt-1 text-[2rem] leading-none font-semibold text-text-primary tabular">
            {v.resolved}
          </p>
        </Card>
      </div>
      {v.exception?.status === 'open' ? (
        <Card data="exception" className="shadow-[inset_0_0_0_1px_rgb(245_184_75/0.5)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone="alert">{e.resolutions.open}</Pill>
            <span className="text-caption font-semibold tracking-[0.2em] text-warning">
              {c.detect.principle}
            </span>
          </div>
          <Facts
            rows={[
              [e.affected, v.exception.orderId],
              [e.responsible, c.roles[v.exception.responsible].name],
              [e.bottleneck, c.roles[v.exception.currentOwner].name],
              [e.outstanding, `${f.num(v.exception.outstanding)} ${c.ws.units}`],
              [e.impact, e.impactValue],
              [e.resolution, e.resolutions.open],
            ]}
          />
        </Card>
      ) : (
        <Card data="no-exception">
          <p className="flex items-center gap-2 text-label text-text-secondary">
            <CircleCheck aria-hidden className="size-4 text-success" />
            {v.exception?.status === 'resolved' ? e.cleared : e.none}
          </p>
        </Card>
      )}
      <Card data="flow">
        <p className="text-caption text-text-muted">{e.flow}</p>
        <p className="mt-1 text-label text-text-primary">
          {c.roles[v.flow.owner].name} · {c.stages[v.flow.stage]}
        </p>
        <p className="mt-2 text-caption text-text-muted">{e.notShown}</p>
      </Card>
    </Workspace>
  );
}

export function RoleWorkspace({
  s,
  dispatch,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
}) {
  switch (s.role) {
    case 'sales':
      return <SalesWorkspace s={s} dispatch={dispatch} />;
    case 'warehouse':
      return <WarehouseWorkspace s={s} dispatch={dispatch} />;
    case 'purchasing':
      return <PurchasingWorkspace s={s} dispatch={dispatch} />;
    case 'accounting':
      return <AccountingWorkspace s={s} dispatch={dispatch} />;
    case 'executive':
      return <ExecutiveWorkspace s={s} dispatch={dispatch} />;
  }
}

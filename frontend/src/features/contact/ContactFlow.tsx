import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ClipboardCopy,
  Info,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { Field } from '@/components/ui/Field';
import { controlClass } from '@/components/ui/fieldStyles';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { controlArrow, coreControl, metaText } from './coreControls';
import { CONTACT_COPY } from './copy';
import { getInquiryDelivery } from './delivery';
import {
  CONTACT_METHODS,
  DEPARTMENT_OPTIONS,
  INDUSTRY_OPTIONS,
  INQUIRY_GROUPS,
  MESSAGE_MAX,
  PROBLEMS,
  SIZES,
  STEPS,
  type ContactFields,
  type ContactMethod,
  type InquiryType,
} from './model';
import type { FlowAction, FlowState } from './state';
import { Summary } from './Summary';
import { summaryRows, summaryText, useDeptName } from './summaryText';
import { validateDetails } from './validation';

/*
 * The guided consultation (EP13): six short steps — topic, organization,
 * situation, reply method, contact details, review. One question at a time;
 * only the topic, name, company and one matching contact are required.
 * The final action prepares the message; it is never "sent" by the website
 * unless a real delivery exists (see delivery.ts).
 */

const METHOD_ICON: Record<ContactMethod, LucideIcon> = {
  line: MessageCircle,
  phone: Phone,
  email: Mail,
};

/**
 * Short codes for the topics (EP24.1.4.4): the same technical tag in every
 * language, shown above the label like the department codes on the homepage.
 * Decorative — the label carries the meaning.
 */
const TYPE_CODE: Record<InquiryType, string> = {
  demo: 'DEMO',
  general: 'GENERAL',
  consulting: 'CONSULTING',
  implementation: 'IMPLEMENTATION',
  integration: 'INTEGRATION',
  plans: 'PACKAGES',
  enterprise: 'ENTERPRISE',
};

/**
 * A selectable path (row) or chip backed by a native input (radio / checkbox).
 * EP24.1.4.4: precise 10 px / 8 px corners, a hairline edge, a teal edge and a
 * soft fill when chosen; the indicator sits at the end of a row.
 */
function Choice({
  type,
  name,
  checked,
  onChange,
  children,
  hint,
  code,
  chip = false,
  data,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  hint?: string;
  code?: string;
  chip?: boolean;
  data?: string;
}) {
  const indicator = (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center border transition-colors',
        type === 'radio' ? 'rounded-full' : 'rounded-[4px]',
        checked
          ? type === 'radio'
            ? 'border-brand-glow'
            : 'border-brand-glow bg-brand-glow text-text-inverse'
          : 'border-white/25',
      )}
    >
      {checked &&
        (type === 'radio' ? (
          <span className="size-2 rounded-full bg-brand-glow" />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        ))}
    </span>
  );
  return (
    <label
      className={cn('relative block cursor-pointer', chip && 'inline-block')}
      data-choice={data}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex min-h-11 transition-[background-color,box-shadow,color] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus motion-reduce:transition-none',
          chip
            ? 'items-center gap-2.5 rounded-[8px] px-3.5 py-2 text-label'
            : 'h-full items-start gap-4 rounded-[10px] px-4 py-3.5',
          checked
            ? 'bg-[linear-gradient(90deg,rgb(62_240_192/0.11),rgb(62_240_192/0.03))] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5),inset_2px_0_0_rgb(62_240_192/0.9)]'
            : 'text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgb(190_235_222/0.22)]',
        )}
      >
        {chip && indicator}
        <span className="min-w-0 flex-1">
          {code && (
            <span
              aria-hidden
              lang="en"
              className={cn(
                metaText,
                'mb-2 block text-[0.625rem]',
                checked ? 'text-brand-soft' : 'text-text-muted',
              )}
            >
              {code}
            </span>
          )}
          <span className={cn('block', !chip && 'text-label font-semibold text-text-primary')}>
            {children}
          </span>
          {hint && (
            <span className="mt-1 block text-caption leading-relaxed text-text-secondary">
              {hint}
            </span>
          )}
        </span>
        {!chip && <span className="pt-0.5">{indicator}</span>}
      </span>
    </label>
  );
}

function Group({
  legend,
  hint,
  children,
  className,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="w-full">
        <span className="flex items-center gap-3">
          <span className={cn(metaText, 'text-text-muted')}>{legend}</span>
          <span aria-hidden className="h-px flex-1 bg-white/[0.06]" />
        </span>
      </legend>
      {hint && <p className="mt-1 text-caption text-text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Steps                                                                */
/* ------------------------------------------------------------------ */

function TopicStep({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  return (
    <div className="grid grid-cols-1 gap-6">
      {INQUIRY_GROUPS.map((g) => (
        <Group key={g.id} legend={c.groups[g.id]}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.types.map((t) => (
              <Choice
                key={t}
                type="radio"
                name="inquiry-type"
                data={t}
                checked={s.inquiry.type === t}
                onChange={() => dispatch({ kind: 'type', value: t })}
                hint={c.types[t].hint}
                code={TYPE_CODE[t]}
              >
                {c.types[t].label}
              </Choice>
            ))}
          </div>
        </Group>
      ))}
      {s.topicError && (
        <p
          role="alert"
          data-topic-error
          className="flex items-center gap-1.5 text-caption text-danger"
        >
          <CircleAlert aria-hidden className="size-3.5" />
          {c.topicRequired}
        </p>
      )}
    </div>
  );
}

function OrganizationStep({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  const deptName = useDeptName();
  const q = s.inquiry;
  return (
    <div className="grid grid-cols-1 gap-8">
      <Group legend={c.industryLabel}>
        <div className="flex flex-wrap gap-2">
          <Choice
            chip
            type="radio"
            name="industry"
            data="none"
            checked={!q.industry}
            onChange={() => dispatch({ kind: 'industry', value: undefined })}
          >
            {c.notSure}
          </Choice>
          {INDUSTRY_OPTIONS.map((i) => (
            <Choice
              chip
              key={i}
              type="radio"
              name="industry"
              data={i}
              checked={q.industry === i}
              onChange={() => dispatch({ kind: 'industry', value: i })}
            >
              {c.industries[i]}
            </Choice>
          ))}
        </div>
      </Group>
      <Group legend={c.sizeLabel}>
        <div className="flex flex-wrap gap-2">
          <Choice
            chip
            type="radio"
            name="size"
            data="none"
            checked={!q.size}
            onChange={() => dispatch({ kind: 'size', value: undefined })}
          >
            {c.notSure}
          </Choice>
          {SIZES.map((z) => (
            <Choice
              chip
              key={z}
              type="radio"
              name="size"
              data={z}
              checked={q.size === z}
              onChange={() => dispatch({ kind: 'size', value: z })}
            >
              {c.sizes[z]}
            </Choice>
          ))}
        </div>
      </Group>
      <Group legend={c.departmentsLabel}>
        <div className="flex flex-wrap gap-2">
          {DEPARTMENT_OPTIONS.map((d) => (
            <Choice
              chip
              key={d}
              type="checkbox"
              name="departments"
              data={d}
              checked={q.departments.includes(d)}
              onChange={() => dispatch({ kind: 'department', value: d })}
            >
              <span className="inline-flex items-center gap-2">
                <DeptDot id={d} />
                {deptName(d)}
              </span>
            </Choice>
          ))}
        </div>
      </Group>
    </div>
  );
}

function SituationStep({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  const q = s.inquiry;
  return (
    <div className="grid grid-cols-1 gap-8">
      <Group legend={c.problemsLabel}>
        <div className="flex flex-wrap gap-2">
          {PROBLEMS.map((p) => (
            <Choice
              chip
              key={p}
              type="checkbox"
              name="problems"
              data={p}
              checked={q.problems.includes(p)}
              onChange={() => dispatch({ kind: 'problem', value: p })}
            >
              {c.problems[p]}
            </Choice>
          ))}
        </div>
      </Group>
      <Field id="inquiry-message" label={`${c.messageLabel} (${c.optional})`} hint={c.messageHint}>
        <textarea
          id="inquiry-message"
          rows={4}
          maxLength={MESSAGE_MAX}
          value={q.message}
          aria-describedby="inquiry-message-hint"
          onChange={(e) => dispatch({ kind: 'message', value: e.target.value })}
          className={controlClass(false, true)}
        />
      </Field>
    </div>
  );
}

function MethodStep({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  return (
    <Group legend={c.steps.method}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {CONTACT_METHODS.map((m) => {
          const Icon = METHOD_ICON[m];
          return (
            <Choice
              key={m}
              type="radio"
              name="method"
              data={m}
              checked={s.inquiry.method === m}
              onChange={() => dispatch({ kind: 'method', value: m })}
              hint={c.methods[m].hint}
            >
              <span className="inline-flex items-center gap-2">
                <Icon aria-hidden className="size-4 text-brand-soft" />
                {c.methods[m].label}
              </span>
            </Choice>
          );
        })}
      </div>
    </Group>
  );
}

const FIELD_ORDER: (keyof ContactFields)[] = ['name', 'company', 'phone', 'email', 'lineId'];
const AUTOCOMPLETE: Record<keyof ContactFields, string> = {
  name: 'name',
  company: 'organization',
  phone: 'tel',
  email: 'email',
  lineId: 'off',
};
const INPUT_TYPE: Record<keyof ContactFields, string> = {
  name: 'text',
  company: 'text',
  phone: 'tel',
  email: 'email',
  lineId: 'text',
};

function DetailsStep({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  const errors = s.showErrors ? validateDetails(s.inquiry.contact, s.inquiry.method) : {};
  const count = Object.keys(errors).length;
  const summaryRef = useRef<HTMLDivElement>(null);
  // Move focus to the first invalid field when errors appear.
  useEffect(() => {
    if (!s.showErrors) return;
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (first) document.getElementById(`inquiry-${first}`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.showErrors]);
  const required = (f: keyof ContactFields) => f === 'name' || f === 'company';
  return (
    <div>
      {count > 0 && (
        <div
          ref={summaryRef}
          role="alert"
          data-error-summary
          className="mb-6 flex items-center gap-2 rounded-[8px] bg-danger/10 px-4 py-3 text-label text-danger shadow-[inset_2px_0_0_rgb(255_107_107/0.7)]"
        >
          <CircleAlert aria-hidden className="size-4" />
          {c.errorSummary(count)}
        </div>
      )}
      <p id="reach-hint" className="mb-5 text-caption text-text-muted">
        {c.reachHint}
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {FIELD_ORDER.map((f) => {
          const err = errors[f];
          const id = `inquiry-${f}`;
          return (
            <div key={f} className={cn(f === 'lineId' && 'sm:col-span-2')}>
              <Field
                id={id}
                label={required(f) ? c.fields[f] : `${c.fields[f]} (${c.optional})`}
                error={err ? c.errors[err] : undefined}
              >
                <input
                  id={id}
                  name={f}
                  type={INPUT_TYPE[f]}
                  autoComplete={AUTOCOMPLETE[f]}
                  required={required(f)}
                  value={s.inquiry.contact[f]}
                  aria-invalid={!!err}
                  aria-describedby={
                    err ? `${id}-error` : f === 'name' || f === 'company' ? undefined : 'reach-hint'
                  }
                  onChange={(e) => dispatch({ kind: 'field', name: f, value: e.target.value })}
                  className={controlClass(!!err)}
                />
              </Field>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  const { t } = useLocale();
  const deptName = useDeptName();
  const reduce = usePrefersReducedMotion();
  const [copied, setCopied] = useState(false);
  const delivery = getInquiryDelivery();
  const rows = summaryRows(s.inquiry, c, deptName);
  const text = summaryText(rows, c.summary.title);
  const topic = s.inquiry.type ? c.types[s.inquiry.type].label : c.summary.title;
  const mail = `${mailtoHref()}?subject=${encodeURIComponent(c.prepared.subject(topic))}&body=${encodeURIComponent(text)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (s.prepared) {
    // Delivery is unavailable today: say so plainly and hand over the channels.
    return (
      <motion.div
        role="status"
        data-prepared
        data-delivery={delivery.available ? 'available' : 'unavailable'}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_CORE }}
      >
        <p className="flex items-center gap-2 text-h3 text-text-primary">
          <Info aria-hidden className="size-5 text-warning" />
          {c.prepared.title}
        </p>
        <p className="mt-3 max-w-xl text-label text-text-secondary">{c.prepared.body}</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a href={mail} data-handoff="email" className={coreControl('primary', 'min-h-12')}>
            <Mail aria-hidden className="size-4" />
            {c.prepared.email}
          </a>
          <a
            href={CONTACT.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-handoff="line"
            className={coreControl('line', 'min-h-12')}
          >
            <MessageCircle aria-hidden className="size-4" />
            {c.prepared.line} {CONTACT.lineId}
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
          <button
            type="button"
            onClick={copy}
            data-handoff="copy"
            className={coreControl('line', 'min-h-12')}
          >
            <ClipboardCopy aria-hidden className="size-4" />
            {c.prepared.copy}
          </button>
          <a href={telHref()} data-handoff="phone" className={coreControl('line', 'min-h-12')}>
            <Phone aria-hidden className="size-4" />
            {c.prepared.call} {CONTACT.phone.display}
          </a>
        </div>
        <p aria-live="polite" className="mt-3 min-h-5 text-caption text-brand-soft">
          {copied ? c.prepared.copied : ''}
        </p>
        <button
          type="button"
          onClick={() => dispatch({ kind: 'edit' })}
          className={coreControl('quiet', 'mt-4 -ml-3')}
        >
          <ArrowLeft aria-hidden className="size-4" />
          {c.prepared.back}
        </button>
      </motion.div>
    );
  }

  return (
    <div>
      <Summary inquiry={s.inquiry} />
      <p
        data-delivery-notice
        className="mt-6 flex items-start gap-2.5 rounded-[8px] bg-warning/[0.06] px-4 py-3 text-label text-text-secondary shadow-[inset_0_0_0_1px_rgb(245_184_75/0.18)]"
      >
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        {c.review.notice}
      </p>
      <p className="mt-3 flex items-start gap-2.5 text-caption text-text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {c.review.privacy}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flow                                                                 */
/* ------------------------------------------------------------------ */

const BODY = {
  topic: TopicStep,
  organization: OrganizationStep,
  situation: SituationStep,
  method: MethodStep,
  details: DetailsStep,
  review: ReviewStep,
} as const;

export function ContactFlow({ s, dispatch }: { s: FlowState; dispatch: Dispatch<FlowAction> }) {
  const c = useCopy(CONTACT_COPY);
  const reduce = usePrefersReducedMotion();
  const step = STEPS[s.step]!;
  const Body = BODY[step];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // After the visitor moves between steps, focus the new question.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [s.step]);
  const optional = step === 'organization' || step === 'situation';
  const last = step === 'review';

  return (
    <section aria-labelledby="consult-question" data-flow data-step={step} className="@container">
      {/* EP24.1.4.4: a numbered technical rail. Numbers come from a CSS counter,
          so each step's accessible name stays its plain label. Labels appear only
          where all six fit (container query, wrapping rather than truncating);
          narrower, the numbers plus the current step name below. Active: strong
          teal; done: muted teal; ahead: graphite. */}
      <nav aria-label={c.stepsLabel}>
        <ol className="grid grid-cols-6 border-b border-white/[0.08] [counter-reset:step]">
          {STEPS.map((st, i) => {
            const current = i === s.step;
            const open = i <= s.reached;
            return (
              <li key={st} className="relative min-w-0 [counter-increment:step]">
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 -bottom-px transition-colors',
                    current
                      ? 'h-[2px] bg-brand-glow shadow-[0_0_14px_rgb(62_240_192/0.45)]'
                      : open
                        ? 'h-px bg-brand-primary/45'
                        : 'h-px bg-transparent',
                  )}
                />
                <button
                  type="button"
                  disabled={!open}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => dispatch({ kind: 'go', step: i })}
                  className={cn(
                    'group flex min-h-11 w-full flex-col items-start gap-1.5 pt-1 pr-3 pb-3 text-left before:font-mono before:text-[0.6875rem] before:tracking-[0.14em] before:content-[counter(step,decimal-leading-zero)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-default',
                    current
                      ? 'before:text-brand-glow'
                      : open
                        ? 'before:text-brand-soft/70'
                        : 'before:text-text-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'sr-only text-caption leading-snug break-words transition-colors @2xl:not-sr-only @2xl:block',
                      current
                        ? 'font-semibold text-text-primary'
                        : open
                          ? 'text-text-secondary group-hover:text-text-primary'
                          : 'text-text-muted',
                    )}
                  >
                    {c.steps[st]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <motion.div
        key={step}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_CORE }}
        className="mt-8 lg:mt-10"
      >
        <p className="flex items-center gap-2.5 text-caption text-text-muted tabular">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-glow" />
          <span>
            {c.stepOf(s.step + 1, STEPS.length)}
            {/* The step name, where the progress rail shows no labels. */}
            <span data-step-name className="@2xl:hidden">
              {' · '}
              {c.steps[step]}
            </span>
          </span>
        </p>
        <h2
          id="consult-question"
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-[clamp(1.375rem,1.15rem+0.8vw,1.875rem)] leading-[1.3] font-semibold tracking-[-0.01em] text-text-primary outline-none"
        >
          {c.questions[step]}
        </h2>
        {optional && <p className="mt-2 text-caption text-text-muted">{c.hints[step]}</p>}
        <div className="mt-7">
          <Body s={s} dispatch={dispatch} />
        </div>
      </motion.div>

      {!(last && s.prepared) && (
        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          {s.step > 0 ? (
            <button
              type="button"
              onClick={() => dispatch({ kind: 'back' })}
              className={coreControl('quiet', 'sm:-ml-3')}
            >
              <ArrowLeft aria-hidden className="size-4" />
              {c.nav.back}
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {optional && (
              <button
                type="button"
                onClick={() => dispatch({ kind: 'next' })}
                data-skip
                className={coreControl('quiet')}
              >
                {c.nav.skip}
              </button>
            )}
            {last ? (
              <button
                type="button"
                data-prepare
                onClick={() => dispatch({ kind: 'prepare' })}
                className={coreControl('primary', 'min-h-12 px-6')}
              >
                {c.review.prepare}
                <ArrowRight aria-hidden className={controlArrow} />
              </button>
            ) : (
              <button
                type="button"
                data-next
                onClick={() => dispatch({ kind: 'next' })}
                className={coreControl('primary', 'min-h-12 px-6')}
              >
                {c.nav.next}
                <ArrowRight aria-hidden className={controlArrow} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

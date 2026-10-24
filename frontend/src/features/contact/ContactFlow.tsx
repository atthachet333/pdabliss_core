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
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Field } from '@/components/ui/Field';
import { controlClass } from '@/components/ui/fieldStyles';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
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

/** A selectable row or chip backed by a native input (radio / checkbox). */
function Choice({
  type,
  name,
  checked,
  onChange,
  children,
  hint,
  chip = false,
  data,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  hint?: string;
  chip?: boolean;
  data?: string;
}) {
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
          'flex min-h-11 items-center gap-3 transition-[background-color,box-shadow] peer-focus-visible:ring-2 peer-focus-visible:ring-brand-glow',
          chip ? 'rounded-full px-4 py-2 text-label' : 'rounded-2xl px-4 py-3',
          checked
            ? 'bg-brand-primary/12 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.55)]'
            : 'bg-white/[0.035] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:bg-white/[0.06]',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-4 shrink-0 items-center justify-center border',
            type === 'radio' ? 'rounded-full' : 'rounded',
            checked ? 'border-brand-glow bg-brand-glow text-text-inverse' : 'border-border-strong',
          )}
        >
          {checked && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={cn('block', !chip && 'text-label font-semibold text-text-primary')}>
            {children}
          </span>
          {hint && <span className="mt-0.5 block text-caption text-text-secondary">{hint}</span>}
        </span>
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
      <legend className="text-caption font-semibold text-text-muted">{legend}</legend>
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
          className="mb-6 flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-label text-danger"
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
          <a
            href={mail}
            data-handoff="email"
            className={buttonClasses('primary', 'lg', 'whitespace-normal')}
          >
            <Mail aria-hidden className="size-4" />
            {c.prepared.email}
          </a>
          <a
            href={CONTACT.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-handoff="line"
            className={buttonClasses('secondary', 'lg', 'whitespace-normal')}
          >
            <MessageCircle aria-hidden className="size-4" />
            {c.prepared.line} {CONTACT.lineId}
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
          <button
            type="button"
            onClick={copy}
            data-handoff="copy"
            className={buttonClasses('secondary', 'lg', 'whitespace-normal')}
          >
            <ClipboardCopy aria-hidden className="size-4" />
            {c.prepared.copy}
          </button>
          <a
            href={telHref()}
            data-handoff="phone"
            className={buttonClasses('secondary', 'lg', 'whitespace-normal')}
          >
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
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary underline-offset-4 hover:underline"
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
        className="mt-6 flex items-start gap-2.5 rounded-2xl bg-warning/[0.07] px-4 py-3 text-label text-text-secondary shadow-[inset_0_0_0_1px_rgb(245_184_75/0.2)]"
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
    <section aria-labelledby="consult-question" data-flow data-step={step}>
      <nav aria-label={c.stepsLabel}>
        <ol className="flex gap-1.5 overflow-x-auto pb-1 sm:gap-2">
          {STEPS.map((st, i) => {
            const current = i === s.step;
            const open = i <= s.reached;
            return (
              <li key={st} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!open}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => dispatch({ kind: 'go', step: i })}
                  className="group flex min-h-11 w-full flex-col items-start gap-1.5 text-left disabled:cursor-default"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-1 w-full rounded-full transition-colors',
                      current
                        ? 'bg-brand-glow'
                        : i < s.reached || (open && !current)
                          ? 'bg-brand-primary/50'
                          : 'bg-white/10',
                    )}
                  />
                  <span
                    className={cn(
                      'hidden truncate text-caption sm:block',
                      current
                        ? 'text-text-primary'
                        : open
                          ? 'text-text-secondary'
                          : 'text-text-muted',
                    )}
                  >
                    {c.steps[st]}
                  </span>
                  <span className="sr-only sm:hidden">{c.steps[st]}</span>
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
        className="mt-8"
      >
        <p className="text-caption text-text-muted tabular">{c.stepOf(s.step + 1, STEPS.length)}</p>
        <h2
          id="consult-question"
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-[clamp(1.5rem,1.2rem+1.1vw,2.125rem)] leading-[1.3] font-semibold text-text-primary outline-none"
        >
          {c.questions[step]}
        </h2>
        {optional && <p className="mt-2 text-caption text-text-muted">{c.hints[step]}</p>}
        <div className="mt-6">
          <Body s={s} dispatch={dispatch} />
        </div>
      </motion.div>

      {!(last && s.prepared) && (
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
          {s.step > 0 ? (
            <button
              type="button"
              onClick={() => dispatch({ kind: 'back' })}
              className={buttonClasses('ghost', 'lg')}
            >
              <ArrowLeft aria-hidden className="size-4" />
              {c.nav.back}
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {optional && (
              <button
                type="button"
                onClick={() => dispatch({ kind: 'next' })}
                data-skip
                className={buttonClasses('ghost', 'lg')}
              >
                {c.nav.skip}
              </button>
            )}
            {last ? (
              <button
                type="button"
                data-prepare
                onClick={() => dispatch({ kind: 'prepare' })}
                className={buttonClasses('primary', 'lg', 'whitespace-normal')}
              >
                {c.review.prepare}
                <ArrowRight aria-hidden className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                data-next
                onClick={() => dispatch({ kind: 'next' })}
                className={buttonClasses('primary', 'lg')}
              >
                {c.nav.next}
                <ArrowRight aria-hidden className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

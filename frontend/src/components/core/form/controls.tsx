import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Check, ChevronDown, Minus, Paperclip } from 'lucide-react';
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { controlStyles } from '../styles';
import { useFieldProps } from './fieldContext';

/*
 * Form controls. Each reads its id / ARIA wiring from the surrounding
 * FormField; they also work standalone with their own `id` / `aria-label`.
 */

type InputProps = Omit<ComponentProps<'input'>, 'className'> & {
  icon?: LucideIcon;
  /** Unit or suffix text inside the field, e.g. "ชิ้น". */
  suffix?: string;
  className?: string;
};

export function TextInput({
  icon: Icon,
  suffix,
  className,
  id,
  disabled,
  readOnly,
  ...rest
}: InputProps) {
  const { invalid, ...field } = useFieldProps({ id, disabled, readOnly });
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
          aria-hidden
        />
      )}
      <input
        {...field}
        {...rest}
        className={controlStyles({
          invalid,
          className: cn(Icon && 'pl-9', suffix && 'pr-14', className),
        })}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-caption text-fg-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function NumberInput(props: Omit<InputProps, 'type'>) {
  return (
    <TextInput
      type="number"
      inputMode="decimal"
      {...props}
      className={cn(
        '[appearance:textfield] tabular [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        props.className,
      )}
    />
  );
}

export function DateInput(props: Omit<InputProps, 'type' | 'icon'>) {
  return (
    <TextInput
      type="date"
      icon={CalendarDays}
      {...props}
      className={cn('[&::-webkit-calendar-picker-indicator]:opacity-60', props.className)}
    />
  );
}

export function Textarea({
  className,
  id,
  disabled,
  readOnly,
  ...rest
}: Omit<ComponentProps<'textarea'>, 'className'> & { className?: string }) {
  const { invalid, ...field } = useFieldProps({ id, disabled, readOnly });
  return (
    <textarea
      {...field}
      {...rest}
      className={controlStyles({ invalid, multiline: true, className })}
    />
  );
}

export function Select({
  options,
  placeholder,
  className,
  id,
  disabled,
  ...rest
}: Omit<ComponentProps<'select'>, 'className' | 'children'> & {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  // <select> has no readOnly: a read-only field is announced and rendered disabled.
  const { invalid, readOnly, ...field } = useFieldProps({ id, disabled });
  return (
    <div className="relative">
      <select
        {...field}
        aria-readonly={readOnly || undefined}
        disabled={field.disabled || readOnly}
        {...rest}
        className={controlStyles({ invalid, className: cn('appearance-none pr-10', className) })}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  indeterminate = false,
  className,
  id,
  disabled,
  ...rest
}: Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const inputId = id ?? autoId;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className={cn('relative inline-flex size-5 shrink-0', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        {...rest}
        className="peer size-5 cursor-pointer appearance-none rounded-[0.375rem] border border-line-strong bg-panel-raised transition-colors checked:border-brand-primary checked:bg-brand-primary indeterminate:border-brand-primary indeterminate:bg-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Check
        className="pointer-events-none absolute inset-0.5 size-4 text-text-inverse opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        strokeWidth={3}
        aria-hidden
      />
      <Minus
        className="pointer-events-none absolute inset-0.5 size-4 text-text-inverse opacity-0 peer-indeterminate:opacity-100"
        strokeWidth={3}
        aria-hidden
      />
    </span>
  );
  if (!label) return box;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="pt-0.5">{box}</span>
      <span className="min-w-0">
        <span className="block text-label text-fg-primary">{label}</span>
        {description && <span className="block text-caption text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  orientation = 'vertical',
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string; description?: string; disabled?: boolean }[];
  orientation?: 'vertical' | 'horizontal';
}) {
  return (
    <div
      className={cn('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-x-6')}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-start gap-3',
            o.disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
            className="mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-panel-raised transition-[border-color,border-width] checked:border-[6px] checked:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed"
          />
          <span className="min-w-0">
            <span className="block text-label text-fg-primary">{o.label}</span>
            {o.description && (
              <span className="block text-caption text-fg-muted">{o.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

/** On/off setting that applies immediately. Use Checkbox for choices submitted with a form. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-label text-fg-primary">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="text-caption text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed',
          checked ? 'border-brand-primary bg-brand-primary' : 'border-line-strong bg-fill-muted',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-4.5 rounded-full shadow transition-transform',
            checked ? 'translate-x-[1.375rem] bg-text-inverse' : 'translate-x-0.5 bg-fg-secondary',
          )}
        />
      </button>
    </div>
  );
}

/**
 * Attachment drop zone — visual placeholder only. File storage is not part of
 * the prototype, so the zone is inert and says so.
 */
export function FileDrop({ hint = 'PDF, JPG หรือ PNG ไม่เกิน 10 MB' }: { hint?: string }) {
  const field = useFieldProps();
  return (
    <div
      id={field.id}
      aria-disabled="true"
      aria-describedby={field['aria-describedby']}
      className="flex flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line-strong px-4 py-7 text-center"
    >
      <Paperclip className="size-5 text-fg-muted" aria-hidden />
      <p className="text-label text-fg-secondary">ลากไฟล์มาวาง หรือเลือกไฟล์</p>
      <p className="text-caption text-fg-muted">{hint}</p>
      <p className="mt-1 text-caption text-warning">
        การแนบไฟล์จะเปิดใช้เมื่อเชื่อมระบบจัดเก็บไฟล์
      </p>
    </div>
  );
}

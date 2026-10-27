import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import {
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { controlClass } from '@/components/ui/fieldStyles';

/*
 * Labelled inputs for the account screens: visible label, errors tied to the
 * input with aria-describedby, hints read after the label.
 */

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: ReactNode;
  error?: string | null;
  hint?: string;
}

function describedBy(id: string, ...parts: (string | false | null | undefined)[]) {
  const ids = parts.filter(Boolean).map((p) => `${id}-${String(p)}`);
  return ids.length ? ids.join(' ') : undefined;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-caption text-danger">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

export function TextField({ id, label, error, hint, className, ...input }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        className={controlClass(!!error)}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, hint && 'hint', error && 'error')}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function PasswordField({
  id,
  label,
  error,
  hint,
  showLabel,
  hideLabel,
  capsLockLabel,
  className,
  ...input
}: FieldProps & { showLabel: string; hideLabel: string; capsLockLabel: string }) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const onCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`${controlClass(!!error)} pr-12`}
          aria-invalid={!!error}
          aria-describedby={describedBy(id, hint && 'hint', error && 'error', caps && 'caps')}
          onKeyDown={onCaps}
          onKeyUp={onCaps}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-text-muted hover:text-text-primary"
        >
          {visible ? (
            <EyeOff className="size-4.5" aria-hidden />
          ) : (
            <Eye className="size-4.5" aria-hidden />
          )}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {caps && (
        <p id={`${id}-caps`} className="mt-1.5 text-caption text-warning">
          {capsLockLabel}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: ReactNode;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}

/** A native select with the same label / hint / error wiring as TextField. */
export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  children,
  ...select
}: SelectProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
        {label}
      </label>
      <select
        id={id}
        className={controlClass(!!error)}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, hint && 'hint', error && 'error')}
        {...select}
      >
        {children}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

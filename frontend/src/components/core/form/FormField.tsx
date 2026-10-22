import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FieldContext } from './fieldContext';

/**
 * Label → control → help or error. Wires `id`, `aria-describedby`,
 * `aria-invalid` and `required` into the control through context, so a form
 * is just <FormField label="…"><TextInput /></FormField>.
 * Use `group` for radio groups and checkbox sets (renders fieldset/legend).
 */
export function FormField({
  label,
  required = false,
  help,
  error,
  disabled = false,
  readOnly = false,
  group = false,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  group?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');

  const labelContent = (
    <>
      {label}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden>
          *
        </span>
      )}
      {required && <span className="sr-only"> (จำเป็น)</span>}
      {readOnly && (
        <span className="ml-2 text-caption font-normal text-fg-muted">อ่านอย่างเดียว</span>
      )}
    </>
  );
  const labelClass = cn(
    'mb-1.5 block text-label font-medium',
    disabled ? 'text-fg-disabled' : 'text-fg-primary',
  );
  const Wrapper = group ? 'fieldset' : 'div';

  return (
    <FieldContext.Provider
      value={{
        id,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
        required,
        disabled,
        readOnly,
      }}
    >
      <Wrapper
        className={cn('min-w-0', className)}
        {...(group ? { 'aria-describedby': describedBy || undefined, disabled } : {})}
      >
        {group ? (
          <legend className={labelClass}>{labelContent}</legend>
        ) : (
          <label htmlFor={id} className={labelClass}>
            {labelContent}
          </label>
        )}
        {children}
        {help && (
          <p id={helpId} className="mt-1.5 text-caption text-fg-muted">
            {help}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-caption text-danger">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </Wrapper>
    </FieldContext.Provider>
  );
}

/** Responsive two-column form grid; `span` children with `sm:col-span-2`. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-x-5 gap-y-5 sm:grid-cols-2', className)}>{children}</div>;
}

/** Titled group of fields within a long form. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-6 first:border-0 first:pt-0">
      <h3 className="text-section text-fg-primary">{title}</h3>
      {description && <p className="mt-0.5 text-caption text-fg-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Action row at the end of a form: secondary left of primary, full-width on phones. */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

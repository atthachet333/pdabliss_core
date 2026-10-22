import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonStyles, type ButtonSize, type ButtonVariant } from './styles';

/*
 * Internal app buttons. Calmer than the public-site Button (no magnetic pull,
 * no glow sweep): solid brand fill for the one primary action on a surface,
 * quiet outlines for everything else.
 */

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Trailing icon (e.g. chevrons). */
  iconEnd?: LucideIcon;
  block?: boolean;
  className?: string;
}

type ButtonProps = CommonProps &
  Omit<ComponentProps<'button'>, 'className'> & {
    loading?: boolean;
    /**
     * Prototype affordance: the action exists in the design but is not wired
     * yet. Renders disabled with a "เร็ว ๆ นี้" marker and an explanatory title.
     */
    soon?: boolean;
  };

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconEnd: IconEnd,
  block,
  loading = false,
  soon = false,
  className,
  children,
  type = 'button',
  disabled,
  title,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading || soon}
      aria-busy={loading || undefined}
      title={soon ? (title ?? 'ยังไม่เปิดใช้งานในต้นแบบนี้') : title}
      className={buttonStyles({ variant, size, block, className })}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="size-4 shrink-0" aria-hidden />
      )}
      {children}
      {soon && <span className="text-caption font-normal opacity-80">· เร็ว ๆ นี้</span>}
      {IconEnd && <IconEnd className="size-4 shrink-0" aria-hidden />}
    </button>
  );
}

type IconButtonProps = Omit<ComponentProps<'button'>, 'className' | 'children'> & {
  icon: LucideIcon;
  /** Accessible name — required because there is no visible text. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Small dot/count rendered on the icon (e.g. unread notifications). */
  indicator?: ReactNode;
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  indicator,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={buttonStyles({ variant, size, iconOnly: true, className })}
      {...rest}
    >
      <Icon className="size-[1.125rem]" aria-hidden />
      {indicator}
    </button>
  );
}

type LinkButtonProps = CommonProps &
  Omit<ComponentProps<typeof Link>, 'className'> & { children: ReactNode };

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconEnd: IconEnd,
  block,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonStyles({ variant, size, block, className })} {...rest}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {children}
      {IconEnd && <IconEnd className="size-4 shrink-0" aria-hidden />}
    </Link>
  );
}

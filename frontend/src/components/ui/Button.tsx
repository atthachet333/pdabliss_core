import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import type { ComponentProps, PointerEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { PRESS } from '@/motion/tokens';
import {
  buttonClasses,
  type ButtonSize as Size,
  type ButtonVariant as Variant,
} from './buttonStyles';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** Subtle magnetic pull toward the pointer (max 5px). Off under reduced motion. */
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
}

const MAGNET_PX = 5;

function useMagnet(enabled: boolean) {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });
  const active = enabled && !reduce;
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!active || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 2 * MAGNET_PX);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 2 * MAGNET_PX);
  };
  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };
  return { style: active ? { x, y } : undefined, onPointerMove, onPointerLeave };
}

function Sweep({ variant }: { variant: Variant }) {
  if (variant !== 'primary') return null;
  // Glow sweep on hover — a light band passing once across the button.
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 group-hover:animate-sweep"
    />
  );
}

type LinkButtonProps = CommonProps & { to: string } & Omit<
    ComponentProps<typeof Link>,
    'to' | 'className' | 'children'
  >;

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  magnetic = false,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  const magnet = useMagnet(magnetic);
  return (
    <motion.span
      className="inline-flex"
      style={magnet.style}
      onPointerMove={magnet.onPointerMove}
      onPointerLeave={magnet.onPointerLeave}
      whileTap={PRESS}
    >
      <Link to={to} className={buttonClasses(variant, size, className)} {...rest}>
        <Sweep variant={variant} />
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </Link>
    </motion.span>
  );
}

type ButtonProps = CommonProps & Omit<ComponentProps<'button'>, 'className' | 'children'>;

export function Button({
  variant = 'primary',
  size = 'md',
  magnetic = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const magnet = useMagnet(magnetic);
  return (
    <motion.span
      className="inline-flex"
      style={magnet.style}
      onPointerMove={magnet.onPointerMove}
      onPointerLeave={magnet.onPointerLeave}
      whileTap={rest.disabled ? undefined : PRESS}
    >
      <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
        <Sweep variant={variant} />
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </button>
    </motion.span>
  );
}

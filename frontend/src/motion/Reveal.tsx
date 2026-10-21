import { motion, type HTMLMotionProps } from 'framer-motion';
import { reveal, revealContainer, VIEWPORT_ONCE } from './tokens';

type RevealProps = HTMLMotionProps<'div'> & { stagger?: boolean };

/** Reveals its content once when scrolled into view. Uses IntersectionObserver — no scroll listeners. */
export function Reveal({ stagger = false, children, ...rest }: RevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={stagger ? revealContainer : reveal}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A child of a staggered <Reveal>. */
export function RevealItem({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={reveal} {...rest}>
      {children}
    </motion.div>
  );
}

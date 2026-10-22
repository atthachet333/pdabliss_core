import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { Button, IconButton } from './Button';
import { useOverlay } from './useOverlay';

/*
 * Modal vs Drawer vs Page (docs/INTERNAL_DESIGN_SYSTEM.md):
 *  - Modal  — a short decision or a tiny form (confirm, reject with reason).
 *             Blocks the page; one question, one primary button.
 *  - Drawer — record detail, quick edit, task context. The list stays visible
 *             behind it, so people keep their place.
 *  - Page   — complex documents (PO, SO, GR with line items), anything that
 *             needs its own URL, long editing or side-by-side reference.
 */

export function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      aria-hidden
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.fast }}
      className="fixed inset-0 bg-[rgb(3_8_12/0.66)] backdrop-blur-[2px]"
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
  tone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
  /** `danger` adds a warning mark for destructive confirmations. */
  tone?: 'danger';
}) {
  const { id, panelRef } = useOverlay(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={description ? `${id}-desc` : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className={cn(
              'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-card border border-line-strong bg-panel-overlay shadow-overlay outline-none',
              size === 'sm' ? 'max-w-md' : 'max-w-xl',
            )}
          >
            <div className="flex items-start gap-3 px-6 pt-6">
              {tone === 'danger' && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/12">
                  <TriangleAlert className="size-4.5 text-danger" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={`${id}-title`} className="text-section text-fg-primary">
                  {title}
                </h2>
                {description && (
                  <p id={`${id}-desc`} className="mt-1 text-label text-fg-secondary">
                    {description}
                  </p>
                )}
              </div>
              <IconButton
                icon={X}
                label="ปิด"
                size="sm"
                onClick={onClose}
                className="-mt-1 -mr-2"
              />
            </div>
            {children && <div className="overflow-y-auto px-6 pt-5">{children}</div>}
            <div className="flex flex-col-reverse gap-2 px-6 pt-6 pb-6 sm:flex-row sm:justify-end">
              {footer}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Small yes/no decision. Destructive confirmations use `tone="danger"`. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger';
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Reference or context line above the title, e.g. the document type. */
  subtitle?: ReactNode;
  /** Status badge or meta next to the title. */
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const { id, panelRef } = useOverlay(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: DURATION.base, ease: EASE_CORE }}
            className={cn(
              'relative flex h-full w-full flex-col border-l border-line-strong bg-panel-overlay shadow-overlay outline-none',
              size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
            )}
          >
            <header className="flex items-start gap-3 border-b border-line px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-6">
              <div className="min-w-0 flex-1">
                {subtitle && <p className="text-caption text-fg-muted">{subtitle}</p>}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h2 id={`${id}-title`} className="text-section text-fg-primary">
                    {title}
                  </h2>
                  {headerExtra}
                </div>
              </div>
              <IconButton icon={X} label="ปิด" onClick={onClose} className="-mt-1 -mr-2" />
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {children}
            </div>
            {footer && (
              <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Bottom sheet for phones (navigation overflow, quick pickers). Same
 * behaviour as Drawer; slides up from the bottom edge within thumb reach.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { id, panelRef } = useOverlay(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: DURATION.base, ease: EASE_CORE }}
            className="relative flex max-h-[85dvh] w-full flex-col rounded-t-card border-t border-line-strong bg-panel-overlay shadow-overlay outline-none"
          >
            <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" />
            <header className="flex items-center justify-between gap-3 px-5 pt-2 pb-2">
              <h2 id={`${id}-title`} className="text-section text-fg-primary">
                {title}
              </h2>
              <IconButton icon={X} label="ปิด" onClick={onClose} className="-mr-2" />
            </header>
            <div className="overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const controlBase =
  'w-full rounded-control border bg-surface-raised px-4 text-body text-text-primary placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 focus:border-brand-glow focus:shadow-glow-sm focus:outline-none';

/** Class string for text inputs, selects and textareas. */
export function controlClass(invalid: boolean, multiline = false) {
  return `${controlBase} ${multiline ? 'min-h-32 py-3' : 'h-12'} ${invalid ? 'border-danger/70' : 'border-border-strong'}`;
}

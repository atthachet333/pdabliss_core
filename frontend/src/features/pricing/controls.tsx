import { useId } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { useCopy } from '@/i18n/useCopy';
import { PRICING } from './copy';
import type { Billing } from './plans';
import { usePricing } from './state';

/** Monthly / annual, shared by the explorer and the configurator. */
export function BillingToggle({
  className,
  showNote = true,
}: {
  className?: string;
  showNote?: boolean;
}) {
  const c = useCopy(PRICING);
  const { billing, setBilling } = usePricing();
  const id = useId();
  return (
    <div className={className}>
      <p id={id} className="mb-2 text-caption font-medium text-text-muted">
        {c.billing.label}
      </p>
      <Segmented<Billing>
        labelledBy={id}
        value={billing}
        onChange={setBilling}
        options={[
          { value: 'monthly', label: c.billing.monthly },
          { value: 'annual', label: c.billing.annual },
        ]}
        className="w-full sm:w-auto"
      />
      {showNote && (
        <p className="mt-2 max-w-sm text-caption text-text-secondary" aria-live="polite">
          {billing === 'monthly' ? c.billing.monthlyNote : c.billing.annualNote}
        </p>
      )}
    </div>
  );
}

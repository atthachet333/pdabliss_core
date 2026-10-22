import { createContext, useContext } from 'react';

/** What a FormField tells the control inside it (ids and ARIA wiring). */
export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Props every native control spreads so label, help and error are announced. */
export function useFieldProps(own: { id?: string; disabled?: boolean; readOnly?: boolean } = {}) {
  const field = useContext(FieldContext);
  return {
    id: own.id ?? field?.id,
    'aria-describedby': field?.describedBy,
    'aria-invalid': field?.invalid || undefined,
    required: field?.required || undefined,
    disabled: own.disabled ?? field?.disabled,
    readOnly: own.readOnly ?? field?.readOnly,
    invalid: field?.invalid ?? false,
  };
}

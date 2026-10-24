import type { DeptKey } from '@/features/departments/catalog';
import {
  emptyInquiry,
  STEPS,
  type ContactFields,
  type ContactMethod,
  type IndustryOption,
  type Inquiry,
  type InquiryType,
  type Prefill,
  type Problem,
  type Size,
} from './model';
import { validateDetails } from './validation';

/*
 * The consultation flow's state (EP13): which step is open, how far the
 * visitor has been, the inquiry being built, and whether errors are shown.
 * Nothing here talks to a server.
 */

export interface FlowState {
  step: number;
  /** The furthest step reached — earlier steps stay one click away. */
  reached: number;
  inquiry: Inquiry;
  topicError: boolean;
  showErrors: boolean;
  /** The message was prepared on the review step (not sent anywhere). */
  prepared: boolean;
}

export type FlowAction =
  | { kind: 'type'; value: InquiryType }
  | { kind: 'industry'; value: IndustryOption | undefined }
  | { kind: 'size'; value: Size | undefined }
  | { kind: 'department'; value: DeptKey }
  | { kind: 'problem'; value: Problem }
  | { kind: 'message'; value: string }
  | { kind: 'method'; value: ContactMethod }
  | { kind: 'field'; name: keyof ContactFields; value: string }
  | { kind: 'go'; step: number }
  | { kind: 'next' }
  | { kind: 'back' }
  | { kind: 'prepare' }
  | { kind: 'edit' };

export function initialFlow(prefill: Prefill): FlowState {
  return {
    step: 0,
    reached: 0,
    inquiry: emptyInquiry(prefill),
    topicError: false,
    showErrors: false,
    prepared: false,
  };
}

const toggle = <T>(list: readonly T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

const LAST = STEPS.length - 1;
const DETAILS = STEPS.indexOf('details');

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  const set = (inquiry: Partial<Inquiry>) => ({ ...s, inquiry: { ...s.inquiry, ...inquiry } });
  switch (a.kind) {
    case 'type':
      return { ...set({ type: a.value }), topicError: false };
    case 'industry':
      return set({ industry: a.value });
    case 'size':
      return set({ size: a.value });
    case 'department':
      return set({ departments: toggle(s.inquiry.departments, a.value) });
    case 'problem':
      return set({ problems: toggle(s.inquiry.problems, a.value) });
    case 'message':
      return set({ message: a.value });
    case 'method':
      return set({ method: a.value });
    case 'field':
      return set({ contact: { ...s.inquiry.contact, [a.name]: a.value } });
    case 'go': {
      if (a.step > s.reached) return s;
      // Never skip past contact details that have since become invalid.
      if (
        a.step > DETAILS &&
        Object.keys(validateDetails(s.inquiry.contact, s.inquiry.method)).length > 0
      ) {
        return { ...s, step: DETAILS, showErrors: true, prepared: false };
      }
      return { ...s, step: a.step, prepared: false };
    }
    case 'back':
      return { ...s, step: Math.max(0, s.step - 1), prepared: false };
    case 'next': {
      if (STEPS[s.step] === 'topic' && s.inquiry.type === null) return { ...s, topicError: true };
      if (
        s.step === DETAILS &&
        Object.keys(validateDetails(s.inquiry.contact, s.inquiry.method)).length > 0
      ) {
        return { ...s, showErrors: true };
      }
      const step = Math.min(LAST, s.step + 1);
      return { ...s, step, reached: Math.max(s.reached, step) };
    }
    case 'prepare':
      return { ...s, prepared: true };
    case 'edit':
      return { ...s, prepared: false };
  }
}

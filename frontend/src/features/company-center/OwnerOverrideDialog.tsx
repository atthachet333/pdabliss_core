import { useEffect, useId, useRef, useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { useCopy, type Localized } from '@/i18n/useCopy';

/*
 * EP41 owner override of independent approval — its own lazy chunk, loaded only
 * when an owner meets SELF_APPROVAL_NOT_ALLOWED. A separate, clearly labelled
 * step: nothing is decided until the owner gives a reason and confirms; Cancel
 * or Escape leaves the document as it was. The server records the override
 * (SELF_APPROVAL_OVERRIDE) with the reason, actor, time, branch and document.
 */

interface OverrideCopy {
  title: string;
  lead: string;
  record: string;
  reason: string;
  hint: string;
  confirm: string;
  cancel: string;
}

const COPY: Localized<OverrideCopy> = {
  th: {
    title: 'ยกเว้นโดยเจ้าของบริษัท',
    lead: 'บริษัทกำหนดให้อนุมัติโดยผู้อื่น และคุณเป็นผู้สร้างหรือผู้ส่งเอกสารนี้',
    record:
      'ในฐานะเจ้าของบริษัท คุณยังดำเนินการต่อได้ — การยกเว้นและเหตุผลจะถูกบันทึกในกิจกรรมของบริษัท',
    reason: 'เหตุผล (จำเป็น)',
    hint: 'อย่างน้อย 10 ตัวอักษร',
    confirm: 'อนุมัติด้วยการยกเว้นของเจ้าของ',
    cancel: 'ยกเลิก',
  },
  en: {
    title: 'Owner override',
    lead: 'This company requires independent approval, and you created or submitted this document.',
    record:
      'As the owner you may still decide — the override and your reason are recorded in Activity.',
    reason: 'Reason (required)',
    hint: 'At least 10 characters',
    confirm: 'Approve with owner override',
    cancel: 'Cancel',
  },
  'zh-CN': {
    title: '所有者豁免',
    lead: '本公司要求独立审批，而您是该单据的创建人或提交人。',
    record: '作为所有者，您仍可继续——豁免及原因将记录在公司活动中。',
    reason: '原因（必填）',
    hint: '至少 10 个字符',
    confirm: '以所有者豁免审批',
    cancel: '取消',
  },
};

export default function OwnerOverrideDialog({
  onDone,
}: {
  onDone: (reason: string | null) => void;
}) {
  const c = useCopy(COPY);
  const [reason, setReason] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const leadId = useId();
  const hintId = useId();
  const valid = reason.trim().length >= 10;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDone(null);
      } else if (e.key === 'Tab' && panel.current) {
        // Modal: focus stays inside the dialog.
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>('textarea, button:not([disabled])'),
        ];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Focus goes back to what opened the dialog once the page has settled; if the page
      // replaced or disabled it meanwhile (a busy button), to the page's main region.
      setTimeout(() => {
        if (before?.isConnected && !before.hasAttribute('disabled')) before.focus();
        else document.getElementById('main')?.focus();
      }, 0);
    };
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-90 grid place-items-center p-4" data-owner-override>
      <div aria-hidden className="absolute inset-0 bg-black/60" onClick={() => onDone(null)} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        className="relative grid w-[min(32rem,100%)] gap-4 rounded-2xl bg-surface-dark p-5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8),inset_0_0_0_1px_rgb(190_235_222/0.14)]"
      >
        <h2 id={titleId} className="text-body font-semibold text-text-primary">
          {c.title}
        </h2>
        <div id={leadId} className="grid gap-2 text-label text-text-secondary">
          <p>{c.lead}</p>
          <p>{c.record}</p>
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${titleId}-reason`} className="text-label font-medium text-text-primary">
            {c.reason}
          </label>
          <textarea
            id={`${titleId}-reason`}
            ref={field}
            value={reason}
            maxLength={500}
            aria-describedby={hintId}
            onChange={(e) => setReason(e.target.value)}
            className={controlClass(false, true)}
            data-override-reason
          />
          <p id={hintId} className="text-caption text-text-muted">
            {c.hint}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={buttonClasses('ghost', 'md')}
            onClick={() => onDone(null)}
          >
            {c.cancel}
          </button>
          <button
            type="button"
            className={buttonClasses('primary', 'md')}
            disabled={!valid}
            onClick={() => onDone(reason.trim())}
            data-override-confirm
          >
            {c.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

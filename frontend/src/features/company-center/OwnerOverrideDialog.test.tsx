import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/Providers';
import OwnerOverrideDialog from './OwnerOverrideDialog';

/*
 * EP41 owner override dialog: a labelled modal, a required reason, focus kept
 * inside and given back, Escape cancels. Nothing is decided until Confirm.
 */

const open = () => {
  const onDone = vi.fn();
  const trigger = document.createElement('button');
  trigger.textContent = 'Confirm order';
  document.body.appendChild(trigger);
  trigger.focus();
  const view = render(
    <Providers>
      <OwnerOverrideDialog onDone={onDone} />
    </Providers>,
  );
  return { onDone, trigger, view };
};

describe('OwnerOverrideDialog (EP41)', () => {
  it('is a labelled modal that needs a reason of at least 10 characters', async () => {
    const { onDone } = open();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName();
    expect(dialog).toHaveAccessibleDescription();
    const reason = screen.getByRole('textbox');
    expect(reason).toHaveFocus();
    const confirm = document.querySelector<HTMLButtonElement>('[data-override-confirm]')!;
    expect(confirm).toBeDisabled();
    await userEvent.type(reason, 'too short');
    expect(confirm).toBeDisabled();
    await userEvent.type(reason, ' — the only approver today  ');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onDone).toHaveBeenCalledWith('too short — the only approver today');
  });

  it('keeps focus inside, cancels on Escape, and gives focus back', async () => {
    const { onDone, trigger, view } = open();
    const reason = screen.getByRole('textbox');
    await userEvent.type(reason, 'a long enough reason');
    // Tab cycles through the dialog only.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(onDone).toHaveBeenCalledWith(null);
    view.unmount();
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });

  it('falls back to the main region when the opener is gone', async () => {
    const main = document.createElement('main');
    main.id = 'main';
    main.tabIndex = -1;
    document.body.appendChild(main);
    const { trigger, view } = open();
    trigger.remove();
    view.unmount();
    await waitFor(() => expect(main).toHaveFocus());
    main.remove();
  });
});

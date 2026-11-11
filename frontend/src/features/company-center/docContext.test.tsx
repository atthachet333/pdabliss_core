import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LineSummaryText, NextStep, Previewable } from './docContext';
import { DOC_COPY, usePreviewCache, type LineSummary } from './docModel';
import { ApiError } from '@/lib/api';

/*
 * EP42.3 document context (UI): a row says what the document holds and who it waits on;
 * the preview is a keyboard-operable disclosure that reads the document once, shows its
 * lines and a link to the full page — and offers no business action of its own.
 */

const d = DOC_COPY.th;
const at = (ui: React.ReactNode) =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '*', element: ui }], { initialEntries: ['/'] })}
    />,
  );

function Table({
  load,
}: {
  load: (id: string) => Promise<
    {
      key: string;
      code: string | null;
      name: string;
      quantity: string;
      unit: string | null;
      extra?: string;
    }[]
  >;
}) {
  const preview = usePreviewCache(load);
  return (
    <table>
      <tbody>
        <Previewable
          load={() => preview('po1')}
          href="/core/purchasing/orders/po1"
          label="PO-1"
          colSpan={3}
          row={(toggle) => (
            <tr data-row>
              <td>
                PO-1
                {toggle}
              </td>
              <td>Supplier</td>
              <td>x</td>
            </tr>
          )}
        />
      </tbody>
    </table>
  );
}

describe('document context (EP42.3)', () => {
  it('summarises a document: first item, quantity and unit, how many more', () => {
    const s: LineSummary = { code: 'FG-1', name: 'Cream', quantity: '12', unit: 'PCS', more: 2 };
    at(<LineSummaryText s={s} />);
    const el = document.querySelector('[data-line-summary]')!;
    expect(el.textContent).toContain('FG-1');
    expect(el.textContent).toContain('Cream');
    expect(el.textContent).toContain('12 PCS');
    expect(el.textContent).toContain(d.more(2));
  });

  it('an empty document reads as a dash; nothing pending shows no next step', () => {
    at(
      <>
        <LineSummaryText s={null} />
        <NextStep dept={null} />
      </>,
    );
    expect(document.querySelector('[data-line-summary]')).toBeNull();
    expect(document.querySelector('[data-next-dept]')).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('names the department a document waits on (with a spoken label)', () => {
    at(<NextStep dept="WAREHOUSE" />);
    const el = document.querySelector('[data-next-dept="WAREHOUSE"]')!;
    expect(el.textContent).toContain(d.next);
    expect(el.textContent).toContain('คลังสินค้า');
  });

  it('preview: keyboard disclosure, read once, lines and a full-document link, no actions', async () => {
    const load = vi.fn(async () => [
      { key: 'l1', code: 'RM-1', name: 'Oil', quantity: '8', unit: 'KG', extra: d.left('3 KG') },
      { key: 'l2', code: null, name: 'Pallet delivery', quantity: '1', unit: null },
    ]);
    const user = userEvent.setup();
    at(<Table load={load} />);
    const toggle = screen.getByRole('button', { name: `${d.preview} — PO-1` });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(load).not.toHaveBeenCalled(); // nothing is fetched before it is asked for
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const region = await screen.findByRole('region', { name: `${d.preview} — PO-1` });
    expect(toggle).toHaveAttribute('aria-controls', region.id);
    await waitFor(() => expect(within(region).getByText('Oil')).toBeInTheDocument());
    expect(region.textContent).toContain('8 KG');
    expect(region.textContent).toContain(d.left('3 KG'));
    expect(within(region).getByText('Pallet delivery')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: d.open })).toHaveAttribute(
      'href',
      '/core/purchasing/orders/po1',
    );
    // Read-only: the panel has no button — confirming, posting or cancelling happen on the page.
    expect(within(region).queryByRole('button')).toBeNull();
    expect(toggle).toHaveFocus();
    // Closing and opening again uses what was read: one request in all.
    await user.keyboard(' ');
    expect(screen.queryByRole('region')).toBeNull();
    expect(toggle).toHaveAccessibleName(`${d.preview} — PO-1`);
    await user.click(toggle);
    await screen.findByText('Oil');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('EP42.4: a figure measured against another ("6 / 10 BOX"); a blind count shows no quantity', () => {
    at(
      <>
        <LineSummaryText
          s={{ code: 'PK-1', name: 'Box', quantity: '6', unit: 'BOX', more: 0, of: '10' }}
        />
        <LineSummaryText
          s={{ code: 'FG-1', name: 'Cream', quantity: null, unit: 'PCS', more: 1 }}
        />
      </>,
    );
    const [packed, counted] = document.querySelectorAll('[data-line-summary]');
    expect(packed!.textContent).toContain('6 / 10 BOX');
    expect(counted!.textContent).not.toMatch(/\d+ PCS/);
    expect(counted!.textContent).toContain(d.more(1));
  });

  it('EP42.4: a refused read says the lines are not this person’s to see', async () => {
    const load = vi.fn(() => Promise.reject(new ApiError(403, 'FORBIDDEN', 'no')));
    const user = userEvent.setup();
    at(<Table load={load} />);
    await user.click(screen.getByRole('button', { name: `${d.preview} — PO-1` }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(d.denied);
    expect(alert).toHaveAttribute('data-preview-state', 'denied');
  });

  it('preview: a failed read says so (with the way on) and is tried again on the next opening', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    at(<Table load={load} />);
    const toggle = screen.getByRole('button', { name: `${d.preview} — PO-1` });
    await user.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent(d.failed);
    expect(screen.getByRole('link', { name: d.open })).toBeInTheDocument();
    await user.click(toggle);
    await user.click(toggle);
    expect(await screen.findByText(d.none)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

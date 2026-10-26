import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { PUBLIC_ROUTES } from '@/test/publicRoutes';
import { renderRoute } from '@/test/render';

/*
 * EP05 revision: switching language switches the WHOLE public site — page
 * bodies included, not only the shell.
 */

// Every public page (the permanent regression set); '' is the locale home.
const PAGES = PUBLIC_ROUTES.map((r) => (r === '/' ? '' : r));
const THAI = /[฀-๿]/;

/**
 * Visible page text: excludes decorative / inert subtrees (product previews
 * show the real Thai product UI) and the company address, which is printed in
 * Thai on purpose in every locale.
 */
function visibleMainText() {
  const main = document.getElementById('main')!.cloneNode(true) as HTMLElement;
  main.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
  return (main.textContent ?? '').replace(CONTACT.address, '');
}

/** Thai script runs. The baht sign (฿, U+0E3F) is a currency symbol, allowed in every locale. */
function thaiFragments(text: string) {
  return text.replace(/฿/g, '').match(/[฀-๿][฀-๿\s]{0,30}/g) ?? [];
}

describe('whole-site language switching', () => {
  it.each(PAGES)('English page body at /en%s has no Thai text', async (path) => {
    renderRoute(`/en${path}`);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(thaiFragments(visibleMainText())).toEqual([]);
  });

  it.each(PAGES)('Chinese page body at /zh%s has no Thai text', async (path) => {
    renderRoute(`/zh${path}`);
    await screen.findByRole('heading', { level: 1 });
    expect(thaiFragments(visibleMainText())).toEqual([]);
  });

  it('localizes the homepage hero and chapters', async () => {
    renderRoute('/en');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Every department at its best',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: /Six worlds of work/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request a consultation/ })).toHaveAttribute(
      'href',
      '/en/contact',
    );
  });

  it('localizes the homepage in Simplified Chinese', async () => {
    renderRoute('/zh');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      '每个部门都能发挥所长',
    );
    expect(screen.getByRole('link', { name: /申请咨询/ })).toHaveAttribute('href', '/zh/contact');
  });

  it('keeps Thai as the default for every page', async () => {
    renderRoute('/features');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'ความสามารถที่ออกแบบมาเพื่องานปฏิบัติการจริง',
    );
    expect(THAI.test(visibleMainText())).toBe(true);
  });

  it('switching language from the header changes the page body', async () => {
    const { router } = renderRoute('/solutions');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'ปัญหาไม่ได้อยู่ที่งานเยอะเสมอไป',
    );
    const header = screen.getByRole('banner');
    await userEvent.click(within(header).getByRole('button', { name: 'TH, ภาษา: ภาษาไทย' }));
    await userEvent.click(within(header).getByRole('link', { name: /English/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/en/solutions'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'The problem isn’t always too much work',
      ),
    );
    expect(thaiFragments(visibleMainText())).toEqual([]);
  });

  it('validates the contact flow in the visitor’s language', async () => {
    renderRoute('/en/contact?interest=demo');
    for (let i = 0; i < 4; i++) {
      await userEvent.click(await screen.findByRole('button', { name: /^Next/ }));
    }
    await userEvent.click(await screen.findByRole('button', { name: /^Next/ }));
    expect(await screen.findByText('Please enter a contact name')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact name')).toHaveAttribute('aria-invalid', 'true');
  });
});

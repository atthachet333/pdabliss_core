import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render';
import { FALLBACK_STOCK, FEFO_LOTS, INCOMING } from './data';

const PRICING_KEY = /cost|price|amount|payment|margin|value/i;
const MONEY_TEXT = /฿|THB|บาท/;

describe('warehouse workspace pricing privacy', () => {
  it('warehouse data structures carry no pricing fields', () => {
    for (const row of [...FALLBACK_STOCK, ...INCOMING, ...FEFO_LOTS]) {
      for (const key of Object.keys(row)) expect(key).not.toMatch(PRICING_KEY);
    }
  });

  it('renders no monetary values anywhere in the warehouse dashboard', async () => {
    renderRoute('/app/warehouse');
    await screen.findByRole('heading', { level: 1, name: 'งานคลังวันนี้' });
    await screen.findByRole('region', { name: 'ตารางยอดสต็อก' });
    expect(document.body.textContent).not.toMatch(MONEY_TEXT);
  });

  it('tells warehouse users that pricing is withheld by the server', async () => {
    renderRoute('/app/warehouse');
    expect(
      await screen.findByText(/ข้อมูลต้นทุนและราคาไม่ถูกส่งมาจากเซิร์ฟเวอร์/),
    ).toBeInTheDocument();
  });
});

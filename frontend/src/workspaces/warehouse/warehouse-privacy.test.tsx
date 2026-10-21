import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prototypeSignIn, prototypeSignOut } from '@/prototype/session';
import { renderRoute } from '@/test/render';
import { WORKSPACES } from '../registry';
import { FEFO_SAMPLE, TODAY } from './data';

const PRICING_KEY = /cost|price|amount|payment|margin|value/i;
const MONEY_TEXT = /฿|THB|บาท|ราคาขาย|ต้นทุนสินค้า/;

describe('warehouse workspace pricing privacy', () => {
  beforeEach(() => {
    prototypeSignIn('user1', 'pass1');
  });
  afterEach(() => prototypeSignOut());

  it('warehouse data structures carry no pricing fields', () => {
    for (const row of [...TODAY, ...FEFO_SAMPLE]) {
      for (const key of Object.keys(row)) expect(key).not.toMatch(PRICING_KEY);
    }
  });

  it.each(['', ...WORKSPACES.warehouse.nav.map((n) => n.path).filter(Boolean)])(
    'renders no monetary values on /app/warehouse/%s',
    async (path) => {
      renderRoute(path ? `/app/warehouse/${path}` : '/app/warehouse');
      await screen.findByRole('heading', { level: 1 });
      expect(document.body.textContent).not.toMatch(MONEY_TEXT);
    },
  );

  it('tells warehouse users that pricing is withheld by the server', async () => {
    renderRoute('/app/warehouse');
    expect(
      await screen.findByText(/ข้อมูลต้นทุนและราคาไม่ถูกส่งมาจากเซิร์ฟเวอร์/),
    ).toBeInTheDocument();
  });
});

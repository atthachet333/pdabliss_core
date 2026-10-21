import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WORKSPACE_ORDER, WORKSPACES } from '@/workspaces/registry';
import { renderRoute } from './render';

describe('public website', () => {
  it('renders the CORE Universe landing page with the primary CTAs', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'ทุกแผนกทำงานได้เต็มที่',
    );
    expect(screen.getByRole('figure', { name: /CORE Universe/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ดูภาพรวมระบบ/ })).toHaveAttribute('href', '#preview');
    expect(screen.getAllByRole('link', { name: /เริ่มทดลองใช้/ }).length).toBeGreaterThan(0);
  });

  it('shows every orbiting department as a reachable link', async () => {
    renderRoute('/');
    const universe = await screen.findByRole('figure', { name: /CORE Universe/ });
    for (const name of [
      'ฝ่ายขาย',
      'คลังสินค้า',
      'จัดซื้อ',
      'ปฏิบัติการ',
      'บัญชีและการเงิน',
      'รายงาน',
    ]) {
      expect(universe.querySelector(`a[href^="/departments#"]`)).not.toBeNull();
      expect(universe).toHaveTextContent(name);
    }
  });

  it('labels plans as a sample structure and invents no prices', async () => {
    renderRoute('/pricing');
    expect((await screen.findAllByText(/โครงสร้างแพ็กเกจตัวอย่าง/)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/฿\s?\d/);
  });

  it.each([
    '/features',
    '/departments',
    '/solutions',
    '/about',
    '/contact',
    '/login',
    '/privacy',
    '/terms',
  ])('renders %s with a level-1 heading', async (path) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('validates the contact form with Thai messages before anything is submitted', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderRoute('/contact');
    const submit = await screen.findByRole('button', { name: /ตรวจสอบและส่งข้อความ/ });
    await userEvent.click(submit);
    expect(await screen.findByText('กรุณากรอกชื่อ-นามสกุล')).toBeInTheDocument();
    expect(screen.getByLabelText('ชื่อ-นามสกุล')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('workspace route groups', () => {
  it.each(WORKSPACE_ORDER)('renders the %s workspace with its own navigation', async (id) => {
    renderRoute(`/app/${id}`);
    const nav = await screen.findByRole('navigation', { name: `เมนู${WORKSPACES[id].nameTh}` });
    for (const item of WORKSPACES[id].nav) {
      expect(nav).toHaveTextContent(item.label);
    }
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('has no company picker: /app goes to sign-in', async () => {
    const { router } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' });
    expect(router.state.location.pathname).toBe('/login');
  });
});

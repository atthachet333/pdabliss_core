import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { isLoaded } from '@/i18n/messages';
import { useLocale } from '@/i18n/useLocale';
import { AuthLocale } from './locale';

/*
 * EP42.4 — the root cause of an intermittent "Thai leaking into ZH" failure of the Company
 * Control Center language test: the English / Chinese shell dictionary is a lazy chunk and
 * the shell falls back to Thai until it arrives. In a fresh test worker neither is loaded,
 * so the first render shows exactly what a slow device shows.
 */

function SkipLink() {
  const { t } = useLocale();
  return <a href="#main">{t.shell.skipToContent}</a>;
}
const at = (path: string, ui: React.ReactNode) =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [path] })}
    />,
  );

describe('signed-in language (EP42.4)', () => {
  it('without waiting, an English page first shows the Thai shell (the old flash)', () => {
    expect(isLoaded('en')).toBe(false);
    at(
      '/company?lang=en',
      <AuthLocale>
        <SkipLink />
      </AuthLocale>,
    );
    expect(screen.getByRole('link')).toHaveTextContent('ข้ามไปยังเนื้อหาหลัก');
  });

  it('a signed-in area waits for its dictionary: never Thai, then Chinese', async () => {
    expect(isLoaded('zh-CN')).toBe(false);
    const { container } = at(
      '/company?lang=zh',
      <AuthLocale wait>
        <SkipLink />
      </AuthLocale>,
    );
    expect(container.textContent).not.toMatch(/[฀-๿]/);
    expect(await screen.findByRole('link')).toHaveTextContent('跳至主要内容');
  });
});

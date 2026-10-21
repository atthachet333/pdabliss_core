import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';

const GROUPS = [
  {
    title: 'ผลิตภัณฑ์',
    links: [
      { to: '/', label: 'Product' },
      { to: '/departments', label: 'Departments' },
      { to: '/features', label: 'Features' },
      { to: '/solutions', label: 'Solutions' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'บริษัท',
    links: [
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="relative border-t border-border-soft bg-surface-dark">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent"
      />
      <Container className="grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-label text-text-secondary">
            แพลตฟอร์มปฏิบัติการระดับแผนก — ทุกแผนกมีพื้นที่ทำงานของตัวเอง
            เชื่อมกันด้วยเวิร์กโฟลว์และข้อมูลชุดเดียว
          </p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-caption font-semibold tracking-[0.16em] text-text-muted uppercase">
              {group.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-label text-text-secondary transition-colors hover:text-brand-glow"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="flex flex-col gap-2 border-t border-border-soft py-6 text-caption text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {SITE.company}. สงวนลิขสิทธิ์
        </p>
        <p>
          {SITE.name} · {SITE.positioning}
        </p>
      </Container>
    </footer>
  );
}

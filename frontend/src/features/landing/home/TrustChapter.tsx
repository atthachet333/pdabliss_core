import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';
import { Reveal } from '@/motion/Reveal';
import { ChapterMark } from './ChapterMark';

const LINKS = [
  { to: '/about', label: 'รู้จัก PDA BLISS' },
  { to: '/#why-core', label: 'Why We Built CORE' },
  { to: '/contact', label: 'ติดต่อเรา' },
];

/**
 * Chapter 10 — who stands behind CORE. Editorial and quiet: no logos wall,
 * no invented customers or certifications. A philosophy and a company name.
 */
export function TrustChapter() {
  return (
    <section id="trust" aria-labelledby="trust-title" className="relative py-24 sm:py-36">
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-dark" />
      <Container>
        <div className="mx-auto max-w-4xl">
          <ChapterMark id="trust" tone="calm" />
          <h2 id="trust-title" className="sr-only">
            เกี่ยวกับ {SITE.company}
          </h2>
          <Reveal>
            <blockquote className="mt-10">
              <p className="text-h1 leading-snug font-medium text-text-primary">
                “เราเชื่อว่าระบบที่ดีต้องเริ่มจากหน้างาน —
                <span className="text-text-secondary">
                  {' '}
                  เข้าใจว่าแต่ละแผนกทำงานอย่างไร ก่อนจะเชื่อมทุกแผนกเข้าด้วยกัน”
                </span>
              </p>
            </blockquote>
          </Reveal>
          <div className="mt-12 grid gap-8 border-t border-border-soft pt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-caption font-semibold tracking-[0.22em] text-text-muted uppercase">
                {SITE.company}
              </p>
              <p className="mt-3 max-w-xl text-body text-text-secondary">
                ผู้พัฒนา {SITE.name} — แพลตฟอร์มปฏิบัติการระดับแผนก ที่ออกแบบจากงานจริงของฝ่ายขาย
                คลังสินค้า จัดซื้อ ปฏิบัติการ บัญชี และผู้บริหาร
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-3 sm:flex-col sm:items-end">
              {LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="group inline-flex min-h-11 items-center gap-1.5 text-label text-text-primary underline-offset-4 hover:underline"
                  >
                    {l.label}
                    <ArrowUpRight
                      className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

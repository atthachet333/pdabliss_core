import { ArrowRight } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { Reveal } from '@/motion/Reveal';

export function FinalCtaSection() {
  return (
    <section aria-labelledby="cta-title" className="relative py-24 sm:py-32">
      <Container>
        <Reveal className="relative isolate overflow-hidden rounded-[2rem] border border-border-brand bg-surface-base px-6 py-16 text-center sm:px-12 sm:py-24">
          {/* Concentric CORE rings echo the hero — slow, single breathing glow */}
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 size-[44rem] -translate-x-1/2 -translate-y-1/2 animate-core-breathe rounded-full bg-[radial-gradient(circle,rgb(62_240_192/0.22),transparent_62%)]" />
            {[18, 28, 38, 50].map((r) => (
              <span
                key={r}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-glow/12"
                style={{ width: `${r}rem`, height: `${r}rem` }}
              />
            ))}
            <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(circle_at_center,black,transparent_70%)] opacity-50" />
          </div>

          <p className="eyebrow">Ready for one CORE</p>
          <h2 id="cta-title" className="mx-auto mt-5 max-w-3xl text-h1 text-text-primary">
            ให้ทุกแผนกทำงานบนแกนเดียวกัน
            <span className="block text-gradient-brand">ตั้งแต่วันแรกที่เริ่มใช้</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-body-lg text-text-secondary">
            ลองเข้าพื้นที่ทำงานเดโมของแต่ละแผนก หรือพูดคุยกับทีมงานเพื่อวางโครงสร้าง CORE
            ให้เหมาะกับองค์กรของคุณ
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <LinkButton to="/login" size="lg" magnetic>
              เริ่มทดลองใช้
              <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
            <LinkButton to="/contact" variant="secondary" size="lg">
              พูดคุยกับทีมงาน
            </LinkButton>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

import { CircleAlert } from 'lucide-react';
import { Container, SectionHeader } from '@/components/ui/Section';
import { CountUp } from '@/motion/CountUp';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { SAFEGUARDS } from '../safeguards';

function GuardIllustration() {
  return (
    <div
      className="rounded-card border border-border-strong bg-surface-base p-5 shadow-raised"
      aria-label="ตัวอย่าง: ระบบปฏิเสธการรับสินค้าเกินจำนวนในใบสั่งซื้อ"
      role="img"
    >
      <p className="text-caption text-text-muted">รับสินค้า · GR-0771 อ้างอิง PO-0922</p>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-label">
        <span className="text-text-muted">รายการ</span>
        <span className="text-right text-text-muted">คงเหลือรับได้</span>
        <span className="text-right text-text-muted">รับครั้งนี้</span>
        <span className="text-text-primary">อะลูมิเนียมโปรไฟล์ 6063</span>
        <span className="text-right text-text-secondary tabular">100</span>
        <span className="rounded-lg border border-danger/60 bg-danger/10 px-2.5 py-1 text-right text-danger tabular">
          120
        </span>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-caption text-danger">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        รับเกินจำนวนในใบสั่งซื้อไม่ได้ — คงเหลือรับได้ 100 เส้น กรุณาตรวจสอบหรือแจ้งฝ่ายจัดซื้อ
      </p>
    </div>
  );
}

export function ErrorPreventionSection() {
  return (
    <section aria-labelledby="guard-title" className="relative py-24 sm:py-32">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader
            id="guard-title"
            eyebrow="Human error prevention"
            title="ระบบที่ช่วยป้องกันความผิดพลาด ก่อนที่มันจะเกิดขึ้น"
            lead="กฎธุรกิจทำงานที่เซิร์ฟเวอร์ทุกครั้ง หน้าจอจึงช่วยแนะนำ ส่วนเซิร์ฟเวอร์เป็นผู้ตัดสิน"
          />
          <Reveal className="mt-8 grid grid-cols-3 gap-3">
            {[
              { n: 7, s: '', l: 'พื้นที่ทำงาน' },
              { n: 1, s: '', l: 'แหล่งข้อมูล' },
              { n: 8, s: '', l: 'กลไกควบคุม' },
            ].map((k) => (
              <div
                key={k.l}
                className="rounded-2xl border border-border-soft bg-surface-raised/40 p-4"
              >
                <CountUp to={k.n} suffix={k.s} className="text-kpi text-text-primary tabular" />
                <p className="mt-1 text-caption text-text-muted">{k.l}</p>
              </div>
            ))}
          </Reveal>
          <Reveal className="mt-8">
            <GuardIllustration />
          </Reveal>
        </div>

        <Reveal stagger className="grid gap-3 sm:grid-cols-2">
          {SAFEGUARDS.map(({ icon: Icon, title, body }) => (
            <RevealItem
              key={title}
              className="group rounded-2xl border border-border-soft bg-surface-base/70 p-5 transition-[border-color,background-color] duration-300 hover:border-border-brand hover:bg-surface-raised"
            >
              <Icon
                className="size-5 text-brand-glow transition-transform duration-300 group-hover:scale-110"
                aria-hidden
              />
              <h3 className="mt-4 text-label font-semibold text-text-primary">{title}</h3>
              <p className="mt-1.5 text-label text-text-secondary">{body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

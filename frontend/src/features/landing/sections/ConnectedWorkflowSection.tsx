import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { Container, SectionHeader } from '@/components/ui/Section';
import { getDepartment, type DepartmentId } from '@/config/departments';
import { DURATION, EASE_CORE, reveal, revealContainer, VIEWPORT_ONCE } from '@/motion/tokens';

const STAGES: { dept: DepartmentId; action: string; docs: string[] }[] = [
  {
    dept: 'sales',
    action: 'รับคำสั่งซื้อและตรวจความพร้อมสินค้า',
    docs: ['Customer PO', 'Sales Order'],
  },
  { dept: 'operations', action: 'วางแผนและผลิตเมื่อสินค้าไม่พอ', docs: ['Work Order'] },
  {
    dept: 'warehouse',
    action: 'รับเข้า ตรวจ QC และเตรียมส่ง',
    docs: ['Goods Receipt', 'Delivery'],
  },
  { dept: 'purchasing', action: 'จัดหาวัตถุดิบและติดตามซัพพลายเออร์', docs: ['PR', 'PO'] },
  {
    dept: 'accounting',
    action: 'จ่ายเงินเมื่อเอกสารครบและอนุมัติแล้ว',
    docs: ['Payment Request', 'Payment'],
  },
];

export function ConnectedWorkflowSection() {
  return (
    <section aria-labelledby="workflow-title" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)] opacity-60"
      />
      <Container>
        <SectionHeader
          id="workflow-title"
          eyebrow="Connected workflow"
          title="งานส่งต่อระหว่างแผนก โดยไม่มีอะไรตกหล่น"
          lead="เมื่อแผนกหนึ่งทำงานเสร็จ แผนกถัดไปเห็นงานทันทีพร้อมเอกสารอ้างอิง ไม่ต้องคีย์ข้อมูลซ้ำ ไม่ต้องโทรตาม"
        />

        <motion.ol
          className="relative mt-16 grid gap-6 lg:grid-cols-5 lg:gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={revealContainer}
        >
          {/* Progress line draws once — transform only (scaleX / scaleY) */}
          <motion.span
            aria-hidden
            className="absolute top-7 right-[10%] left-[10%] hidden h-px origin-left bg-gradient-to-r from-brand-glow via-brand-primary to-brand-cool lg:block"
            variants={{
              hidden: { scaleX: 0 },
              visible: { scaleX: 1, transition: { duration: DURATION.draw, ease: EASE_CORE } },
            }}
          />
          <motion.span
            aria-hidden
            className="absolute top-7 bottom-7 left-7 w-px origin-top bg-gradient-to-b from-brand-glow via-brand-primary to-brand-cool lg:hidden"
            variants={{
              hidden: { scaleY: 0 },
              visible: { scaleY: 1, transition: { duration: DURATION.draw, ease: EASE_CORE } },
            }}
          />
          {STAGES.map((stage, i) => {
            const dept = getDepartment(stage.dept);
            const Icon = dept.icon;
            return (
              <motion.li
                key={stage.dept}
                variants={reveal}
                className="relative flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center"
              >
                <span className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border-brand bg-surface-base shadow-glow-sm">
                  <Icon className="size-6 text-brand-glow" aria-hidden />
                  <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-brand-primary text-[0.75rem] font-semibold text-text-inverse tabular">
                    {i + 1}
                  </span>
                </span>
                <div className="lg:mt-5">
                  <h3 className="text-h3 text-text-primary">{dept.nameTh}</h3>
                  <p className="mt-1.5 text-label text-text-secondary">{stage.action}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5 lg:justify-center">
                    {stage.docs.map((doc) => (
                      <li
                        key={doc}
                        className="rounded-md border border-border-soft bg-surface-raised px-2 py-0.5 text-caption text-text-secondary"
                      >
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.li>
            );
          })}
        </motion.ol>

        <p className="mx-auto mt-14 flex max-w-2xl items-start gap-2.5 rounded-2xl border border-border-soft bg-surface-raised/40 px-4 py-3.5 text-caption text-text-secondary">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          ภาพนี้เป็นตัวอย่างลำดับการทำงานที่เชื่อมกัน — กระบวนการจริงของแต่ละธุรกิจแตกต่างกันได้
          เช่น คำสั่งซื้อที่มีสินค้าพร้อมส่งจะไปที่คลังสินค้าทันทีโดยไม่ผ่านฝ่ายปฏิบัติการ
        </p>
      </Container>
    </section>
  );
}

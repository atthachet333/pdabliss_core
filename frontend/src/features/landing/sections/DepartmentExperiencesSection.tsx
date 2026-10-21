import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { Container, SectionHeader } from '@/components/ui/Section';
import { DEPARTMENTS } from '@/config/departments';
import { HOVER_LIFT, reveal, revealContainer, VIEWPORT_ONCE } from '@/motion/tokens';

export function DepartmentExperiencesSection() {
  return (
    <section
      aria-labelledby="departments-title"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgb(25_195_154/0.08),transparent_70%)]"
      />
      <Container>
        <SectionHeader
          id="departments-title"
          eyebrow="Department experiences"
          title="แต่ละแผนก มีพื้นที่ทำงานที่ออกแบบมาเพื่องานของตัวเอง"
          lead="ไม่ใช่แดชบอร์ดเดียวที่เปลี่ยนแค่ชื่อเมนู — เมนู ตัวชี้วัด และข้อมูลที่เห็น ถูกออกแบบตามหน้าที่ของแต่ละแผนก"
        />
      </Container>

      {/* The core bus — every department card connects into it */}
      <Container className="relative mt-14">
        <div
          aria-hidden
          className="absolute top-0 right-8 left-8 hidden h-px bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent lg:block"
        />
        <motion.ul
          className="-mx-4 no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-0 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:pt-8"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          variants={revealContainer}
        >
          {DEPARTMENTS.map((dept, i) => {
            const Icon = dept.icon;
            return (
              <motion.li
                key={dept.id}
                variants={reveal}
                className="group relative w-[78vw] max-w-[20rem] shrink-0 snap-center sm:w-auto sm:max-w-none"
              >
                {/* Connector to the core bus — lights up on hover/focus */}
                <span
                  aria-hidden
                  className={
                    'absolute -top-8 left-1/2 hidden h-8 w-px bg-brand-primary/30 transition-[background-color,box-shadow] duration-300 group-focus-within:bg-brand-glow group-hover:bg-brand-glow group-hover:shadow-glow-sm' +
                    (i < 4 ? ' lg:block' : '')
                  }
                />
                <motion.div whileHover={HOVER_LIFT} className="h-full">
                  <Link
                    to={dept.workspace ?? `/departments#${dept.id}`}
                    className="relative flex h-full flex-col overflow-hidden rounded-card border border-border-soft bg-surface-base p-6 transition-[border-color,box-shadow] duration-300 group-hover:border-border-brand group-hover:shadow-glow-md"
                  >
                    <img
                      src={`/departments/${dept.id}.webp`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={400}
                      className="pointer-events-none absolute inset-0 size-full [mask-image:linear-gradient(to_bottom_left,black,transparent_60%)] object-cover opacity-[0.18] transition-opacity duration-500 group-hover:opacity-35"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <div className="relative flex items-start justify-between">
                      <span className="flex size-12 items-center justify-center rounded-2xl border border-border-strong bg-surface-overlay transition-[transform,border-color,background-color] duration-300 group-hover:scale-110 group-hover:border-border-brand group-hover:bg-brand-primary/15">
                        <Icon
                          className="size-5.5 text-brand-soft transition-colors group-hover:text-brand-glow"
                          aria-hidden
                        />
                      </span>
                      <span className="text-caption text-text-muted tabular">0{i + 1}</span>
                    </div>
                    <h3 className="relative mt-5 text-h3 text-text-primary">{dept.nameTh}</h3>
                    <p className="relative text-caption tracking-[0.14em] text-text-muted uppercase">
                      {dept.nameEn}
                    </p>
                    <p className="relative mt-3 flex-1 text-label text-text-secondary">
                      {dept.purpose}
                    </p>
                    <ul className="relative mt-5 flex flex-wrap gap-1.5">
                      {dept.focus.map((f) => (
                        <li
                          key={f}
                          className="rounded-full border border-border-soft bg-surface-raised px-2.5 py-1 text-caption text-text-secondary"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                    <span className="relative mt-5 inline-flex items-center gap-1 text-caption font-medium text-brand-glow">
                      {dept.workspace ? 'ดูพื้นที่ทำงานเดโม' : 'ดูรายละเอียด'}
                      <ArrowUpRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </motion.div>
              </motion.li>
            );
          })}
          <motion.li
            variants={reveal}
            className="relative hidden overflow-hidden rounded-card border border-border-brand bg-gradient-to-br from-brand-deep/40 via-surface-base to-surface-base p-6 lg:flex lg:flex-col lg:justify-between"
          >
            <div
              aria-hidden
              className="absolute -right-10 -bottom-10 size-48 rounded-full border border-brand-glow/20"
            />
            <div
              aria-hidden
              className="absolute -right-2 -bottom-2 size-40 rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.22),transparent_70%)]"
            />
            <p className="relative eyebrow">One CORE</p>
            <p className="relative text-h3 text-text-primary">
              ทุกพื้นที่ทำงาน
              <br />
              ใช้ข้อมูลชุดเดียวกัน
            </p>
            <p className="relative text-label text-text-secondary">
              ตัวเลขของฝ่ายขาย คลัง จัดซื้อ และบัญชี มาจากเอกสารจริงชุดเดียว
              จึงไม่ต้องกระทบยอดข้ามแผนก
            </p>
          </motion.li>
        </motion.ul>
      </Container>
    </section>
  );
}

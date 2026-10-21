import { EyeOff, LogIn } from 'lucide-react';
import { Container, SectionHeader } from '@/components/ui/Section';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { ExecutivePreview, SalesPreview, WarehousePreview } from '../previews/DepartmentPreviews';

const ROLES = [
  {
    role: 'พนักงานคลังสินค้า',
    lands: 'เข้าสู่ “งานคลังวันนี้” ทันที',
    hidden: 'ต้นทุน ราคาขาย และยอดเงิน ไม่ถูกส่งมาจากเซิร์ฟเวอร์',
    Preview: WarehousePreview,
  },
  {
    role: 'เจ้าหน้าที่ฝ่ายขาย',
    lands: 'เข้าสู่สถานะคำสั่งซื้อของลูกค้า',
    hidden: 'ต้นทุนการจัดซื้อและข้อมูลการจ่ายเงินซัพพลายเออร์',
    Preview: SalesPreview,
  },
  {
    role: 'ผู้บริหาร',
    lands: 'เข้าสู่ศูนย์ควบคุมทั้งองค์กร',
    hidden: 'เห็นทุกแผนกในมุมมองอ่าน — แก้ไขข้อมูลแทนแผนกไม่ได้',
    Preview: ExecutivePreview,
  },
];

export function RoleWorkspaceSection() {
  return (
    <section aria-labelledby="role-title" className="relative py-24 sm:py-32">
      <Container>
        <SectionHeader
          id="role-title"
          eyebrow="Role-based workspace"
          title={
            <>
              เข้าสู่ระบบแล้ว{' '}
              <span className="text-gradient-brand">เห็นเฉพาะงานที่เป็นความรับผิดชอบของคุณ</span>
            </>
          }
          lead="ไม่ต้องเริ่มจากเมนูของทั้งบริษัทแล้วค่อยหาแผนกของตัวเอง — ระบบพาคุณเข้าสู่พื้นที่ทำงานของบทบาทคุณโดยตรง และข้อมูลที่ไม่เกี่ยวข้องจะไม่ถูกส่งมาที่หน้าจอเลย"
        />

        <Reveal
          stagger
          className="-mx-4 mt-14 no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0"
        >
          {ROLES.map(({ role, lands, hidden, Preview }) => (
            <RevealItem
              key={role}
              className="flex w-[86vw] max-w-[26rem] shrink-0 snap-center flex-col lg:w-auto lg:max-w-none"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full border border-border-brand bg-brand-primary/10">
                  <LogIn className="size-4 text-brand-glow" aria-hidden />
                </span>
                <div>
                  <p className="text-label font-semibold text-text-primary">{role}</p>
                  <p className="text-caption text-text-muted">{lands}</p>
                </div>
              </div>
              <Preview className="flex-1" />
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-border-soft bg-surface-raised/40 px-3.5 py-3 text-caption text-text-secondary">
                <EyeOff className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden />
                {hidden}
              </p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

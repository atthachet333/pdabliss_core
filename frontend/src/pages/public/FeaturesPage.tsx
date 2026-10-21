import { Boxes, FileStack, GitBranch, Layers, LayoutDashboard, Lock } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Container, SectionHeader } from '@/components/ui/Section';
import { SAFEGUARDS } from '@/features/landing/safeguards';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';

const GROUPS = [
  {
    icon: LayoutDashboard,
    title: 'พื้นที่ทำงานรายแผนก',
    items: ['แดชบอร์ดที่ออกแบบตามหน้าที่', 'เมนูเฉพาะของแผนก', 'รายการงานที่ต้องทำต่อ'],
  },
  {
    icon: GitBranch,
    title: 'เวิร์กโฟลว์เอกสาร',
    items: ['สถานะเฉพาะของเอกสารแต่ละประเภท', 'การอนุมัติหลายขั้น', 'ส่งต่องานข้ามแผนกอัตโนมัติ'],
  },
  {
    icon: Boxes,
    title: 'คลังสินค้าและล็อต',
    items: ['รับสินค้าตาม PO พร้อม QC', 'ล็อต / วันผลิต / วันหมดอายุ', 'จ่ายตามหลัก FEFO'],
  },
  {
    icon: FileStack,
    title: 'เอกสารเชื่อมโยงกัน',
    items: ['Customer PO → SO → WO', 'PR → PO → GR → การจ่ายเงิน', 'แนบไฟล์ต้นฉบับ'],
  },
  {
    icon: Lock,
    title: 'สิทธิ์และความปลอดภัย',
    items: ['สิทธิ์ตามบทบาทและแผนก', 'สิทธิ์ระดับข้อมูลแต่ละรายการ', 'ข้อมูลราคาไม่ถูกส่งให้ผู้ไม่มีสิทธิ์'],
  },
  {
    icon: Layers,
    title: 'ภาพรวมผู้บริหาร',
    items: ['KPI ทั้งองค์กร', 'Exception Center', 'เจาะลึกรายแผนก'],
  },
];

export default function FeaturesPage() {
  usePageMeta('ฟีเจอร์', 'ฟีเจอร์ของ PDA BLISS CORE: พื้นที่ทำงานรายแผนก เวิร์กโฟลว์เอกสาร ล็อตและวันหมดอายุ การอนุมัติ และ audit trail');
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="ความสามารถที่ออกแบบมาเพื่องานปฏิบัติการจริง"
        lead="ทุกฟีเจอร์ตอบคำถามเดียวกัน: แต่ละคนรู้ไหมว่าต้องทำอะไรต่อ และระบบช่วยกันความผิดพลาดได้หรือยัง"
      />
      <Container className="pb-12">
        <Reveal stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map(({ icon: Icon, title, items }) => (
            <RevealItem key={title} className="rounded-card border border-border-soft bg-surface-base/80 p-6">
              <Icon className="size-6 text-brand-glow" aria-hidden />
              <h2 className="mt-4 text-h3 text-text-primary">{title}</h2>
              <ul className="mt-3 space-y-1.5 text-label text-text-secondary">
                {items.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
      <Container className="py-20">
        <SectionHeader eyebrow="Safeguards" title="กลไกป้องกันความผิดพลาด" />
        <Reveal stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SAFEGUARDS.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title} className="rounded-2xl border border-border-soft bg-surface-raised/40 p-5">
              <Icon className="size-5 text-brand-glow" aria-hidden />
              <h3 className="mt-3 text-label font-semibold text-text-primary">{title}</h3>
              <p className="mt-1.5 text-label text-text-secondary">{body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </>
  );
}

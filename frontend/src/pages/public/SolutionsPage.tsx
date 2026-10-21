import { Factory, PackageSearch, Truck } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { LinkButton } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';

const SCENARIOS = [
  {
    icon: Factory,
    title: 'ธุรกิจผลิตตามคำสั่งซื้อ',
    problem: 'ฝ่ายขายไม่รู้ว่างานผลิตถึงไหน ต้องโทรถามฝ่ายปฏิบัติการทุกวัน',
    flow: 'Customer PO → Sales Order → Work Order → รับเข้าคลัง → จัดส่ง',
    outcome: 'ฝ่ายขายเห็นความคืบหน้าของใบสั่งงานที่ผูกกับคำสั่งซื้อของลูกค้าโดยตรง',
  },
  {
    icon: PackageSearch,
    title: 'ธุรกิจที่มีสินค้ามีวันหมดอายุ',
    problem: 'สินค้าหมดอายุค้างคลังเพราะไม่มีใครเห็นล่วงหน้า และจ่ายล็อตผิดลำดับ',
    flow: 'รับสินค้า → บันทึกล็อตและวันหมดอายุ → จ่ายตาม FEFO → แจ้งเตือนล่วงหน้า',
    outcome: 'คลังเห็นล็อตที่ต้องจ่ายก่อน และระบบไม่อนุญาตให้จ่ายล็อตที่หมดอายุแล้ว',
  },
  {
    icon: Truck,
    title: 'ธุรกิจที่จัดซื้อบ่อยและมีมัดจำ',
    problem: 'จ่ายเงินซัพพลายเออร์ก่อนรับของครบ หรือเอกสารไม่ครบเมื่อถึงเวลาจ่าย',
    flow: 'PR → อนุมัติ → PO → มัดจำ → รับสินค้า (GR) → จ่ายส่วนที่เหลือ',
    outcome: 'บัญชีจ่ายได้เมื่อมีการอนุมัติและเอกสารอ้างอิงครบเท่านั้น',
  },
];

export default function SolutionsPage() {
  usePageMeta('โซลูชัน', 'ตัวอย่างการใช้ PDA BLISS CORE ในธุรกิจผลิตตามคำสั่งซื้อ ธุรกิจสินค้ามีวันหมดอายุ และธุรกิจที่จัดซื้อบ่อย');
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="ปัญหาเดิมระหว่างแผนก แก้ได้ด้วยแกนเดียวกัน"
        lead="ตัวอย่างสถานการณ์ที่ CORE ออกแบบมาเพื่อรองรับ — รายละเอียดจริงปรับตามกระบวนการของแต่ละธุรกิจ"
      />
      <Container className="pb-24">
        <Reveal stagger className="grid gap-5 lg:grid-cols-3">
          {SCENARIOS.map(({ icon: Icon, title, problem, flow, outcome }) => (
            <RevealItem key={title} className="flex flex-col rounded-card border border-border-soft bg-surface-base/80 p-6 sm:p-7">
              <Icon className="size-7 text-brand-glow" aria-hidden />
              <h2 className="mt-5 text-h3 text-text-primary">{title}</h2>
              <dl className="mt-5 flex-1 space-y-4 text-label">
                <div>
                  <dt className="text-caption font-semibold tracking-[0.14em] text-warning uppercase">ปัญหา</dt>
                  <dd className="mt-1 text-text-secondary">{problem}</dd>
                </div>
                <div>
                  <dt className="text-caption font-semibold tracking-[0.14em] text-info uppercase">เส้นทางงาน</dt>
                  <dd className="mt-1 text-text-primary">{flow}</dd>
                </div>
                <div>
                  <dt className="text-caption font-semibold tracking-[0.14em] text-success uppercase">ผลลัพธ์</dt>
                  <dd className="mt-1 text-text-secondary">{outcome}</dd>
                </div>
              </dl>
            </RevealItem>
          ))}
        </Reveal>
        <div className="mt-12 flex justify-center">
          <LinkButton to="/contact" size="lg">
            ปรึกษาการวางระบบ
          </LinkButton>
        </div>
      </Container>
    </>
  );
}

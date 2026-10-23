import { Factory, PackageSearch, Truck } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { LinkButton } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';

const ICONS = [Factory, PackageSearch, Truck];

const th = {
  metaTitle: 'โซลูชัน',
  metaDescription:
    'ตัวอย่างการใช้ PDA BLISS CORE ในธุรกิจผลิตตามคำสั่งซื้อ ธุรกิจสินค้ามีวันหมดอายุ และธุรกิจที่จัดซื้อบ่อย',
  title: 'ปัญหาเดิมระหว่างแผนก แก้ได้ด้วยแกนเดียวกัน',
  lead: 'ตัวอย่างสถานการณ์ที่ CORE ออกแบบมาเพื่อรองรับ — รายละเอียดจริงปรับตามกระบวนการของแต่ละธุรกิจ',
  problem: 'ปัญหา',
  flow: 'เส้นทางงาน',
  outcome: 'ผลลัพธ์',
  cta: 'ปรึกษาการวางระบบ',
  scenarios: [
    {
      title: 'ธุรกิจผลิตตามคำสั่งซื้อ',
      problem: 'ฝ่ายขายไม่รู้ว่างานผลิตถึงไหน ต้องโทรถามฝ่ายปฏิบัติการทุกวัน',
      flow: 'Customer PO → Sales Order → Work Order → รับเข้าคลัง → จัดส่ง',
      outcome: 'ฝ่ายขายเห็นความคืบหน้าของใบสั่งงานที่ผูกกับคำสั่งซื้อของลูกค้าโดยตรง',
    },
    {
      title: 'ธุรกิจที่มีสินค้ามีวันหมดอายุ',
      problem: 'สินค้าหมดอายุค้างคลังเพราะไม่มีใครเห็นล่วงหน้า และจ่ายล็อตผิดลำดับ',
      flow: 'รับสินค้า → บันทึกล็อตและวันหมดอายุ → จ่ายตาม FEFO → แจ้งเตือนล่วงหน้า',
      outcome: 'คลังเห็นล็อตที่ต้องจ่ายก่อน และระบบไม่อนุญาตให้จ่ายล็อตที่หมดอายุแล้ว',
    },
    {
      title: 'ธุรกิจที่จัดซื้อบ่อยและมีมัดจำ',
      problem: 'จ่ายเงินซัพพลายเออร์ก่อนรับของครบ หรือเอกสารไม่ครบเมื่อถึงเวลาจ่าย',
      flow: 'PR → อนุมัติ → PO → มัดจำ → รับสินค้า (GR) → จ่ายส่วนที่เหลือ',
      outcome: 'บัญชีจ่ายได้เมื่อมีการอนุมัติและเอกสารอ้างอิงครบเท่านั้น',
    },
  ],
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    metaTitle: 'Solutions',
    metaDescription:
      'How PDA BLISS CORE supports make-to-order businesses, businesses with expiring stock, and businesses that purchase frequently.',
    title: 'Old problems between departments, solved on one shared core',
    lead: 'Example situations CORE is designed to support — real details adapt to each business’s processes.',
    problem: 'Problem',
    flow: 'Work route',
    outcome: 'Outcome',
    cta: 'Discuss your system setup',
    scenarios: [
      {
        title: 'Make-to-order businesses',
        problem: 'Sales doesn’t know where production stands and has to call Operations every day.',
        flow: 'Customer PO → Sales Order → Work Order → Warehouse receipt → Delivery',
        outcome: 'Sales sees the progress of work orders linked directly to each customer order.',
      },
      {
        title: 'Businesses with expiring stock',
        problem: 'Expired stock sits in the warehouse because nobody saw it coming, and lots are dispatched out of order.',
        flow: 'Receive goods → Record lots and expiry dates → Dispatch by FEFO → Early warnings',
        outcome: 'The warehouse sees which lots to dispatch first, and the system does not allow expired lots to go out.',
      },
      {
        title: 'Businesses that buy often and pay deposits',
        problem: 'Suppliers are paid before goods are fully received, or documents are missing when payment is due.',
        flow: 'PR → Approval → PO → Deposit → Goods receipt (GR) → Balance payment',
        outcome: 'Accounting can pay only when approvals and reference documents are complete.',
      },
    ],
  },
  'zh-CN': {
    metaTitle: '解决方案',
    metaDescription: 'PDA BLISS CORE 在按订单生产、有保质期商品及频繁采购的企业中的应用示例。',
    title: '部门之间的老问题，用同一个核心来解决',
    lead: 'CORE 在设计上支持的示例场景——实际细节会根据每家企业的流程进行调整。',
    problem: '问题',
    flow: '工作路径',
    outcome: '结果',
    cta: '咨询系统规划',
    scenarios: [
      {
        title: '按订单生产的企业',
        problem: '销售部不知道生产进行到哪里，每天都要打电话问运营部。',
        flow: 'Customer PO → 销售订单 → 工单 → 入库 → 发货',
        outcome: '销售部可直接看到与客户订单关联的工单进度。',
      },
      {
        title: '经营有保质期商品的企业',
        problem: '过期商品积压在仓库，因为没人提前看到，而且批次出库顺序错误。',
        flow: '收货 → 记录批次与到期日 → 按 FEFO 出库 → 提前预警',
        outcome: '仓库清楚哪些批次应先出库，系统也不允许发出已过期的批次。',
      },
      {
        title: '频繁采购并支付定金的企业',
        problem: '货未收齐就付款给供应商，或到付款时单据不全。',
        flow: 'PR → 审批 → PO → 定金 → 收货（GR）→ 支付尾款',
        outcome: '只有在审批与参考单据齐全时，财务才能付款。',
      },
    ],
  },
};

export default function SolutionsPage() {
  const c = useCopy(COPY);
  const { href } = useLocale();
  usePageMeta(c.metaTitle, c.metaDescription);
  return (
    <>
      <PageHero eyebrow="Solutions" title={c.title} lead={c.lead} />
      <Container className="pb-24">
        <Reveal stagger className="grid gap-5 lg:grid-cols-3">
          {c.scenarios.map(({ title, problem, flow, outcome }, i) => {
            const Icon = ICONS[i]!;
            return (
              <RevealItem
                key={i}
                className="flex flex-col rounded-card border border-border-soft bg-surface-base/80 p-6 sm:p-7"
              >
                <Icon className="size-7 text-brand-glow" aria-hidden />
                <h2 className="mt-5 text-h3 text-text-primary">{title}</h2>
                <dl className="mt-5 flex-1 space-y-4 text-label">
                  <div>
                    <dt className="text-caption font-semibold text-warning">{c.problem}</dt>
                    <dd className="mt-1 text-text-secondary">{problem}</dd>
                  </div>
                  <div>
                    <dt className="text-caption font-semibold text-info">{c.flow}</dt>
                    <dd className="mt-1 text-text-primary">{flow}</dd>
                  </div>
                  <div>
                    <dt className="text-caption font-semibold text-success">{c.outcome}</dt>
                    <dd className="mt-1 text-text-secondary">{outcome}</dd>
                  </div>
                </dl>
              </RevealItem>
            );
          })}
        </Reveal>
        <div className="mt-12 flex justify-center">
          <LinkButton to={href('/contact')} size="lg">
            {c.cta}
          </LinkButton>
        </div>
      </Container>
    </>
  );
}

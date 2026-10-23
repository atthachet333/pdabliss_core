import { Boxes, FileStack, GitBranch, Layers, LayoutDashboard, Lock } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Container, SectionHeader } from '@/components/ui/Section';
import { useSafeguards } from '@/features/landing/safeguards';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';

const ICONS = [LayoutDashboard, GitBranch, Boxes, FileStack, Lock, Layers];

const th = {
  metaTitle: 'ฟีเจอร์',
  metaDescription:
    'ฟีเจอร์ของ PDA BLISS CORE: พื้นที่ทำงานรายแผนก เวิร์กโฟลว์เอกสาร ล็อตและวันหมดอายุ การอนุมัติ และ audit trail',
  title: 'ความสามารถที่ออกแบบมาเพื่องานปฏิบัติการจริง',
  lead: 'ทุกฟีเจอร์ตอบคำถามเดียวกัน: แต่ละคนรู้ไหมว่าต้องทำอะไรต่อ และระบบช่วยกันความผิดพลาดได้หรือยัง',
  groups: [
    {
      title: 'พื้นที่ทำงานรายแผนก',
      items: ['แดชบอร์ดที่ออกแบบตามหน้าที่', 'เมนูเฉพาะของแผนก', 'รายการงานที่ต้องทำต่อ'],
    },
    {
      title: 'เวิร์กโฟลว์เอกสาร',
      items: ['สถานะเฉพาะของเอกสารแต่ละประเภท', 'การอนุมัติหลายขั้น', 'ส่งต่องานข้ามแผนกอัตโนมัติ'],
    },
    {
      title: 'คลังสินค้าและล็อต',
      items: ['รับสินค้าตาม PO พร้อม QC', 'ล็อต / วันผลิต / วันหมดอายุ', 'จ่ายตามหลัก FEFO'],
    },
    {
      title: 'เอกสารเชื่อมโยงกัน',
      items: ['Customer PO → SO → WO', 'PR → PO → GR → การจ่ายเงิน', 'แนบไฟล์ต้นฉบับ'],
    },
    {
      title: 'สิทธิ์และความปลอดภัย',
      items: [
        'สิทธิ์ตามบทบาทและแผนก',
        'สิทธิ์ระดับข้อมูลแต่ละรายการ',
        'ข้อมูลราคาไม่ถูกส่งให้ผู้ไม่มีสิทธิ์',
      ],
    },
    { title: 'ภาพรวมผู้บริหาร', items: ['KPI ทั้งองค์กร', 'Exception Center', 'เจาะลึกรายแผนก'] },
  ],
  safeguards: 'กลไกป้องกันความผิดพลาด',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    metaTitle: 'Features',
    metaDescription:
      'PDA BLISS CORE features: department workspaces, document workflows, lots and expiry dates, approvals and an audit trail.',
    title: 'Capabilities designed for real operational work',
    lead: 'Every feature answers the same questions: does each person know what to do next, and does the system help prevent mistakes?',
    groups: [
      {
        title: 'Department workspaces',
        items: ['Dashboards designed around each role', 'Department-specific menus', 'A list of what to do next'],
      },
      {
        title: 'Document workflows',
        items: ['Status flows for each document type', 'Multi-step approvals', 'Automatic handoffs across departments'],
      },
      {
        title: 'Warehouse and lots',
        items: ['Receive against POs with QC', 'Lot / production date / expiry date', 'Dispatch by FEFO'],
      },
      {
        title: 'Linked documents',
        items: ['Customer PO → SO → WO', 'PR → PO → GR → Payment', 'Attach original files'],
      },
      {
        title: 'Permissions and security',
        items: ['Permissions by role and department', 'Record-level permissions', 'Price data never sent to people without access'],
      },
      {
        title: 'Executive overview',
        items: ['Company-wide KPIs', 'Exception Center', 'Department drill-down'],
      },
    ],
    safeguards: 'Mistake-prevention safeguards',
  },
  'zh-CN': {
    metaTitle: '功能',
    metaDescription: 'PDA BLISS CORE 功能：部门工作空间、单据工作流、批次与保质期、审批以及审计记录。',
    title: '为真实运营工作而设计的能力',
    lead: '每一项功能都回答同样的问题：每个人是否知道下一步该做什么？系统是否在帮助预防错误？',
    groups: [
      { title: '部门工作空间', items: ['按岗位设计的仪表板', '部门专属菜单', '待办工作清单'] },
      { title: '单据工作流', items: ['各类单据专属的状态流转', '多级审批', '跨部门自动交接'] },
      { title: '仓库与批次', items: ['按采购单收货并质检', '批次 / 生产日期 / 到期日', '按 FEFO 出库'] },
      { title: '单据关联', items: ['Customer PO → SO → WO', 'PR → PO → GR → 付款', '附加原始文件'] },
      { title: '权限与安全', items: ['按角色与部门设定权限', '记录级权限', '价格数据不发送给无权限者'] },
      { title: '管理层概览', items: ['全公司 KPI', '例外中心', '部门深入查看'] },
    ],
    safeguards: '错误预防机制',
  },
};

export default function FeaturesPage() {
  const c = useCopy(COPY);
  const safeguards = useSafeguards();
  usePageMeta(c.metaTitle, c.metaDescription);
  return (
    <>
      <PageHero eyebrow="Features" title={c.title} lead={c.lead} />
      <Container className="pb-12">
        <Reveal stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.groups.map(({ title, items }, gi) => {
            const Icon = ICONS[gi]!;
            return (
              <RevealItem
                key={gi}
                className="rounded-card border border-border-soft bg-surface-base/80 p-6"
              >
                <Icon className="size-6 text-brand-glow" aria-hidden />
                <h2 className="mt-4 text-h3 text-text-primary">{title}</h2>
                <ul className="mt-3 space-y-1.5 text-label text-text-secondary">
                  {items.map((i) => (
                    <li key={i}>• {i}</li>
                  ))}
                </ul>
              </RevealItem>
            );
          })}
        </Reveal>
      </Container>
      <Container className="py-20">
        <SectionHeader eyebrow="Safeguards" title={c.safeguards} />
        <Reveal stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {safeguards.map(({ icon: Icon, title, body }) => (
            <RevealItem
              key={title}
              className="rounded-2xl border border-border-soft bg-surface-raised/40 p-5"
            >
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

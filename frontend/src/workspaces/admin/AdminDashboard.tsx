import {
  Building2,
  Check,
  GitBranch,
  KeyRound,
  Lock,
  Minus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  KpiTile,
  PageTitle,
  Panel,
  StatusPill,
  TableWrap,
  td,
  th,
} from '@/components/app/primitives';
import { cn } from '@/lib/cn';

/* EP00 mock data — System Admin. Admin configures access; the backend enforces it. */

const USERS = [
  {
    name: 'คุณวรเชษฐ์',
    email: 'worachet@example.co.th',
    dept: 'ผู้บริหาร',
    role: 'Executive',
    active: true,
  },
  {
    name: 'คุณพิมพ์ชนก',
    email: 'pimchanok@example.co.th',
    dept: 'ฝ่ายขาย',
    role: 'Sales Staff',
    active: true,
  },
  {
    name: 'คุณธนากร',
    email: 'thanakorn@example.co.th',
    dept: 'คลังสินค้า',
    role: 'Warehouse Lead',
    active: true,
  },
  {
    name: 'คุณณัฐวดี',
    email: 'nattawadee@example.co.th',
    dept: 'จัดซื้อ',
    role: 'Purchasing Officer',
    active: true,
  },
  {
    name: 'คุณกานต์ธิดา',
    email: 'kanthida@example.co.th',
    dept: 'บัญชี',
    role: 'Accountant',
    active: true,
  },
  {
    name: 'คุณอนุชา',
    email: 'anucha@example.co.th',
    dept: 'คลังสินค้า',
    role: 'Warehouse Staff',
    active: false,
  },
];

const CAPABILITIES = [
  'ราคาขาย',
  'ต้นทุนจัดซื้อ',
  'ยอดเงินบัญชี',
  'อนุมัติ PR',
  'รับสินค้า',
  'บันทึกจ่ายเงิน',
] as const;

const MATRIX: { role: string; grants: boolean[] }[] = [
  { role: 'Executive', grants: [true, true, true, true, false, false] },
  { role: 'Sales Staff', grants: [true, false, false, false, false, false] },
  { role: 'Warehouse Lead', grants: [false, false, false, false, true, false] },
  { role: 'Purchasing Officer', grants: [false, true, false, true, false, false] },
  { role: 'Accountant', grants: [false, true, true, false, false, true] },
];

const PR_STATES = ['draft', 'submitted', 'approved', 'converted'];

export default function AdminDashboard() {
  return (
    <>
      <PageTitle
        title="ผู้ดูแลระบบ"
        subtitle="ผู้ใช้ บทบาท สิทธิ์ และเวิร์กโฟลว์ของบริษัทในพื้นที่ทำงานนี้"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile label="ผู้ใช้งาน" value="42" icon={Users} hint="ใช้งานอยู่ 39 · ระงับ 3" />
        <KpiTile label="บทบาท" value="11" icon={KeyRound} hint="มาตรฐาน 7 · กำหนดเอง 4" />
        <KpiTile
          label="เวิร์กโฟลว์เอกสาร"
          value="1"
          icon={GitBranch}
          tone="brand"
          hint="Purchase Request (EP00)"
        />
        <KpiTile label="บริษัท" value="1" icon={Building2} hint="1 พื้นที่ทำงาน = 1 บริษัท" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="ผู้ใช้งาน" subtitle="แผนกหลักกำหนดพื้นที่ทำงานที่ผู้ใช้จะเข้าสู่หลังล็อกอิน">
          <TableWrap label="ตารางผู้ใช้งาน">
            <table className="w-full min-w-[38rem]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th scope="col" className={th}>
                    ชื่อ
                  </th>
                  <th scope="col" className={th}>
                    แผนกหลัก
                  </th>
                  <th scope="col" className={th}>
                    บทบาท
                  </th>
                  <th scope="col" className={th}>
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.email} className="border-b border-border-soft last:border-0">
                    <td className={td}>
                      <span className="block font-medium">{u.name}</span>
                      <span className="text-caption text-text-muted">{u.email}</span>
                    </td>
                    <td className={td}>{u.dept}</td>
                    <td className={cn(td, 'text-text-secondary')}>{u.role}</td>
                    <td className={td}>
                      <StatusPill tone={u.active ? 'success' : 'neutral'}>
                        {u.active ? 'ใช้งาน' : 'ระงับ'}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>

        <Panel
          title="เวิร์กโฟลว์: Purchase Request"
          subtitle="ตรงกับ state machine ที่เซิร์ฟเวอร์บังคับใช้"
        >
          <ol className="flex flex-wrap items-center gap-2">
            {PR_STATES.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="rounded-lg border border-border-brand bg-brand-primary/10 px-2.5 py-1 font-mono text-caption text-brand-soft">
                  {s}
                </span>
                {i < PR_STATES.length - 1 && (
                  <span aria-hidden className="text-text-muted">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          <ul className="mt-5 space-y-2.5 text-label text-text-secondary">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-glow" aria-hidden />
              ส่ง PR ได้เมื่อมีอย่างน้อย 1 รายการ
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-glow" aria-hidden />
              ผู้ขออนุมัติ PR ของตัวเองไม่ได้
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-glow" aria-hidden />
              ไม่อนุมัติ / ยกเลิก ต้องระบุเหตุผลเสมอ
            </li>
          </ul>
        </Panel>
      </div>

      <Panel
        title="สิทธิ์การเห็นข้อมูลตามบทบาท"
        subtitle="ข้อมูลที่ไม่มีสิทธิ์จะไม่ถูกส่งออกจาก API — ไม่ใช่แค่ซ่อนบนหน้าจอ"
        className="mt-5"
      >
        <TableWrap label="ตารางสิทธิ์ตามบทบาท">
          <table className="w-full min-w-[44rem]">
            <thead>
              <tr className="border-b border-border-soft">
                <th scope="col" className={th}>
                  บทบาท
                </th>
                {CAPABILITIES.map((c) => (
                  <th key={c} scope="col" className={cn(th, 'text-center')}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.role} className="border-b border-border-soft last:border-0">
                  <th scope="row" className={cn(td, 'text-left font-medium')}>
                    {row.role}
                  </th>
                  {row.grants.map((g, i) => (
                    <td key={CAPABILITIES[i]} className={cn(td, 'text-center')}>
                      {g ? (
                        <Check className="mx-auto size-4 text-success" aria-label="อนุญาต" />
                      ) : row.role.startsWith('Warehouse') && i < 3 ? (
                        <Lock
                          className="mx-auto size-4 text-text-muted"
                          aria-label="ไม่อนุญาต (ข้อมูลราคา)"
                        />
                      ) : (
                        <Minus
                          className="mx-auto size-4 text-text-muted/50"
                          aria-label="ไม่อนุญาต"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
    </>
  );
}

import { UserPlus } from 'lucide-react';
import {
  Button,
  DataTable,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PrototypeTag,
  SectionHeader,
  type Column,
} from '@/components/core';
import { WORKSPACE_ORDER } from '../registry';
import { ROLES } from './data';
import { DepartmentList, RoleGrid } from './parts';

const USER_COLUMNS: Column<never>[] = ['ผู้ใช้', 'สถานะ', 'แผนกหลัก', 'บทบาท', 'เข้าใช้ล่าสุด'].map(
  (header, i) => ({
    id: `u${i}`,
    header,
    priority: i === 0 ? 'primary' : i === 1 ? 'status' : i === 4 ? 'medium' : 'high',
    cell: () => null,
  }),
);

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="ผู้ใช้ แผนก และบทบาท"
        description="หนึ่งพื้นที่ทำงาน CORE สำหรับหนึ่งบริษัท — ผู้ดูแลระบบไม่ใช่ผู้บริหาร"
        actions={
          <Button variant="primary" icon={UserPlus} soon>
            เชิญผู้ใช้
          </Button>
        }
      />

      <section aria-labelledby="admin-summary" className="mb-10">
        <SectionHeader id="admin-summary" title="การตั้งค่าปัจจุบัน" />
        <KpiGrid columns={3}>
          <Kpi label="ผู้ใช้งาน" value={0} unit="คน" supporting="เปิดใช้พร้อมระบบยืนยันตัวตนจริง" />
          <Kpi
            label="แผนก"
            value={WORKSPACE_ORDER.length}
            unit="แผนก"
            supporting="แผนกมาตรฐานของ CORE"
          />
          <Kpi label="บทบาท" value={ROLES.length} unit="บทบาท" supporting="โครงร่าง" />
        </KpiGrid>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          flush
          title="ผู้ใช้งาน"
          description="ผู้ใช้แต่ละคนมีแผนกหลัก เข้าสู่ระบบแล้วเปิดพื้นที่ทำงานนั้นทันที"
        >
          <DataTable
            label="ผู้ใช้งาน"
            columns={USER_COLUMNS}
            rows={[]}
            getRowId={() => ''}
            empty={
              <div className="border-t border-line">
                <EmptyState
                  icon={UserPlus}
                  title="ยังไม่มีผู้ใช้ในระบบ"
                  description="การเชิญผู้ใช้จะเปิดใช้พร้อมระบบยืนยันตัวตนจริง บัญชีทดลอง user1 ใช้สำหรับตรวจต้นแบบเท่านั้นและไม่ได้ถูกบันทึกเป็นผู้ใช้"
                />
              </div>
            }
          />
        </Panel>

        <Panel flush title="แผนก" description="รหัสแผนกเป็นตัวระบุภายใน ไม่ใช่ชื่อที่แสดง">
          <div className="border-t border-line">
            <DepartmentList />
          </div>
        </Panel>
      </div>

      <section aria-labelledby="admin-roles" className="mt-10">
        <SectionHeader
          id="admin-roles"
          title="บทบาท"
          aside={<PrototypeTag>โครงร่าง — สิทธิ์ละเอียดกำหนดในรอบถัดไป</PrototypeTag>}
        />
        <RoleGrid />
      </section>
    </>
  );
}

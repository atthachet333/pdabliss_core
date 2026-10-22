import { PageHeader, SampleTag } from '@/components/core';
import { WORKSPACES, workspacePath } from '../registry';
import { DepartmentGrid } from './DepartmentGrid';

export default function ExecutiveDepartmentsPage() {
  const item = WORKSPACES.executive.nav.find((n) => n.path === 'departments')!;
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'ผู้บริหาร', to: workspacePath('executive') }, { label: item.label }]}
        title="สรุปรายแผนก"
        description={item.summary}
        status={<SampleTag />}
      />
      <DepartmentGrid />
      <p className="mt-6 text-caption text-fg-muted">
        การเข้าดูพื้นที่ทำงานของแผนกจากที่นี่ใช้สำหรับตรวจต้นแบบ — ในระบบจริง
        สิทธิ์ของผู้บริหารแต่ละคนจะกำหนดโดยผู้ดูแลระบบ
      </p>
    </>
  );
}

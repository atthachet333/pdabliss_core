import { useState } from 'react';
import {
  Button,
  FormActions,
  FormField,
  FormGrid,
  FormSection,
  PageHeader,
  Panel,
  PrototypeTag,
  Select,
  Switch,
  TextInput,
} from '@/components/core';
import { WORKSPACES, workspacePath } from '../registry';
import { DepartmentList, RoleGrid } from './parts';

function header(path: string) {
  const item = WORKSPACES.admin.nav.find((n) => n.path === path)!;
  return {
    breadcrumb: [{ label: 'ผู้ดูแลระบบ', to: workspacePath('admin') }, { label: item.label }],
    title: item.label,
    description: item.summary,
  };
}

export function AdminDepartmentsPage() {
  return (
    <>
      <PageHeader {...header('departments')} />
      <Panel flush>
        <DepartmentList />
      </Panel>
    </>
  );
}

export function AdminRolesPage() {
  return (
    <>
      <PageHeader {...header('roles')} status={<PrototypeTag>โครงร่าง</PrototypeTag>} />
      <RoleGrid />
    </>
  );
}

/**
 * Settings — the form system in a real context. Values are local to this page
 * and never saved: there is no persistence in the prototype.
 */
export function AdminSettingsPage() {
  const [notify, setNotify] = useState({ exceptions: true, approvals: true, digest: false });
  return (
    <>
      <PageHeader {...header('settings')} status={<PrototypeTag>ไม่บันทึกค่า</PrototypeTag>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="ข้อมูลบริษัท" description="ใช้บนหัวเอกสารทุกฉบับ">
          <div className="space-y-8">
            <FormSection title="ข้อมูลทั่วไป">
              <FormGrid>
                <FormField label="ชื่อบริษัท" required readOnly className="sm:col-span-2">
                  <TextInput defaultValue="บริษัทตัวอย่าง จำกัด" />
                </FormField>
                <FormField
                  label="เลขประจำตัวผู้เสียภาษี"
                  readOnly
                  help="แก้ไขได้เมื่อเชื่อมข้อมูลบริษัทจริง"
                >
                  <TextInput defaultValue="0000000000000" inputMode="numeric" />
                </FormField>
                <FormField label="สกุลเงินหลัก" disabled>
                  <Select options={[{ value: 'THB', label: 'บาท (THB)' }]} defaultValue="THB" />
                </FormField>
              </FormGrid>
            </FormSection>
            <FormSection
              title="รูปแบบเลขที่เอกสาร"
              description="ตัวอย่างการแสดงผล — ยังไม่ใช้กับเอกสารจริง"
            >
              <FormGrid>
                <FormField label="ใบสั่งซื้อ (PO)">
                  <TextInput defaultValue="PO-{ปี}{เดือน}-{ลำดับ}" />
                </FormField>
                <FormField label="ใบสั่งขาย (SO)">
                  <TextInput defaultValue="SO-{ปี}{เดือน}-{ลำดับ}" />
                </FormField>
              </FormGrid>
            </FormSection>
            <FormActions>
              <Button variant="ghost">ยกเลิก</Button>
              <Button variant="primary" soon>
                บันทึก
              </Button>
            </FormActions>
          </div>
        </Panel>

        <Panel title="การแจ้งเตือน" description="ค่าเริ่มต้นของพื้นที่ทำงาน">
          <div className="space-y-5">
            <Switch
              label="Exception ทุกแผนก"
              description="แจ้งผู้บริหารเมื่อมีเอกสารผิดไปจากแผน"
              checked={notify.exceptions}
              onChange={(v) => setNotify((s) => ({ ...s, exceptions: v }))}
            />
            <Switch
              label="รายการรออนุมัติ"
              description="แจ้งผู้มีสิทธิ์อนุมัติทันที"
              checked={notify.approvals}
              onChange={(v) => setNotify((s) => ({ ...s, approvals: v }))}
            />
            <Switch
              label="สรุปประจำวัน"
              description="ส่งสรุปงานค้างทุกเช้า"
              checked={notify.digest}
              onChange={(v) => setNotify((s) => ({ ...s, digest: v }))}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

import { Download, FileText, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ActivityFeed,
  Badge,
  Button,
  CardSkeleton,
  Checkbox,
  ConfirmDialog,
  CountBadge,
  DataTable,
  DateInput,
  Drawer,
  EMPTY_COPY,
  EmptyState,
  ErrorState,
  ExceptionList,
  FileDrop,
  FilterChip,
  FormActions,
  FormField,
  FormGrid,
  IconButton,
  Kpi,
  KpiGrid,
  KpiSkeleton,
  Modal,
  NumberInput,
  OverflowMenu,
  PageHeader,
  PageSkeleton,
  Pagination,
  Panel,
  ProgressBar,
  PrototypeTag,
  RadioGroup,
  RecordHeader,
  RecordLayout,
  RecordSection,
  RelatedDocuments,
  SampleTag,
  SearchableSelect,
  SearchField,
  SectionHeader,
  Select,
  STATUS_META,
  STATUS_ORDER,
  StatusBadge,
  SummaryList,
  Switch,
  TableSkeleton,
  TableToolbar,
  Tabs,
  TaskList,
  Textarea,
  TextInput,
  WorkflowTimeline,
  type Column,
  type SortState,
  type Status,
} from '@/components/core';
import { cn } from '@/lib/cn';
import { WORKSPACE_ORDER, WORKSPACES } from '@/workspaces/registry';
import { LAB_DOCS, LAB_EXCEPTIONS, LAB_STEPS, LAB_TASKS, type LabDoc } from './samples';

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['buttons', 'Buttons'],
  ['status', 'Status'],
  ['forms', 'Forms'],
  ['kpi', 'KPI & Cards'],
  ['table', 'Table'],
  ['empty', 'Empty'],
  ['loading', 'Loading'],
  ['errors', 'Errors'],
  ['timeline', 'Timeline'],
  ['work', 'Tasks & Exceptions'],
  ['overlays', 'Modal & Drawer'],
  ['record', 'Record detail'],
] as const;

function LabSection({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="scroll-mt-24 border-t border-line pt-10 pb-4"
    >
      <SectionHeader id={`${id}-h`} title={title} description={note} />
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Swatch({ name, token, text = false }: { name: string; token: string; text?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-control border border-line p-2.5">
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-md border border-line"
        style={
          text
            ? { background: 'var(--color-panel)', color: `var(${token})` }
            : { background: `var(${token})` }
        }
      >
        {text && (
          <span className="flex h-full items-center justify-center text-label font-semibold">
            ก
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-caption text-fg-primary">{name}</span>
        <code className="block truncate text-[0.75rem] text-fg-muted">{token}</code>
      </span>
    </li>
  );
}

const DOC_COLUMNS: Column<LabDoc>[] = [
  {
    id: 'no',
    header: 'เลขที่',
    priority: 'primary',
    sortable: true,
    cell: (r) => <span className="whitespace-nowrap tabular">{r.no}</span>,
  },
  {
    id: 'status',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} size="sm" />,
  },
  { id: 'title', header: 'รายการ', sortable: true, cell: (r) => r.title },
  { id: 'dept', header: 'แผนก', cell: (r) => r.dept },
  { id: 'due', header: 'กำหนด', priority: 'medium', sortable: true, cell: (r) => r.due },
  { id: 'owner', header: 'ผู้รับผิดชอบ', priority: 'low', cell: (r) => r.owner },
];

export default function DesignLab() {
  const [accent, setAccent] = useState<(typeof WORKSPACE_ORDER)[number]>('executive');
  // Table demo state
  const [query, setQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState<SortState>({ columnId: 'no', direction: 'asc' });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [page, setPage] = useState(1);
  const [tableMode, setTableMode] = useState<'data' | 'loading' | 'empty'>('data');
  // Form demo state
  const [customer, setCustomer] = useState<string | null>(null);
  const [delivery, setDelivery] = useState('full');
  const [urgent, setUrgent] = useState(false);
  const [agree, setAgree] = useState(false);
  // Overlays
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [recordTab, setRecordTab] = useState('detail');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = LAB_DOCS.filter(
      (d) =>
        (!q || `${d.no} ${d.title} ${d.dept}`.toLowerCase().includes(q)) &&
        (!onlyOpen || !['completed', 'closed', 'cancelled'].includes(d.status)),
    );
    const key = sort.columnId as keyof LabDoc;
    return [...list].sort(
      (a, b) =>
        String(a[key]).localeCompare(String(b[key]), 'th') * (sort.direction === 'asc' ? 1 : -1),
    );
  }, [query, onlyOpen, sort]);
  const PAGE_SIZE = 4;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ '--ws-accent': WORKSPACES[accent].accent } as CSSProperties}>
      <PageHeader
        breadcrumb={[{ label: 'ต้นแบบ' }, { label: 'Design Lab' }]}
        title="Design Lab"
        status={<PrototypeTag>เฉพาะตรวจแบบ — ไม่อยู่ในเมนูระบบจริง</PrototypeTag>}
        description="ชิ้นส่วนมาตรฐานของ CORE ทั้งหมดในหน้าเดียว ใช้ตรวจความสม่ำเสมอก่อนสร้างหน้าจอของแผนกในรอบถัดไป"
      />

      <div className="mb-6 rounded-panel border border-line bg-panel p-4">
        <p className="mb-2.5 text-caption text-fg-muted">
          สีประจำแผนก (ใช้กับไอคอน เส้นเน้น และเมนูที่เลือกเท่านั้น)
        </p>
        <div
          role="radiogroup"
          aria-label="เลือกสีประจำแผนกสำหรับตัวอย่าง"
          className="flex flex-wrap gap-2"
        >
          {WORKSPACE_ORDER.map((id) => {
            const w = WORKSPACES[id];
            const Icon = w.icon;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={accent === id}
                onClick={() => setAccent(id)}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-caption',
                  accent === id
                    ? 'border-line-strong bg-fill-active text-fg-primary'
                    : 'border-line text-fg-secondary hover:bg-fill-hover',
                )}
              >
                <Icon className="size-3.5" style={{ color: w.accent }} aria-hidden />
                {w.shortTh}
              </button>
            );
          })}
        </div>
      </div>

      <nav
        aria-label="หมวดใน Design Lab"
        className="-mx-4 mb-2 no-scrollbar overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-1.5 sm:flex-wrap">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex h-9 items-center rounded-full border border-line px-3 text-caption whitespace-nowrap text-fg-secondary hover:bg-fill-hover hover:text-fg-primary"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <LabSection
        id="tokens"
        title="Tokens"
        note="พื้นผิวซ้อนเป็นชั้น ไม่ใช้ดำสนิท — ตัวอักษรทุกระดับผ่านความคมชัด ≥ 5:1 ยกเว้น disabled"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-caption font-medium text-fg-muted">Surfaces</h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Swatch name="Background" token="--color-canvas" />
              <Swatch name="Navigation" token="--color-nav" />
              <Swatch name="Surface" token="--color-panel" />
              <Swatch name="Raised" token="--color-panel-raised" />
              <Swatch name="Overlay" token="--color-panel-overlay" />
              <Swatch name="Muted fill" token="--color-fill-muted" />
              <Swatch name="Hover" token="--color-fill-hover" />
              <Swatch name="Active" token="--color-fill-active" />
              <Swatch name="Border" token="--color-line" />
              <Swatch name="Border strong" token="--color-line-strong" />
            </ul>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-caption font-medium text-fg-muted">Text</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Swatch name="Primary" token="--color-fg-primary" text />
                <Swatch name="Secondary" token="--color-fg-secondary" text />
                <Swatch name="Muted" token="--color-fg-muted" text />
                <Swatch name="Disabled" token="--color-fg-disabled" text />
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-caption font-medium text-fg-muted">Semantic</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Swatch name="Success" token="--color-success" />
                <Swatch name="Warning" token="--color-warning" />
                <Swatch name="Danger" token="--color-danger" />
                <Swatch name="Info" token="--color-info" />
                <Swatch name="Neutral" token="--color-neutral" />
                <Swatch name="Focus" token="--color-focus" />
              </ul>
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-caption font-medium text-fg-muted">Department accents</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {WORKSPACE_ORDER.map((id) => (
              <Swatch key={id} name={WORKSPACES[id].shortTh} token={`--color-ws-${id}`} />
            ))}
          </ul>
        </div>
        <div className="rounded-panel border border-line bg-panel p-5">
          <p className="text-page text-fg-primary">หัวข้อหน้า · Page title</p>
          <p className="mt-2 text-section text-fg-primary">หัวข้อส่วน · Section</p>
          <p className="mt-2 text-label text-fg-secondary">ข้อความทั่วไปในระบบ · Label 15px</p>
          <p className="mt-1 text-caption text-fg-muted">คำอธิบายรอง · Caption 13px</p>
          <p className="mt-3 text-metric text-fg-primary tabular">1,234</p>
        </div>
      </LabSection>

      <LabSection
        id="buttons"
        title="Buttons"
        note="ปุ่มหลักหนึ่งปุ่มต่อพื้นที่ · ปุ่มที่ยังไม่เปิดใช้แสดง “เร็ว ๆ นี้”"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Plus}>
            สร้างเอกสาร
          </Button>
          <Button>รอง</Button>
          <Button variant="ghost">ไม่เด่น</Button>
          <Button variant="danger" icon={Trash2}>
            ลบ
          </Button>
          <Button loading>กำลังบันทึก</Button>
          <Button disabled>ปิดใช้งาน</Button>
          <Button variant="primary" soon>
            ยังไม่เปิดใช้
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" icon={Download}>
            ขนาดเล็ก
          </Button>
          <IconButton icon={RefreshCw} label="รีเฟรช" variant="secondary" />
          <IconButton icon={Search} label="ค้นหา" />
          <OverflowMenu
            items={[
              { label: 'ส่งออก', icon: Download },
              { label: 'พิมพ์', disabled: true, hint: 'เร็ว ๆ นี้' },
              'separator',
              { label: 'ลบ', icon: Trash2, danger: true },
            ]}
          />
        </div>
      </LabSection>

      <LabSection
        id="status"
        title="Status"
        note="10 สถานะ · 5 ตระกูลสี · ทุกสถานะมีไอคอนและข้อความ ไม่สื่อด้วยสีอย่างเดียว"
      >
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STATUS_ORDER.map((s: Status) => (
            <li
              key={s}
              className="flex items-center justify-between gap-3 rounded-control border border-line px-3.5 py-2.5"
            >
              <StatusBadge status={s} />
              <span className="text-right text-caption text-fg-muted">
                <code>{s}</code> · {STATUS_META[s].meaning}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="partial" label="รับบางส่วน" size="sm" />
          <StatusBadge status="pending" label="รออนุมัติ" size="sm" />
          <Badge>หมวดหมู่</Badge>
          <Badge tone="accent">แผนก</Badge>
          <Badge tone="outline">อ้างอิง</Badge>
          <SampleTag />
          <PrototypeTag />
          <CountBadge count={3} label="รายการ" />
        </div>
      </LabSection>

      <LabSection
        id="forms"
        title="Forms"
        note="Label → ช่อง → คำแนะนำหรือข้อผิดพลาด · * = จำเป็น · ไม่บันทึกข้อมูลจริง"
      >
        <Panel title="ตัวอย่างฟอร์ม">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <FormGrid>
              <FormField label="ชื่อเอกสาร" required help="ใช้ชื่อที่ทุกแผนกเข้าใจตรงกัน">
                <TextInput placeholder="เช่น ใบสั่งซื้อวัตถุดิบ" />
              </FormField>
              <FormField label="เลขที่อ้างอิง" error="รูปแบบเลขที่ไม่ถูกต้อง">
                <TextInput defaultValue="PO-12" />
              </FormField>
              <FormField label="ลูกค้า" required help="ค้นหาด้วยชื่อหรือรหัส">
                <SearchableSelect
                  value={customer}
                  onChange={setCustomer}
                  options={[
                    { value: 'c1', label: 'ลูกค้าตัวอย่าง ก', detail: 'CUS-001' },
                    { value: 'c2', label: 'ลูกค้าตัวอย่าง ข', detail: 'CUS-002' },
                    { value: 'c3', label: 'ลูกค้าตัวอย่าง ค', detail: 'CUS-003' },
                  ]}
                />
              </FormField>
              <FormField label="คลังที่รับ">
                <Select
                  placeholder="เลือกคลัง"
                  defaultValue=""
                  options={[
                    { value: 'main', label: 'คลังหลัก' },
                    { value: 'b', label: 'คลังสำรอง' },
                  ]}
                />
              </FormField>
              <FormField label="วันที่ต้องการ">
                <DateInput />
              </FormField>
              <FormField label="จำนวน" help="จำนวนเต็มเท่านั้น">
                <NumberInput suffix="ชิ้น" defaultValue={12} min={0} />
              </FormField>
              <FormField label="ผู้สร้าง" readOnly>
                <TextInput defaultValue="user1" />
              </FormField>
              <FormField label="สาขา" disabled>
                <TextInput defaultValue="สำนักงานใหญ่" />
              </FormField>
              <FormField label="หมายเหตุ" className="sm:col-span-2">
                <Textarea placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" />
              </FormField>
              <FormField label="การส่งมอบ" group>
                <RadioGroup
                  name="delivery"
                  value={delivery}
                  onChange={setDelivery}
                  options={[
                    { value: 'full', label: 'ส่งครบครั้งเดียว' },
                    {
                      value: 'partial',
                      label: 'ส่งบางส่วนได้',
                      description: 'ระบบติดตามยอดคงค้างให้',
                    },
                  ]}
                />
              </FormField>
              <div className="space-y-4">
                <Switch
                  label="งานด่วน"
                  description="แจ้งผู้รับผิดชอบทันที"
                  checked={urgent}
                  onChange={setUrgent}
                />
                <Checkbox
                  label="ยืนยันว่าตรวจสอบเอกสารแล้ว"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
              </div>
              <FormField label="ไฟล์แนบ" className="sm:col-span-2">
                <FileDrop />
              </FormField>
            </FormGrid>
            <FormActions>
              <Button variant="ghost">ยกเลิก</Button>
              <Button variant="primary" type="submit">
                บันทึก
              </Button>
            </FormActions>
          </form>
        </Panel>
      </LabSection>

      <LabSection
        id="kpi"
        title="KPI & Cards"
        note="ไม่ใช่ทุกหน้าต้องมี KPI — สามตัวเลขที่มีความหมายดีกว่าแปดตัว"
      >
        <KpiGrid columns={3}>
          <Kpi
            variant="primary"
            label="Primary KPI"
            value={12}
            unit="รายการ"
            supporting="ตัวเลขเดียวที่สำคัญที่สุดของหน้า"
          />
          <Kpi
            label="Compact KPI"
            value={3}
            unit="งาน"
            trend={{ direction: 'up', label: '+1 จากเมื่อวาน', sentiment: 'negative' }}
          />
          <Kpi
            variant="alert"
            alertTone="danger"
            label="Alert KPI"
            value={2}
            unit="เรื่อง"
            supporting="เลยกำหนด ต้องดำเนินการ"
          />
        </KpiGrid>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Panel" description="คำอธิบายสั้น" actions={<SampleTag />}>
            <p className="text-label text-fg-secondary">
              พื้นผิวมาตรฐาน: เส้นขอบบางหนึ่งเส้น ไม่มีแสงเรือง
            </p>
            <div className="mt-4">
              <ProgressBar value={64} label="ความคืบหน้าตัวอย่าง" showValue />
            </div>
          </Panel>
          <Panel title="Tabs">
            <Tabs
              label="ตัวอย่างแท็บ"
              value={recordTab}
              onChange={setRecordTab}
              tabs={[
                { id: 'detail', label: 'รายละเอียด' },
                { id: 'lines', label: 'รายการ', count: 3 },
                { id: 'history', label: 'ประวัติ' },
              ]}
            >
              <p className="text-label text-fg-secondary">เนื้อหาของแท็บ “{recordTab}”</p>
            </Tabs>
          </Panel>
        </div>
      </LabSection>

      <LabSection
        id="table"
        title="Table"
        note="≥ 768px ตาราง (ซ่อนคอลัมน์ medium/low ตามความกว้าง) · < 768px การ์ดต่อแถว แตะเพื่อเปิด Drawer"
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="สถานะตัวอย่างของตาราง">
          {(['data', 'loading', 'empty'] as const).map((m) => (
            <FilterChip
              key={m}
              label={{ data: 'มีข้อมูล', loading: 'กำลังโหลด', empty: 'ว่าง' }[m]}
              pressed={tableMode === m}
              onToggle={() => setTableMode(m)}
            />
          ))}
        </div>
        <Panel flush title="เอกสาร" description={`${rows.length} รายการ`} actions={<SampleTag />}>
          <TableToolbar
            search={
              <SearchField
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="ค้นหาเลขที่ รายการ หรือแผนก"
              />
            }
            filters={
              <FilterChip
                label="ยังไม่ปิด"
                pressed={onlyOpen}
                onToggle={() => setOnlyOpen((v) => !v)}
              />
            }
            onClear={query || onlyOpen ? () => (setQuery(''), setOnlyOpen(false)) : undefined}
          />
          <DataTable
            label="ตัวอย่างตารางเอกสาร"
            columns={DOC_COLUMNS}
            rows={tableMode === 'empty' ? [] : pageRows}
            loading={tableMode === 'loading'}
            getRowId={(r) => r.no}
            onRowClick={() => setDrawer(true)}
            selection={{ selected, onChange: setSelected }}
            bulkActions={
              <Button size="sm" icon={Download}>
                ส่งออก
              </Button>
            }
            sort={sort}
            onSortChange={setSort}
            rowActions={() => [
              { label: 'เปิด', onSelect: () => setDrawer(true) },
              { label: 'ลบ', danger: true, onSelect: () => setConfirm(true) },
            ]}
            empty={
              <div className="border-t border-line">
                {query || onlyOpen ? (
                  <EmptyState kind="filtered" {...EMPTY_COPY.noResults} />
                ) : (
                  <EmptyState {...EMPTY_COPY.noItems} icon={FileText} />
                )}
              </div>
            }
            footer={
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            }
          />
        </Panel>
      </LabSection>

      <LabSection
        id="empty"
        title="Empty states"
        note="บอกว่าจะมีอะไรปรากฏ และมาจากไหน — ไม่ใช้ภาพประกอบขนาดใหญ่"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Panel>
            <EmptyState
              layout="compact"
              {...EMPTY_COPY.noItems}
              action={
                <Button size="sm" soon>
                  สร้างรายการ
                </Button>
              }
            />
          </Panel>
          <Panel>
            <EmptyState layout="compact" {...EMPTY_COPY.noTasks} />
          </Panel>
          <Panel>
            <EmptyState layout="compact" kind="clear" {...EMPTY_COPY.noBacklog} />
          </Panel>
          <Panel>
            <EmptyState layout="compact" kind="clear" {...EMPTY_COPY.noExpiringLots} />
          </Panel>
          <Panel>
            <EmptyState
              layout="compact"
              kind="filtered"
              {...EMPTY_COPY.noResults}
              action={<Button size="sm">ล้างตัวกรอง</Button>}
            />
          </Panel>
          <Panel>
            <EmptyState
              layout="inline"
              kind="clear"
              title="ไม่มีรายการค้าง"
              description="แบบแถวเดียว ใช้ในรายการย่อย"
            />
          </Panel>
        </div>
      </LabSection>

      <LabSection
        id="loading"
        title="Loading"
        note="โครงร่างที่ใช้พื้นที่เท่าเนื้อหาจริง · หยุดการเคลื่อนไหวเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว"
      >
        <KpiSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <div className="rounded-panel border border-line bg-panel">
            <TableSkeleton rows={3} />
          </div>
        </div>
        <details className="rounded-panel border border-line bg-panel p-4">
          <summary className="cursor-pointer text-label text-fg-secondary">Page skeleton</summary>
          <div className="mt-4">
            <PageSkeleton />
          </div>
        </details>
      </LabSection>

      <LabSection
        id="errors"
        title="Errors"
        note="ภาษาสุภาพ ใจเย็น — มีปุ่มลองอีกครั้งเมื่อการลองใหม่มีโอกาสสำเร็จ"
      >
        <ErrorState kind="section" onRetry={() => {}} />
        <div className="grid gap-4 lg:grid-cols-2">
          {(['pageLoad', 'permission', 'notFound', 'unexpected'] as const).map((k) => (
            <Panel key={k}>
              <ErrorState
                kind={k}
                className="py-8 sm:py-10"
                onRetry={k === 'pageLoad' || k === 'unexpected' ? () => {} : undefined}
                reference={k === 'unexpected' ? 'UI-EXAMPLE' : undefined}
              />
            </Panel>
          ))}
        </div>
      </LabSection>

      <LabSection
        id="timeline"
        title="Workflow timeline"
        note="แนวนอนตั้งแต่ 768px · แนวตั้งบนมือถือและใน Drawer"
      >
        <Panel>
          <WorkflowTimeline label="ตัวอย่างขั้นตอนคำสั่งซื้อ" steps={LAB_STEPS} />
        </Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="ถูกปฏิเสธ">
            <WorkflowTimeline
              orientation="vertical"
              label="ตัวอย่างขั้นตอนที่ถูกปฏิเสธ"
              steps={[
                { label: 'ส่งคำขอ', state: 'completed', meta: 'คลังสินค้า' },
                { label: 'อนุมัติ', state: 'rejected', note: 'จำนวนเกินแผนที่ตั้งไว้' },
                { label: 'ออก PO', state: 'upcoming' },
              ]}
            />
          </Panel>
          <Panel title="ติดขัด">
            <WorkflowTimeline
              orientation="vertical"
              label="ตัวอย่างขั้นตอนที่ติดขัด"
              steps={[
                { label: 'ออก PO', state: 'completed' },
                { label: 'รับสินค้า', state: 'blocked', note: 'Supplier ส่งล่าช้า' },
                { label: 'ปิด PO', state: 'upcoming' },
              ]}
            />
          </Panel>
        </div>
      </LabSection>

      <LabSection
        id="work"
        title="Tasks & Exceptions"
        note="งานของฉัน: สิ่งที่ต้องทำต่อ · Exception: สิ่งที่ผิดไปจากแผนและต้องตัดสินใจ"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel flush title="งานของฉัน">
            <div className="border-t border-line">
              <TaskList tasks={LAB_TASKS} label="ตัวอย่างงานของฉัน" />
            </div>
          </Panel>
          <Panel flush title="Exception">
            <div className="border-t border-line">
              <ExceptionList items={LAB_EXCEPTIONS} label="ตัวอย่าง Exception" />
            </div>
          </Panel>
        </div>
      </LabSection>

      <LabSection
        id="overlays"
        title="Modal & Drawer"
        note="Modal = การตัดสินใจสั้น · Drawer = รายละเอียด/แก้ไขเร็ว · หน้าเต็ม = เอกสารซับซ้อน"
      >
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModal(true)}>เปิด Modal</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            เปิด Confirm (ลบ)
          </Button>
          <Button onClick={() => setDrawer(true)}>เปิด Drawer</Button>
        </div>
        <div className="overflow-hidden rounded-panel border border-line">
          <table className="w-full text-left text-caption">
            <caption className="sr-only">เมื่อไรใช้ Modal, Drawer หรือหน้าเต็ม</caption>
            <thead className="bg-panel-raised/60 text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  รูปแบบ
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  ใช้เมื่อ
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  ตัวอย่าง
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-fg-secondary">
              <tr>
                <td className="px-4 py-3 text-fg-primary">Modal</td>
                <td className="px-4 py-3">คำถามเดียว ตัดสินใจเร็ว ฟอร์มสั้นมาก</td>
                <td className="hidden px-4 py-3 sm:table-cell">ยืนยันการลบ, ปฏิเสธพร้อมเหตุผล</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-fg-primary">Drawer</td>
                <td className="px-4 py-3">ดูรายละเอียด แก้ไขเร็ว โดยไม่เสียตำแหน่งในรายการ</td>
                <td className="hidden px-4 py-3 sm:table-cell">ดู SO / Lot, อัปเดตความคืบหน้า</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-fg-primary">หน้าเต็ม</td>
                <td className="px-4 py-3">
                  เอกสารที่มีหลายบรรทัด ต้องมี URL ของตัวเอง หรือแก้ไขนาน
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">สร้าง PO / SO / GR</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LabSection>

      <LabSection
        id="record"
        title="Record detail"
        note="แม่แบบเอกสารมาตรฐาน — ไม่มีตรรกะทางธุรกิจ"
      >
        <div className="rounded-card border border-dashed border-line-strong p-4 sm:p-6">
          <RecordHeader
            headingLevel={2}
            docType="ใบสั่งซื้อ (PO)"
            number="PO-000123"
            status={<StatusBadge status="partial" label="รับบางส่วน" />}
            meta="สร้างโดย จัดซื้อ · 15 ต.ค."
            actions={
              <>
                <Button size="sm" soon>
                  แก้ไข
                </Button>
                <OverflowMenu items={[{ label: 'พิมพ์', disabled: true, hint: 'เร็ว ๆ นี้' }]} />
              </>
            }
          />
          <div className="mt-6">
            <Tabs
              label="ส่วนของเอกสาร"
              value="detail"
              onChange={() => {}}
              tabs={[
                { id: 'detail', label: 'รายละเอียด' },
                { id: 'lines', label: 'รายการ' },
                { id: 'receipts', label: 'การรับสินค้า' },
                { id: 'payments', label: 'การจ่ายเงิน' },
                { id: 'history', label: 'ประวัติ' },
              ]}
            >
              <RecordLayout
                main={
                  <>
                    <RecordSection title="สรุป">
                      <SummaryList
                        items={[
                          { label: 'Supplier', value: 'Supplier ตัวอย่าง A' },
                          { label: 'กำหนดส่ง', value: '29 ต.ค.' },
                          { label: 'PR อ้างอิง', value: 'PR-000088' },
                          { label: 'รับแล้ว', value: '60%' },
                        ]}
                      />
                    </RecordSection>
                    <RecordSection title="ขั้นตอน">
                      <WorkflowTimeline
                        label="ขั้นตอนของ PO-000123"
                        steps={[
                          { label: 'PR อนุมัติ', state: 'completed' },
                          { label: 'ออก PO', state: 'completed' },
                          { label: 'รับสินค้า', state: 'current' },
                          { label: 'จ่ายเงิน', state: 'upcoming' },
                          { label: 'ปิด PO', state: 'upcoming' },
                        ]}
                      />
                    </RecordSection>
                  </>
                }
                side={
                  <>
                    <RecordSection title="เอกสารที่เกี่ยวข้อง">
                      <RelatedDocuments
                        docs={[
                          {
                            type: 'ใบขอซื้อ',
                            number: 'PR-000088',
                            status: <StatusBadge status="completed" size="sm" />,
                          },
                          {
                            type: 'ใบรับสินค้า',
                            number: 'GR-000301',
                            status: <StatusBadge status="partial" size="sm" />,
                          },
                        ]}
                      />
                    </RecordSection>
                    <RecordSection title="ความเคลื่อนไหว">
                      <ActivityFeed
                        entries={[
                          { who: 'คลังสินค้า', what: 'รับสินค้า 60%', when: 'วันนี้ 10:20' },
                          { who: 'จัดซื้อ', what: 'ออก PO', when: '15 ต.ค.' },
                        ]}
                      />
                    </RecordSection>
                  </>
                }
              />
            </Tabs>
          </div>
        </div>
      </LabSection>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="ปฏิเสธใบขอซื้อ"
        description="ระบุเหตุผลเพื่อแจ้งผู้ขอ"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              ยกเลิก
            </Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              ยืนยันการปฏิเสธ
            </Button>
          </>
        }
      >
        <FormField label="เหตุผล" required>
          <Textarea placeholder="เช่น จำนวนเกินแผนที่ตั้งไว้" />
        </FormField>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => setConfirm(false)}
        tone="danger"
        title="ลบเอกสารนี้?"
        description="เอกสารที่ลบแล้วจะกู้คืนไม่ได้ ตัวอย่างนี้ไม่ลบข้อมูลจริง"
        confirmLabel="ลบเอกสาร"
      />
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        subtitle="ตัวอย่าง Drawer"
        title="DOC-001"
        headerExtra={<StatusBadge status="processing" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>
              ปิด
            </Button>
            <Button variant="primary">บันทึก</Button>
          </>
        }
      >
        <div className="space-y-8">
          <SummaryList
            columns={1}
            items={[
              { label: 'รายการ', value: 'เอกสารตัวอย่าง' },
              { label: 'แผนก', value: 'จัดซื้อ' },
            ]}
          />
          <WorkflowTimeline orientation="vertical" label="ขั้นตอนตัวอย่าง" steps={LAB_STEPS} />
        </div>
      </Drawer>
    </div>
  );
}

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  DataTable,
  Drawer,
  EMPTY_COPY,
  EmptyState,
  ErrorState,
  FormField,
  Modal,
  OverflowMenu,
  STATUS_META,
  STATUS_ORDER,
  StatusBadge,
  Switch,
  TextInput,
  WorkflowTimeline,
  type Column,
} from './index';

describe('StatusBadge', () => {
  it('covers the ten semantic statuses with five colour families', () => {
    expect(STATUS_ORDER).toEqual([
      'draft',
      'pending',
      'processing',
      'partial',
      'completed',
      'closed',
      'rejected',
      'cancelled',
      'warning',
      'overdue',
    ]);
    const tones = new Set(STATUS_ORDER.map((s) => STATUS_META[s].tone));
    expect([...tones].sort()).toEqual(['danger', 'info', 'neutral', 'success', 'warning']);
  });

  it.each(STATUS_ORDER)(
    'renders %s with an icon and a text label (never colour alone)',
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const badge = container.querySelector(`[data-status="${status}"]`)!;
      expect(badge).toHaveTextContent(STATUS_META[status].label);
      expect(badge.querySelector('svg')).not.toBeNull();
    },
  );

  it('accepts document-specific wording while keeping the family', () => {
    const { container } = render(<StatusBadge status="partial" label="รับบางส่วน" />);
    expect(container.firstChild).toHaveTextContent('รับบางส่วน');
    expect(container.firstChild).toHaveAttribute('data-status', 'partial');
  });
});

describe('EmptyState', () => {
  it('announces the title, description and action', () => {
    render(
      <EmptyState {...EMPTY_COPY.noBacklog} kind="clear" action={<Button>สร้างรายการ</Button>} />,
    );
    const state = screen.getByRole('status');
    expect(state).toHaveTextContent('ไม่มีรายการค้าง');
    expect(state).toHaveTextContent(EMPTY_COPY.noBacklog.description);
    expect(within(state).getByRole('button', { name: 'สร้างรายการ' })).toBeInTheDocument();
  });

  it('ships the standard Thai empty copy', () => {
    expect(EMPTY_COPY.noItems.title).toBe('ยังไม่มีรายการ');
    expect(EMPTY_COPY.noTasks.title).toBe('ยังไม่มีงานที่ต้องดำเนินการ');
    expect(EMPTY_COPY.noExpiringLots.title).toBe('ยังไม่มี Lot ที่ใกล้หมดอายุ');
    expect(EMPTY_COPY.noResults.title).toBe('ไม่พบรายการตามตัวกรอง');
  });
});

describe('ErrorState', () => {
  it('offers retry for load errors', async () => {
    const retry = vi.fn();
    render(<ErrorState kind="pageLoad" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('โหลดหน้านี้ไม่สำเร็จ');
    await userEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders permission denied calmly, without retry', () => {
    render(<ErrorState kind="permission" />);
    expect(screen.getByRole('status')).toHaveTextContent('คุณยังไม่มีสิทธิ์เข้าถึงส่วนนี้');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

interface Row {
  id: string;
  name: string;
  note: string;
}
const COLS: Column<Row>[] = [
  { id: 'name', header: 'ชื่อ', priority: 'primary', sortable: true, cell: (r) => r.name },
  {
    id: 'status',
    header: 'สถานะ',
    priority: 'status',
    cell: () => <StatusBadge status="pending" />,
  },
  { id: 'note', header: 'หมายเหตุ', priority: 'low', cell: (r) => r.note },
];
const ROWS: Row[] = [
  { id: 'A-1', name: 'รายการหนึ่ง', note: 'n1' },
  { id: 'A-2', name: 'รายการสอง', note: 'n2' },
];

describe('DataTable', () => {
  it('renders a desktop table and phone card rows with prioritised columns', () => {
    const { container } = render(
      <DataTable label="ตัวอย่าง" columns={COLS} rows={ROWS} getRowId={(r) => r.id} />,
    );
    const table = container.querySelector('table')!;
    expect(table).toHaveClass('hidden', 'md:table');
    expect(table.querySelector('caption')).toHaveTextContent('ตัวอย่าง');
    // Low-priority columns only appear from 1280px.
    const noteHeader = within(table).getByRole('columnheader', { name: 'หมายเหตุ' });
    expect(noteHeader).toHaveClass('hidden', 'xl:table-cell');
    // Phone cards: one per row, low-priority fields left for the detail view.
    const cards = container.querySelector('ul.md\\:hidden')!;
    expect(cards.querySelectorAll('li')).toHaveLength(2);
    expect(cards).not.toHaveTextContent('n1');
  });

  it('shows the empty state when there are no rows', () => {
    render(
      <DataTable
        label="ว่าง"
        columns={COLS}
        rows={[]}
        getRowId={(r) => r.id}
        empty={<EmptyState {...EMPTY_COPY.noItems} />}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('ยังไม่มีรายการ');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('supports selection with a summary bar', async () => {
    function Harness() {
      const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
      return (
        <DataTable
          label="เลือก"
          columns={COLS}
          rows={ROWS}
          getRowId={(r) => r.id}
          selection={{ selected, onChange: setSelected }}
        />
      );
    }
    const { container } = render(<Harness />);
    const table = container.querySelector('table')!;
    await userEvent.click(within(table).getByRole('checkbox', { name: 'เลือก A-1' }));
    expect(screen.getByText(/เลือกแล้ว/)).toHaveTextContent('เลือกแล้ว 1 รายการ');
    expect(container.querySelector('tr[data-selected]')).not.toBeNull();
    await userEvent.click(within(table).getByRole('checkbox', { name: 'เลือกทุกรายการ' }));
    expect(screen.getByText(/เลือกแล้ว/)).toHaveTextContent('เลือกแล้ว 2 รายการ');
  });

  it('exposes sort state on sortable headers and opens rows', async () => {
    const onSort = vi.fn();
    const onOpen = vi.fn();
    const { container } = render(
      <DataTable
        label="เรียง"
        columns={COLS}
        rows={ROWS}
        getRowId={(r) => r.id}
        sort={{ columnId: 'name', direction: 'asc' }}
        onSortChange={onSort}
        onRowClick={onOpen}
      />,
    );
    const table = container.querySelector('table')!;
    expect(within(table).getByRole('columnheader', { name: /ชื่อ/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(within(table).getByRole('button', { name: /ชื่อ/ }));
    expect(onSort).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
    await userEvent.click(within(table).getByRole('button', { name: 'รายการสอง' }));
    expect(onOpen).toHaveBeenCalledWith(ROWS[1]);
  });
});

describe('WorkflowTimeline', () => {
  it('marks the current step and states every step in text', () => {
    render(
      <WorkflowTimeline
        label="ขั้นตอน"
        steps={[
          { label: 'รับออเดอร์', state: 'completed' },
          { label: 'ตรวจ Stock', state: 'completed' },
          { label: 'Operations', state: 'current' },
          { label: 'อนุมัติ', state: 'rejected', note: 'เกินวงเงิน' },
          { label: 'จัดส่ง', state: 'blocked' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'ขั้นตอน' });
    const items = within(list).getAllByRole('listitem');
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('เสร็จแล้ว');
    expect(items[2]).toHaveTextContent('ขั้นตอนปัจจุบัน');
    expect(items[3]).toHaveTextContent('ไม่อนุมัติ');
    expect(items[3]).toHaveTextContent('เกินวงเงิน');
    expect(items[4]).toHaveTextContent('ติดขัด');
  });
});

describe('Form system', () => {
  it('wires label, required, help and error into the control', () => {
    render(
      <FormField label="ชื่อเอกสาร" required help="ใช้ชื่อที่เข้าใจตรงกัน" error="กรุณากรอกชื่อ">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByLabelText(/ชื่อเอกสาร/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/ใช้ชื่อที่เข้าใจตรงกัน.*กรุณากรอกชื่อ/);
  });

  it('supports disabled and read-only fields', () => {
    render(
      <>
        <FormField label="สาขา" disabled>
          <TextInput />
        </FormField>
        <FormField label="ผู้สร้าง" readOnly>
          <TextInput defaultValue="user1" />
        </FormField>
      </>,
    );
    expect(screen.getByLabelText('สาขา')).toBeDisabled();
    expect(screen.getByLabelText(/ผู้สร้าง/)).toHaveAttribute('readonly');
  });

  it('toggles a switch with aria-checked', async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch label="งานด่วน" checked={on} onChange={setOn} />;
    }
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'งานด่วน' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Modal and Drawer', () => {
  function Harness({ kind }: { kind: 'modal' | 'drawer' }) {
    const [open, setOpen] = useState(false);
    const Overlay = kind === 'modal' ? Modal : Drawer;
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          เปิด
        </button>
        <Overlay open={open} onClose={() => setOpen(false)} title="หัวข้อ">
          <button type="button">ในกล่อง</button>
        </Overlay>
      </>
    );
  }

  it.each(['modal', 'drawer'] as const)(
    '%s traps focus, closes on Escape and returns focus',
    async (kind) => {
      render(<Harness kind={kind} />);
      const opener = screen.getByRole('button', { name: 'เปิด' });
      await userEvent.click(opener);
      const dialog = screen.getByRole('dialog', { name: 'หัวข้อ' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog.contains(document.activeElement)).toBe(true);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
    },
  );
});

describe('OverflowMenu', () => {
  it('opens with keyboard focus on the first enabled item and runs actions', async () => {
    const onExport = vi.fn();
    render(
      <MemoryRouter>
        <OverflowMenu
          items={[
            { label: 'พิมพ์', disabled: true, hint: 'เร็ว ๆ นี้' },
            { label: 'ส่งออก', onSelect: onExport },
          ]}
        />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'การทำงานเพิ่มเติม' }));
    expect(screen.getByRole('menuitem', { name: 'ส่งออก' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onExport).toHaveBeenCalledOnce();
  });
});

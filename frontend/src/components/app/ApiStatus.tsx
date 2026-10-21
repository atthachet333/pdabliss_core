import { useQuery } from '@tanstack/react-query';
import { apiGet, type HealthResponse } from '@/lib/api';
import { cn } from '@/lib/cn';

export function ApiStatus() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiGet<HealthResponse>('/health', signal),
    refetchInterval: 30_000,
    retry: 1,
  });

  const online = data?.status === 'ok';
  const label = isPending
    ? 'กำลังตรวจสอบ API'
    : online
      ? 'API พร้อมใช้งาน'
      : isError
        ? 'API ออฟไลน์ (ใช้ข้อมูลเดโม)'
        : 'ไม่ทราบสถานะ';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-caption text-text-muted"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          isPending
            ? 'bg-text-muted'
            : online
              ? 'bg-success shadow-[0_0_8px_var(--color-success)]'
              : 'bg-warning',
        )}
      />
      <span className="hidden md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
    </span>
  );
}

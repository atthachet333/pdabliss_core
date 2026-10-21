import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { FALLBACK_STOCK, type WarehouseStockResponse } from './data';

/** Warehouse stock from the backend's warehouse contract, with an offline demo fallback. */
export function useWarehouseStock() {
  const query = useQuery({
    queryKey: ['demo', 'warehouse', 'stock'],
    queryFn: ({ signal }) => apiGet<WarehouseStockResponse>('/api/v1/demo/warehouse/stock', signal),
    retry: 0,
    staleTime: 60_000,
  });
  return {
    items: query.data?.items ?? FALLBACK_STOCK,
    source: query.data
      ? ('api' as const)
      : query.isPending
        ? ('loading' as const)
        : ('fallback' as const),
  };
}

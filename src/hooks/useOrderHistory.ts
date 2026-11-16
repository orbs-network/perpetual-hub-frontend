import { useCallback, useMemo } from 'react';
import { getUserOrderHistory } from '../api/history';
import { usePaginatedHistory } from './usePaginatedHistory';
import { usePortfolioAddress } from './usePortfolioAddress';

export const ORDER_HISTORY_QUERY_KEY = ['order-history'] as const;

export function useOrderHistory(
  addressOverride?: string | null,
  queryKeyScope?: string,
) {
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;
  const queryKey = useMemo(
    () => [...ORDER_HISTORY_QUERY_KEY, queryKeyScope, address] as const,
    [address, queryKeyScope],
  );
  const getItems = useCallback(
    (page: Awaited<ReturnType<typeof getUserOrderHistory>>) => page.orders,
    [],
  );

  return usePaginatedHistory({
    address: address ?? null,
    queryKey,
    fetchPage: getUserOrderHistory,
    getItems,
  });
}

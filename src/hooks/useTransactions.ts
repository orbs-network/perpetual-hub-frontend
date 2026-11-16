import { useCallback, useMemo } from 'react';
import { getUserTransactions } from '../api/history';
import { usePaginatedHistory } from './usePaginatedHistory';
import { usePortfolioAddress } from './usePortfolioAddress';

export function useTransactions(
  addressOverride?: string | null,
  queryKeyScope?: string,
) {
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;
  const queryKey = useMemo(
    () => ['transactions', queryKeyScope, address] as const,
    [address, queryKeyScope],
  );
  const getItems = useCallback(
    (page: Awaited<ReturnType<typeof getUserTransactions>>) =>
      page.transactions,
    [],
  );

  return usePaginatedHistory({
    address: address ?? null,
    queryKey,
    fetchPage: getUserTransactions,
    getItems,
  });
}

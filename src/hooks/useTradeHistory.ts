import { useCallback } from 'react';
import { getUserTrades } from '../api/history';
import { usePaginatedHistory } from './usePaginatedHistory';
import { usePortfolioAddress } from './usePortfolioAddress';

export const TRADE_HISTORY_QUERY_KEY = ['trade-history'] as const;

export function useTradeHistory(
  addressOverride?: string | null,
  queryKeyScope?: string,
) {
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;

  const getItems = useCallback(
    (page: Awaited<ReturnType<typeof getUserTrades>>) => page.trades,
    [],
  );

  return usePaginatedHistory({
    address: address ?? null,
    queryKey: ['trade-history', queryKeyScope, address],
    fetchPage: getUserTrades,
    getItems,
  });
}

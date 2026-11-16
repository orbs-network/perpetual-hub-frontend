import { hasUnavailableWithdrawalAccounting } from "@/lib/transactionAccounting";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getUserPortfolioLedgerHistoryPage,
  INITIAL_PORTFOLIO_HISTORY_CURSOR,
  type PortfolioLedgerHistoryCursor,
  type PortfolioLedgerHistoryPage,
} from "@/api/history";
import {
  getPortfolioRangeStart,
  type PortfolioDateRange,
} from "@/lib/portfolioDateRanges";
import { usePortfolioAddress } from "./usePortfolioAddress";
import { useIsHedgerAddress } from "./useHedgerAccounting";

const STALE_TIME_MS = 30_000;

function streamCoversStart(
  pages: PortfolioLedgerHistoryPage[],
  stream: keyof PortfolioLedgerHistoryCursor,
  nextOffset: number | null,
  rangeStart: number,
) {
  return (
    (nextOffset === null && !pages.some((page) => page.limitedStreams?.includes(stream))) ||
    pages.some((page) => {
      const timestamp = page.oldestTimestamps[stream];
      return timestamp !== null && timestamp < rangeStart;
    })
  );
}

export function isPortfolioHistoryRangeCovered(
  pages: PortfolioLedgerHistoryPage[],
  range: PortfolioDateRange,
  end: number,
) {
  const lastPage = pages[pages.length - 1];
  if (!lastPage) return false;
  const nextCursor = lastPage.nextCursor ?? {
    transactions: null,
    orders: null,
    funding: null,
  };
  const limited = pages.some((page) => (page.limitedStreams?.length ?? 0) > 0);
  if (range === "All") return lastPage.nextCursor === null && !limited;

  const rangeStart = getPortfolioRangeStart(range, end);
  if (rangeStart === undefined) return lastPage.nextCursor === null && !limited;

  return (
    streamCoversStart(
      pages,
      "transactions",
      nextCursor.transactions,
      rangeStart,
    ) &&
    streamCoversStart(
      pages,
      "orders",
      nextCursor.orders,
      rangeStart,
    ) &&
    streamCoversStart(
      pages,
      "funding",
      nextCursor.funding,
      rangeStart,
    )
  );
}

function hasNextCursor(cursor: PortfolioLedgerHistoryCursor | null) {
  return cursor !== null;
}

function uniqueHistoryRows<T extends { id: number }>(rows: T[]) {
  const seen = new Set<number>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function usePortfolioHistory(
  range: PortfolioDateRange = "30D",
  end?: number,
  enabled = true,
) {
  const [fallbackEnd] = useState(() => Date.now());
  const rangeEnd = end ?? fallbackEnd;
  const address = usePortfolioAddress();
  const { isHedger, isResolved: isHedgerRoleResolved } =
    useIsHedgerAddress(address);

  const query = useInfiniteQuery({
    queryKey: ["portfolioHistory", address],
    queryFn: ({ pageParam, signal }) =>
      getUserPortfolioLedgerHistoryPage(address!, pageParam, signal),
    enabled:
      enabled && Boolean(address) && isHedgerRoleResolved && !isHedger,
    initialPageParam: INITIAL_PORTFOLIO_HISTORY_CURSOR,
    getNextPageParam: (lastPage) =>
      hasNextCursor(lastPage.nextCursor) ? lastPage.nextCursor : undefined,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME_MS,
  });

  const pages = useMemo(() => query.data?.pages ?? [], [query.data?.pages]);
  const rangeCovered = useMemo(
    () => isPortfolioHistoryRangeCovered(pages, range, rangeEnd),
    [pages, range, rangeEnd],
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const rangeStart = getPortfolioRangeStart(range, rangeEnd) ?? -Infinity;
  const hasFetchError = query.isError || query.isFetchNextPageError;

  useEffect(() => {
    if (
      !rangeCovered &&
      hasNextPage &&
      !isFetchingNextPage &&
      !hasFetchError
    ) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [
    fetchNextPage,
    hasFetchError,
    hasNextPage,
    isFetchingNextPage,
    rangeCovered,
  ]);

  const data = useMemo(
    () => ({
      transactions: uniqueHistoryRows(
        pages.flatMap((page) => page.transactions),
      ),
      orders: uniqueHistoryRows(pages.flatMap((page) => page.orders)),
      funding: uniqueHistoryRows(pages.flatMap((page) => page.funding)),
    }),
    [pages],
  );

  const accountingIncomplete = data.transactions.some((tx) =>
    tx.timestamp >= rangeStart && tx.timestamp <= rangeEnd && hasUnavailableWithdrawalAccounting(tx));

  return {
    ...query,
    accountingIncomplete,
    completeHistory: isPortfolioHistoryRangeCovered(pages, "All", rangeEnd),
    isError: query.isError || (pages.length > 0 && !query.hasNextPage && !rangeCovered),
    data,
    isLoading:
      query.isLoading ||
      (pages.length > 0 &&
        !rangeCovered &&
        query.hasNextPage &&
        !hasFetchError),
  };
}

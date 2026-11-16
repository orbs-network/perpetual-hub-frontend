import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { HISTORY_ROW_LIMIT } from "@/lib/historyPagination";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_STALE_TIME_MS = 1000 * 30;

type QueryKeyPart = string | number | boolean | null | undefined;

interface UsePaginatedHistoryOptions<TItem, TPage extends { total: number }> {
  address: string | null;
  queryKey: readonly QueryKeyPart[];
  fetchPage: (
    address: string,
    limit: number,
    offset: number,
    signal?: AbortSignal,
  ) => Promise<TPage>;
  getItems: (page: TPage) => TItem[] | null | undefined;
  pageSize?: number;
  staleTime?: number;
  enabled?: boolean;
}

export function usePaginatedHistory<TItem, TPage extends { total: number }>({
  address,
  queryKey,
  fetchPage,
  getItems,
  pageSize = DEFAULT_PAGE_SIZE,
  staleTime = DEFAULT_STALE_TIME_MS,
  enabled = true,
}: UsePaginatedHistoryOptions<TItem, TPage>) {
  const queryClient = useQueryClient();
  const infiniteQueryKey = useMemo(
    () => [...queryKey, "infinite", pageSize] as const,
    [pageSize, queryKey],
  );

  const query = useInfiniteQuery({
    queryKey: infiniteQueryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      if (!address) {
        throw new Error("Missing address");
      }
      const offset = pageParam * pageSize;
      return fetchPage(address, Math.min(pageSize, HISTORY_ROW_LIMIT - offset), offset, signal);
    },
    getNextPageParam: (lastPage, allPages) => {
      const nextOffset = allPages.length * pageSize;
      return nextOffset < Math.min(lastPage.total, HISTORY_ROW_LIMIT) ? allPages.length : undefined;
    },
    enabled: enabled && Boolean(address),
    staleTime,
    refetchInterval: staleTime,
  });
  const {
    data: infiniteData,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = query;

  const pages = useMemo(() => infiniteData?.pages ?? [], [infiniteData?.pages]);
  const loadedRows = useMemo(
    () => pages.flatMap((pageData) => getItems(pageData) ?? []),
    [getItems, pages],
  );
  const latestPage = pages[pages.length - 1];
  const total = latestPage?.total ?? 0;

  const invalidateQuery = useCallback(
    () => queryClient.invalidateQueries({ queryKey: infiniteQueryKey }),
    [infiniteQueryKey, queryClient],
  );

  return {
    data: loadedRows,
    loading: isLoading,
    isInitialLoading: isLoading,
    error: error instanceof Error ? error.message : null,
    total,
    pageSize,
    historyRowLimit: HISTORY_ROW_LIMIT,
    fetchNextPage,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    invalidateQuery,
    refetch,
  };
}

import { useCallback, useMemo } from "react";
import { getUserFundingHistory } from "@/api/history";
import { usePaginatedHistory } from "./usePaginatedHistory";

export function useFundingHistory(
  address: string | null,
  queryKeyScope?: string,
) {
  const queryKey = useMemo(
    () => ["funding-history", queryKeyScope, address] as const,
    [address, queryKeyScope],
  );
  const getItems = useCallback(
    (page: Awaited<ReturnType<typeof getUserFundingHistory>>) => page.funding,
    [],
  );

  return usePaginatedHistory({
    address,
    queryKey,
    fetchPage: getUserFundingHistory,
    getItems,
  });
}

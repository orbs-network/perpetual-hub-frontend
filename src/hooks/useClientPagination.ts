import { useCallback, useMemo, useState } from "react";

type ClientPaginationOptions = {
  emptyLabel?: string;
  resetKey?: string;
};

export function useClientPagination<T>(
  items: T[],
  pageSize: number,
  { emptyLabel = "0 of 0", resetKey = "" }: ClientPaginationOptions = {},
) {
  const [pageState, setPageState] = useState({ page: 0, resetKey });
  const requestedPage =
    pageState.resetKey === resetKey ? pageState.page : 0;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  const start = items.length ? page * pageSize : 0;
  const end = Math.min(start + pageSize, items.length);
  const visibleItems = useMemo(
    () => items.slice(start, end),
    [end, items, start],
  );
  const canGoNext = items.length > 0 && page < pageCount - 1;
  const canGoPrevious = items.length > 0 && page > 0;
  const goToNextPage = useCallback(() => {
    setPageState((current) => {
      const currentPage = current.resetKey === resetKey ? current.page : 0;
      return {
        page: Math.min(pageCount - 1, currentPage + 1),
        resetKey,
      };
    });
  }, [pageCount, resetKey]);
  const goToPreviousPage = useCallback(() => {
    setPageState((current) => {
      const currentPage = current.resetKey === resetKey ? current.page : 0;
      return {
        page: Math.max(0, currentPage - 1),
        resetKey,
      };
    });
  }, [resetKey]);

  return {
    canGoNext,
    canGoPrevious,
    end,
    goToNextPage,
    goToPreviousPage,
    page,
    pageCount,
    paginationLabel: items.length
      ? `${start + 1}-${end} of ${items.length}`
      : emptyLabel,
    start,
    visibleItems,
  };
}

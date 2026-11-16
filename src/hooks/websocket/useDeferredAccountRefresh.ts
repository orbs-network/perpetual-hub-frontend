import { useCallback, useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  isOrderReplacementPending,
  useOrderOperationsStore,
} from "@/stores/orderOperationsStore";
import { ORDER_HISTORY_QUERY_KEY } from "../useOrderHistory";
import { TRADE_HISTORY_QUERY_KEY } from "../useTradeHistory";
import { useLatestRef } from "../useLatestRef";

export interface PendingRefresh {
  includeOrderHistory: boolean;
  includeTrades: boolean;
}

export function useDeferredAccountRefresh({
  hasAddress,
  queryClient,
  refetchUserAccount,
}: {
  hasAddress: boolean;
  queryClient: QueryClient;
  refetchUserAccount: () => unknown;
}) {
  const hasAddressRef = useLatestRef(hasAddress);
  const queryClientRef = useLatestRef(queryClient);
  const refetchRef = useLatestRef(refetchUserAccount);
  const pendingRefreshRef = useRef<PendingRefresh | null>(null);
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coalesceMaxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coalescedRefreshRef = useRef<PendingRefresh | null>(null);

  const runAccountRefresh = useCallback((refresh: PendingRefresh) => {
    if (!hasAddressRef.current) return;

    void refetchRef.current();
    if (refresh.includeOrderHistory) {
      void queryClientRef.current.invalidateQueries({
        queryKey: ORDER_HISTORY_QUERY_KEY,
      });
    }
    if (refresh.includeTrades) {
      void queryClientRef.current.invalidateQueries({
        queryKey: TRADE_HISTORY_QUERY_KEY,
      });
    }
  }, [hasAddressRef, queryClientRef, refetchRef]);

  const flushCoalescedRefresh = useCallback(() => {
    if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
    if (coalesceMaxWaitTimerRef.current) clearTimeout(coalesceMaxWaitTimerRef.current);
    coalesceTimerRef.current = null;
    coalesceMaxWaitTimerRef.current = null;
    const combined = coalescedRefreshRef.current;
    coalescedRefreshRef.current = null;
    if (combined) runAccountRefresh(combined);
  }, [runAccountRefresh]);

  const requestAccountRefresh = useCallback((refresh: PendingRefresh) => {
    if (!hasAddressRef.current) return;

    if (isOrderReplacementPending()) {
      pendingRefreshRef.current = {
        includeOrderHistory:
          Boolean(pendingRefreshRef.current?.includeOrderHistory) ||
          refresh.includeOrderHistory,
        includeTrades:
          Boolean(pendingRefreshRef.current?.includeTrades) ||
          refresh.includeTrades,
      };
      return;
    }

    coalescedRefreshRef.current = {
      includeOrderHistory: Boolean(coalescedRefreshRef.current?.includeOrderHistory) || refresh.includeOrderHistory,
      includeTrades: Boolean(coalescedRefreshRef.current?.includeTrades) || refresh.includeTrades,
    };
    if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
    if (!coalesceMaxWaitTimerRef.current) {
      coalesceMaxWaitTimerRef.current = setTimeout(flushCoalescedRefresh, 300);
    }
    coalesceTimerRef.current = setTimeout(() => {
      flushCoalescedRefresh();
    }, 75);
  }, [flushCoalescedRefresh, hasAddressRef]);

  useEffect(() => () => {
    if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current);
    if (coalesceMaxWaitTimerRef.current) clearTimeout(coalesceMaxWaitTimerRef.current);
  }, []);

  const refreshAccountAndHistory = useCallback((includeTrades: boolean) => {
    requestAccountRefresh({
      includeOrderHistory: true,
      includeTrades,
    });
  }, [requestAccountRefresh]);

  useEffect(() => {
    return useOrderOperationsStore.subscribe((state, previousState) => {
      if (
        state.pendingOrderReplacementCount > 0 ||
        previousState.pendingOrderReplacementCount === 0
      ) {
        return;
      }

      const pendingRefresh = pendingRefreshRef.current;
      if (!pendingRefresh) {
        return;
      }

      pendingRefreshRef.current = null;
      runAccountRefresh(pendingRefresh);
    });
  }, [runAccountRefresh]);

  return {
    requestAccountRefresh,
    refreshAccountAndHistory,
  };
}

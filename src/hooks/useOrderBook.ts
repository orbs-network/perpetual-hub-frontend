import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PRICE_SOURCE } from "@/config/constants";
import { usePageVisible } from "./usePageVisible";
import { useMarket } from "./useMarkets";
import { useTradeSymbol } from "./useSelectTradeSymbol";
import { useBinanceApiUrls } from "./util-hooks";
import {
  fetchHedgerOrderBookSnapshot,
  fetchOrderBookSnapshot,
} from "@/api/book";
import {
  extractDepthLevels,
  getOrderBookStreamUrl,
  mergeTopDepthUpdate,
} from "@/utils/book";
import { binanceWs } from "@/lib/binance/wsClient";
import type { BinanceDepthMessage, OrderBookData } from "@/types";

const REST_REFRESH_MS = 15_000;
const HEDGER_ORDER_BOOK_POLL_MS = 5_000;
const BINANCE_DEPTH_FIRST_MESSAGE_TIMEOUT_MS = 3_000;

function useSelectedOrderBookQueryKey() {
  const priceSource = DEFAULT_PRICE_SOURCE;
  const { market } = useTradeSymbol();
  const binanceSymbol = market?.symbol;

  return useMemo(
    () => ({
      queryKey: ["orderbook", priceSource, binanceSymbol] as const,
      binanceSymbol,
    }),
    [priceSource, binanceSymbol],
  );
}

// --- Data hook (REST fetch + reads from cache) ---

export function useSelectedOrderBook() {
  const { futuresRestUrl } = useBinanceApiUrls();
  const { binanceSymbol, queryKey } = useSelectedOrderBookQueryKey();

  return useQuery<OrderBookData>({
    queryKey,
    enabled: !!binanceSymbol,
    queryFn: ({ signal }) =>
      fetchOrderBookSnapshot(futuresRestUrl, binanceSymbol!, signal),
    refetchInterval: REST_REFRESH_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useSymbolOrderBook(symbol?: string) {
  const { futuresRestUrl } = useBinanceApiUrls();
  const binanceSymbol = useMarket(symbol)?.symbol;
  const priceSource = DEFAULT_PRICE_SOURCE;

  return useQuery<OrderBookData>({
    queryKey: ["orderbook", priceSource, binanceSymbol],
    enabled: !!binanceSymbol,
    queryFn: ({ signal }) =>
      fetchOrderBookSnapshot(futuresRestUrl, binanceSymbol!, signal),
    refetchInterval: REST_REFRESH_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// --- Socket hook (WS updates into query cache) ---

export function useOrderBookSocket() {
  const { binanceSymbol, queryKey } = useSelectedOrderBookQueryKey();
  // <symbol>@depth<levels>@<speed> is a /public-routed stream; route it
  // explicitly so it survives the eventual full legacy-/ws decommission.
  const { futuresPublicWsUrl } = useBinanceApiUrls();
  const queryClient = useQueryClient();
  const isVisible = usePageVisible();

  useEffect(() => {
    if (!binanceSymbol || !isVisible) return;

    const url = getOrderBookStreamUrl(futuresPublicWsUrl, binanceSymbol);
    let stopped = false;
    let fallbackActive = false;
    let sawBinanceDepthUpdate = false;
    let fallbackProbeTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackPollTimer: ReturnType<typeof setTimeout> | undefined;

    const clearFallbackProbe = () => {
      if (fallbackProbeTimer) {
        clearTimeout(fallbackProbeTimer);
        fallbackProbeTimer = undefined;
      }
    };

    const stopFallback = () => {
      fallbackActive = false;
      if (fallbackPollTimer) {
        clearTimeout(fallbackPollTimer);
        fallbackPollTimer = undefined;
      }
    };

    const pollHedgerOrderBook = async () => {
      if (stopped || !fallbackActive) return;

      try {
        const snapshot = await fetchHedgerOrderBookSnapshot(binanceSymbol);
        if (!stopped && fallbackActive) {
          queryClient.setQueryData<OrderBookData>(queryKey, snapshot);
        }
      } catch (error) {
        if (!stopped && fallbackActive) {
          console.error(
            `[OrderBook fallback] hedger depth failed: ${binanceSymbol}`,
            error,
          );
        }
      } finally {
        if (!stopped && fallbackActive) {
          fallbackPollTimer = setTimeout(
            pollHedgerOrderBook,
            HEDGER_ORDER_BOOK_POLL_MS,
          );
        }
      }
    };

    const startFallback = (reason: string) => {
      if (stopped || fallbackActive) return;
      clearFallbackProbe();
      fallbackActive = true;
      console.warn(`[OrderBook fallback] ${reason}: ${binanceSymbol}`);
      void pollHedgerOrderBook();
    };

    fallbackProbeTimer = setTimeout(
      () => {
        if (!sawBinanceDepthUpdate) {
          startFallback("Binance depth stream produced no data");
        }
      },
      BINANCE_DEPTH_FIRST_MESSAGE_TIMEOUT_MS,
    );

    const unsubscribe = binanceWs.subscribe(url, {
      onOpen: () => console.log(`[OrderBook WS] connected: ${binanceSymbol}`),
      onError: (event) => {
        console.error(`[OrderBook WS] error: ${binanceSymbol}`, event);
        startFallback("Binance depth stream error");
      },
      onClose: (event) => {
        console.log(
          `[OrderBook WS] closed: ${binanceSymbol}`,
          event.code,
          event.reason,
        );
        startFallback("Binance depth stream closed");
      },
      onMessage: (data) => {
        sawBinanceDepthUpdate = true;
        clearFallbackProbe();
        stopFallback();
        const msg = data as BinanceDepthMessage;
        const { rawBids, rawAsks } = extractDepthLevels(msg);
        queryClient.setQueryData<OrderBookData>(queryKey, (prev) => {
          if (!prev) return prev;
          return mergeTopDepthUpdate(prev, rawBids, rawAsks);
        });
      },
    });

    return () => {
      stopped = true;
      clearFallbackProbe();
      stopFallback();
      unsubscribe();
    };
  }, [binanceSymbol, queryKey, queryClient, isVisible, futuresPublicWsUrl]);
}

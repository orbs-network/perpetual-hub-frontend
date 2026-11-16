import { useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BINANCE_CONFIG, DEFAULT_PRICE_SOURCE, WS_URL } from "../config/constants";
import { useMarkets } from "./useMarkets";
import { usePageVisible } from "./usePageVisible";
import type { Symbol } from "../config/constants";
import type { PriceData } from "@/types";
import { normalizeSymbol } from "@/lib/utils";
import { binanceWs } from "@/lib/binance/wsClient";
import {
  fetchHedgerMarketData,
  type HedgerMarketDataEntry,
} from "@/api/marketData";

// --- Query key ---

// --- Binance types ---

interface BinanceTickerRest {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
}

interface BinancePremiumIndexRest {
  symbol: string;
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

interface BinanceTickerMessage {
  e: "24hrTicker";
  E: number;
  s: string;
  p: string;
  P: string;
  w: string;
  c: string;
  Q: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
}

interface BinanceMarkPriceMessage {
  e: "markPriceUpdate";
  E: number;
  s: string;
  p: string;
  i: string;
  P: string;
  r: string;
  T: number;
}

// --- REST fetch ---
interface HedgerMarketDataMessage {
  type: "MARKET_DATA_SNAPSHOT" | "MARKET_DATA_UPDATE";
  channel: "market_data";
  data: HedgerMarketDataEntry[];
}

const BINANCE_WS_FALLBACK_TIMEOUT_MS = 2500;
const HEDGER_FALLBACK_RECONNECT_MS = 3000;
const PRICE_REST_REFETCH_INTERVAL_MS = 10_000;

function parseOptionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasSamePriceData(left: PriceData, right: PriceData) {
  return (
    left.symbol === right.symbol &&
    left.price === right.price &&
    left.markPrice === right.markPrice &&
    left.priceChangePercent === right.priceChangePercent &&
    left.high24h === right.high24h &&
    left.low24h === right.low24h &&
    left.volume24h === right.volume24h &&
    left.fundingRate === right.fundingRate &&
    left.lastUpdated === right.lastUpdated &&
    left.nextFundingTime === right.nextFundingTime
  );
}

export function mergePriceUpdates(
  previous: Record<string, PriceData> | undefined,
  updates: Record<string, Partial<PriceData>>,
  now = Date.now(),
): Record<string, PriceData> {
  const currentPrices = previous ?? {};
  let nextPrices: Record<string, PriceData> | undefined;

  for (const [symbol, data] of Object.entries(updates)) {
    const current = currentPrices[symbol];
    const price = data.price ?? current?.price;
    if (!price) continue;

    const merged: PriceData = {
      symbol: (current?.symbol ?? symbol) as Symbol,
      price,
      priceChangePercent:
        data.priceChangePercent ?? current?.priceChangePercent ?? 0,
      high24h: data.high24h ?? current?.high24h ?? 0,
      low24h: data.low24h ?? current?.low24h ?? 0,
      volume24h: data.volume24h ?? current?.volume24h ?? 0,
      lastUpdated: data.lastUpdated ?? current?.lastUpdated ?? now,
      markPrice: data.markPrice ?? current?.markPrice,
      fundingRate: data.fundingRate ?? current?.fundingRate,
      nextFundingTime: data.nextFundingTime ?? current?.nextFundingTime,
    };

    if (current && hasSamePriceData(current, merged)) continue;

    nextPrices ??= { ...currentPrices };
    nextPrices[symbol] = merged;
  }

  return nextPrices ?? currentPrices;
}

export function hedgerMarketDataToPrices(
  entries: HedgerMarketDataEntry[],
  now = Date.now(),
): Record<string, PriceData> {
  const prices: Record<string, PriceData> = {};
  for (const entry of entries) {
    const symbol = normalizeSymbol(entry.symbol);
    const price = parseOptionalNumber(entry.price) ?? parseOptionalNumber(entry.markPrice);
    if (!price || price <= 0) continue;

    prices[symbol] = {
      symbol: symbol as Symbol,
      price,
      markPrice: parseOptionalNumber(entry.markPrice),
      priceChangePercent: parseOptionalNumber(entry.priceChangePercent) ?? 0,
      high24h: parseOptionalNumber(entry.high24h) ?? 0,
      low24h: parseOptionalNumber(entry.low24h) ?? 0,
      volume24h: parseOptionalNumber(entry.volume24h) ?? 0,
      fundingRate: parseOptionalNumber(entry.fundingRate),
      nextFundingTime: entry.nextFundingTime,
      lastUpdated: entry.updatedAt || now,
    };
  }
  return prices;
}

export async function fetchBinancePrices(
  restUrl: string,
  signal?: AbortSignal,
): Promise<Record<string, PriceData>> {
  const [tickerRes, premiumRes] = await Promise.all([
    fetch(`${restUrl}/fapi/v1/ticker/24hr`, { signal }),
    fetch(`${restUrl}/fapi/v1/premiumIndex`, { signal }),
  ]);
  if (!tickerRes.ok)
    throw new Error(`Binance ticker REST ${tickerRes.status}`);
  if (!premiumRes.ok)
    throw new Error(`Binance premium REST ${premiumRes.status}`);

  const [tickers, premiums]: [
    BinanceTickerRest[],
    BinancePremiumIndexRest[],
  ] = await Promise.all([tickerRes.json(), premiumRes.json()]);

  const prices: Record<string, PriceData> = {};
  const now = Date.now();
  for (const t of tickers) {
    const symbol = normalizeSymbol(t.symbol);
    prices[symbol] = {
      symbol: symbol as Symbol,
      price: parseFloat(t.lastPrice),
      priceChangePercent: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      volume24h: parseFloat(t.quoteVolume),
      lastUpdated: now,
    };
  }

  for (const p of premiums) {
    const symbol = normalizeSymbol(p.symbol);
    const entry = prices[symbol];
    if (!entry) continue;
    const markPrice = parseFloat(p.markPrice);
    const fundingRate = parseFloat(p.lastFundingRate);
    const nextFundingTime = p.nextFundingTime;
    if (!Number.isNaN(markPrice)) entry.markPrice = markPrice;
    if (!Number.isNaN(fundingRate)) entry.fundingRate = fundingRate;
    if (!Number.isNaN(nextFundingTime)) entry.nextFundingTime = nextFundingTime;
  }

  return prices;
}

export async function fetchPricesWithHedgerFallback(
  restUrl: string,
  signal?: AbortSignal,
  fallbackFetcher: (signal?: AbortSignal) => Promise<HedgerMarketDataEntry[]> =
    fetchHedgerMarketData,
): Promise<Record<string, PriceData>> {
  try {
    return await fetchBinancePrices(restUrl, signal);
  } catch (binanceErr) {
    const fallback = hedgerMarketDataToPrices(await fallbackFetcher(signal));
    if (Object.keys(fallback).length > 0) return fallback;
    throw binanceErr;
  }
}

// --- Main hook ---

/**
 * Fetches initial prices from Binance REST, then keeps them updated
 * via WebSocket. Prices live in the React Query cache.
 */

const useQueryKey = () => {
  const priceSource = DEFAULT_PRICE_SOURCE;
  return useMemo(
    () => ["binance-prices", priceSource],
    [priceSource],
  );
};
export function useBinanceSocket() {
  const priceSource = DEFAULT_PRICE_SOURCE;
  const { data: markets } = useMarkets();
  const queryClient = useQueryClient();
  const isVisible = usePageVisible();

  const queryKey = useQueryKey();

  const mergePrices = useCallback(
    (updates: Record<string, Partial<PriceData>>) => {
      queryClient.setQueryData<Record<string, PriceData>>(queryKey, (prev) =>
        mergePriceUpdates(prev, updates),
      );
    },
    [queryClient, queryKey],
  );


  const updatePricesRef = useRef(mergePrices);
  useEffect(() => {
    updatePricesRef.current = mergePrices;
  }, [mergePrices]);

  const fallbackCleanupRef = useRef<(() => void) | null>(null);
  const fallbackReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const binanceMessageSeenRef = useRef(false);

  const clearFallbackReconnect = useCallback(() => {
    if (fallbackReconnectRef.current) {
      clearTimeout(fallbackReconnectRef.current);
      fallbackReconnectRef.current = null;
    }
  }, []);

  const stopHedgerFallback = useCallback(() => {
    clearFallbackReconnect();
    fallbackCleanupRef.current?.();
    fallbackCleanupRef.current = null;
  }, [clearFallbackReconnect]);

  const startHedgerFallback = useCallback(() => {
    if (fallbackCleanupRef.current) return;

    const connect = () => {
      if (fallbackCleanupRef.current) return;
      let socket: WebSocket | null = null;
      let closed = false;

      const reconnect = () => {
        if (closed || fallbackCleanupRef.current !== cleanup) return;
        fallbackCleanupRef.current = null;
        fallbackReconnectRef.current = setTimeout(() => {
          fallbackReconnectRef.current = null;
          connect();
        }, HEDGER_FALLBACK_RECONNECT_MS);
      };

      const cleanup = () => {
        closed = true;
        if (!socket) return;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        socket = null;
      };

      fallbackCleanupRef.current = cleanup;
      try {
        socket = new WebSocket(WS_URL);
        socket.onopen = () => {
          socket?.send(
            JSON.stringify({
              type: "SUBSCRIBE",
              channels: ["market_data"],
            }),
          );
        };
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as HedgerMarketDataMessage;
            if (
              message.channel !== "market_data" ||
              (message.type !== "MARKET_DATA_SNAPSHOT" &&
                message.type !== "MARKET_DATA_UPDATE") ||
              !Array.isArray(message.data)
            ) {
              return;
            }
            updatePricesRef.current(hedgerMarketDataToPrices(message.data));
          } catch (err) {
            console.error("Failed to parse hedger market data:", err);
          }
        };
        socket.onerror = reconnect;
        socket.onclose = reconnect;
      } catch {
        reconnect();
      }
    };

    connect();
  }, []);

  // WebSocket for real-time updates — disconnect when tab is hidden.
  // WS lifecycle is owned by the singleton `binanceWs` client, which keeps
  // exactly one WebSocket per stream URL regardless of how many components
  // mount this hook. Subscribe/unsubscribe is refcounted; reconnect-on-close
  // and stale-handler protection live in the client, not here.
  //
  // CRITICAL: deps must be stable references. `useMarkets()` returns a new
  // `data` array on most renders (its outer useMemo depends on the whole
  // `query` object from `useQuery`, which is fresh per render). Passing
  // `markets` directly into deps would tear down + reopen these sockets on
  // every parent render. We only need to know whether markets exist, not
  // the array identity, so we collapse to a boolean here.
  const hasMarkets = (markets?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasMarkets || !isVisible) return;

    binanceMessageSeenRef.current = false;
    const baseUrl = BINANCE_CONFIG[priceSource].futuresMarketWsUrl;
    const tickerUrl = `${baseUrl}/!ticker@arr`;
    const markUrl = `${baseUrl}/!markPrice@arr@1s`;
    fallbackTimerRef.current = setTimeout(() => {
      if (!binanceMessageSeenRef.current) {
        startHedgerFallback();
      }
    }, BINANCE_WS_FALLBACK_TIMEOUT_MS);

    const markBinanceLive = () => {
      binanceMessageSeenRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      stopHedgerFallback();
    };

    const fallbackOnBinanceFailure = () => {
      if (!binanceMessageSeenRef.current) {
        startHedgerFallback();
      }
    };

    const unsubscribeTicker = binanceWs.subscribe(tickerUrl, {
      onOpen: () => console.log("[Binance WS] Ticker connected"),
      onError: (error) => {
        console.error("[Binance WS] Ticker error:", error);
        fallbackOnBinanceFailure();
      },
      onClose: (event) => {
        console.log("[Binance WS] Ticker closed:", event.code, event.reason);
        fallbackOnBinanceFailure();
      },
      onMessage: (data) => {
        const tickers = data as BinanceTickerMessage[];
        if (!Array.isArray(tickers)) return;
        const merged: Record<string, Partial<PriceData>> = {};
        for (const msg of tickers) {
          if (msg.e !== "24hrTicker") continue;
          const symbol = normalizeSymbol(msg.s);
          merged[symbol] = {
            ...merged[symbol],
            price: parseFloat(msg.c),
            priceChangePercent: parseFloat(msg.P),
            high24h: parseFloat(msg.h),
            low24h: parseFloat(msg.l),
            volume24h: parseFloat(msg.q),
          };
        }
        if (Object.keys(merged).length > 0) {
          markBinanceLive();
          updatePricesRef.current(merged);
        }
      },
    });

    const unsubscribeMark = binanceWs.subscribe(markUrl, {
      onOpen: () => console.log("[Binance WS] Mark price connected"),
      onError: (error) => {
        console.error("[Binance WS] Mark price error:", error);
        fallbackOnBinanceFailure();
      },
      onClose: (event) => {
        console.log("[Binance WS] Mark price closed:", event.code, event.reason);
        fallbackOnBinanceFailure();
      },
      onMessage: (data) => {
        const messages = data as BinanceMarkPriceMessage[];
        if (!Array.isArray(messages)) return;
        const merged: Record<string, Partial<PriceData>> = {};
        for (const msg of messages) {
          if (msg.e !== "markPriceUpdate") continue;
          const symbol = normalizeSymbol(msg.s);
          const rate = parseFloat(msg.r);
          const markPrice = parseFloat(msg.p);
          const update: Partial<PriceData> = { ...merged[symbol] };
          if (!Number.isNaN(markPrice)) update.markPrice = markPrice;
          if (!Number.isNaN(rate)) update.fundingRate = rate;
          if (Object.keys(update).length > 0) {
            merged[symbol] = update;
          }
        }
        if (Object.keys(merged).length > 0) {
          markBinanceLive();
          updatePricesRef.current(merged);
        }
      },
    });

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      unsubscribeTicker();
      unsubscribeMark();
      stopHedgerFallback();
    };
  }, [priceSource, isVisible, hasMarkets, startHedgerFallback, stopHedgerFallback]);
}

export const useAllPrices = () => {
  const queryClient = useQueryClient();
  const queryKey = useQueryKey();
  const query = usePriceQuery();

  return useMemo(() => {
    return {
      ...query,
      clear: () => queryClient.removeQueries({ queryKey }),
    };
  }, [query, queryClient, queryKey]);
};

function usePriceQuery<TData = Record<string, PriceData>>(
  select?: (prices: Record<string, PriceData>) => TData,
) {
  const priceSource = DEFAULT_PRICE_SOURCE;
  const restUrl = BINANCE_CONFIG[priceSource].futuresRestUrl;
  const queryKey = useQueryKey();

  return useQuery<Record<string, PriceData>, Error, TData>({
    queryKey,
    queryFn: ({ signal }) => fetchPricesWithHedgerFallback(restUrl, signal),
    select,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: PRICE_REST_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

function priceLookupKeys(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return [];
  return normalized.endsWith("USDT")
    ? [normalized, normalized.slice(0, -4)]
    : [normalized, `${normalized}USDT`];
}

export const usePrices = (symbols: readonly string[]) => {
  const normalizedSymbols = useMemo(
    () => [...new Set(symbols.map(normalizeSymbol).filter(Boolean))].sort(),
    [symbols],
  );
  const selectPrices = useCallback(
    (prices: Record<string, PriceData>) => {
      const selected: Record<string, PriceData> = {};
      for (const symbol of normalizedSymbols) {
        for (const key of priceLookupKeys(symbol)) {
          const price = prices[key];
          if (price) selected[key] = price;
        }
      }
      return selected;
    },
    [normalizedSymbols],
  );

  return usePriceQuery(selectPrices);
};

export const usePrice = (symbol?: string) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const selectPrice = useCallback(
    (prices: Record<string, PriceData>) =>
      normalizedSymbol ? prices[normalizedSymbol] : undefined,
    [normalizedSymbol],
  );
  return usePriceQuery(selectPrice).data;
};

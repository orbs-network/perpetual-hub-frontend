import type { ChartCandle, ChartPeriod } from "./model";
import { BINANCE_CONFIG, type PriceSource } from "@/config/constants";
import type { MarketInfo } from "@/api/markets";
import { fetchHedgerKlines, type HedgerKline } from "@/api/marketData";
import { binanceWs } from "@/lib/binance/wsClient";

/** Market metadata consumed by the application chart, with no engine types. */
export interface ChartSymbolInfo {
  ticker: string;
}

export interface ChartDataLoaderGetBarsParams {
  /** forward loads candles older than timestamp; init loads the latest history. */
  type: "init" | "forward";
  timestamp: number | null;
  symbol: ChartSymbolInfo;
  period: ChartPeriod;
  callback: (
    bars: ChartCandle[],
    more: boolean,
  ) => void;
}

export interface ChartDataLoaderSubscribeBarParams {
  symbol: ChartSymbolInfo;
  period: ChartPeriod;
  callback: (bar: ChartCandle) => void;
}

export interface ChartDataLoader {
  getBars: (params: ChartDataLoaderGetBarsParams) => void | Promise<void>;
  subscribeBar: (params: ChartDataLoaderSubscribeBarParams) => void;
  unsubscribeBar: (params: { symbol: ChartSymbolInfo; period: ChartPeriod }) => void;
}

const HISTORY_LIMIT = 1500;
const WS_FALLBACK_TIMEOUT_MS = 2500;
const HEDGER_POLL_MS = 10_000;

const SUPPORTED_INTERVALS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

/** Candle periods use explicit units; month and minute must stay distinct. */
export function periodToBinanceInterval(period: ChartPeriod): string | null {
  const suffix = {
    minute: "m",
    hour: "h",
    day: "d",
    week: "w",
    month: "M",
    second: "s",
    year: "y",
  }[period.type];
  const interval = `${period.span}${suffix}`;
  return SUPPORTED_INTERVALS.has(interval) ? interval : null;
}

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  ...unknown[],
];

function validBar(bar: ChartCandle): boolean {
  return (
    Number.isSafeInteger(bar.timestamp) &&
    bar.timestamp >= 0 &&
    [bar.open, bar.high, bar.low, bar.close].every(
      (value) => Number.isFinite(value) && value > 0,
    ) &&
    Number.isFinite(bar.volume) &&
    (bar.volume ?? -1) >= 0
  );
}

function binanceBar(row: BinanceKline): ChartCandle {
  const rawTurnover = row[7];
  const turnover =
    typeof rawTurnover === "number" ||
    (typeof rawTurnover === "string" && rawTurnover.trim() !== "")
      ? Number(rawTurnover)
      : NaN;
  return {
    timestamp: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    ...(Number.isFinite(turnover) && turnover >= 0 ? { turnover } : {}),
  };
}

function hedgerBar(row: HedgerKline): ChartCandle {
  return {
    timestamp: row.openTime,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  };
}

function normalizeBars(bars: ChartCandle[], before?: number): ChartCandle[] {
  const unique = new Map<number, ChartCandle>();
  for (const bar of bars) {
    if (validBar(bar) && (before === undefined || bar.timestamp < before)) {
      unique.set(bar.timestamp, bar);
    }
  }
  return [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function sessionKey(symbol: ChartSymbolInfo, period: ChartPeriod): string {
  return `${symbol.ticker}:${period.type}:${period.span}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load chart data";
}

/**
 * Market data only. Rendering is separate; backend prices and order handling
 * continue using their existing exact-price APIs independently of this adapter.
 */
export class MarketChartDatafeed {
  private generation = 0;
  private activeKey: string | null = null;
  private destroyed = false;
  private requests = new Set<AbortController>();
  private subscriptions = new Map<string, () => void>();
  private historyError: string | null = null;
  private liveError: string | null = null;
  private readonly priceSource: PriceSource;
  private markets: MarketInfo[];
  private readonly onError?: (message: string | null) => void;

  constructor(
    priceSource: PriceSource,
    markets: MarketInfo[],
    onError?: (message: string | null) => void,
  ) {
    this.priceSource = priceSource;
    this.markets = markets;
    this.onError = onError;
  }

  updateMarkets(markets: MarketInfo[]): void {
    this.markets = markets;
  }

  resolveSymbol(ticker: string): ChartSymbolInfo | null {
    const market = this.markets.find(
      (candidate) => candidate.symbol === ticker,
    );
    return market
      ? { ticker: market.symbol }
      : null;
  }

  createDataLoader(): ChartDataLoader {
    return {
      getBars: (params) => this.getBars(params),
      subscribeBar: (params) => this.subscribe(params),
      unsubscribeBar: ({ symbol, period }) => {
        const key = sessionKey(symbol, period);
        this.subscriptions.get(key)?.();
        this.subscriptions.delete(key);
        if (this.activeKey === key) this.endSession();
      },
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.endSession();
  }

  private endSession(): void {
    this.generation += 1;
    this.activeKey = null;
    this.historyError = null;
    this.liveError = null;
    for (const stop of this.subscriptions.values()) stop();
    this.subscriptions.clear();
    for (const controller of this.requests) controller.abort();
    this.requests.clear();
  }

  private activate(key: string, reset = false): number {
    if (reset || key !== this.activeKey) {
      this.endSession();
      this.activeKey = key;
    }
    return this.generation;
  }

  private isCurrent(key: string, generation: number): boolean {
    return (
      !this.destroyed &&
      this.activeKey === key &&
      generation === this.generation
    );
  }

  private reportError(
    source: "history" | "live",
    message: string | null,
  ): void {
    if (source === "history") this.historyError = message;
    else this.liveError = message;
    // A working live tick cannot recover missing historical candles. Keep the
    // history error/retry affordance until history itself has been reloaded.
    this.onError?.(this.historyError ?? this.liveError);
  }

  private async getBars({
    type,
    timestamp,
    symbol,
    period,
    callback,
  }: ChartDataLoaderGetBarsParams): Promise<void> {
    if (this.destroyed) return;
    const key = sessionKey(symbol, period);
    // Ignore late pagination requests for a chart which has since changed.
    if (type !== "init" && this.activeKey !== null && this.activeKey !== key)
      return;
    const generation = this.activate(key, type === "init");
    const interval = periodToBinanceInterval(period);
    if (!interval) {
      this.reportError("history", "Unsupported chart interval");
      callback([], false);
      return;
    }
    const before =
      type === "forward" && timestamp !== null ? timestamp : undefined;
    const endTime = before !== undefined ? before - 1 : Date.now();
    if (endTime < 0) {
      callback([], false);
      return;
    }
    const params = {
      symbol: symbol.ticker,
      interval,
      endTime,
      limit: HISTORY_LIMIT,
    };
    const controller = new AbortController();
    this.requests.add(controller);
    const url = new URL(
      `${BINANCE_CONFIG[this.priceSource].futuresRestUrl}/fapi/v1/klines`,
    );
    for (const [name, value] of Object.entries(params))
      url.searchParams.set(name, String(value));

    let bars: ChartCandle[];
    try {
      let rawBars: ChartCandle[];
      try {
        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error("Invalid candle response");
        rawBars = rows
          .filter(Array.isArray)
          .map((row) => binanceBar(row as BinanceKline));
      } catch {
        if (!this.isCurrent(key, generation) || controller.signal.aborted)
          return;
        rawBars = (await fetchHedgerKlines(params, controller.signal)).map(
          hedgerBar,
        );
      }
      if (!this.isCurrent(key, generation)) return;
      bars = normalizeBars(rawBars, before);
    } catch (error) {
      if (!this.isCurrent(key, generation) || controller.signal.aborted) return;
      this.reportError("history", errorMessage(error));
      callback([], false);
      return;
    } finally {
      this.requests.delete(controller);
    }
    // Consumer/render errors are not market-data failures. Deliver only once;
    // never retry a chart callback with empty history if rendering throws.
    if (!this.isCurrent(key, generation)) return;
    this.reportError("history", null);
    callback(bars, bars.length > 0);
  }

  private subscribe({
    symbol,
    period,
    callback,
  }: ChartDataLoaderSubscribeBarParams): void {
    if (this.destroyed) return;
    const key = sessionKey(symbol, period);
    if (this.activeKey !== null && this.activeKey !== key) return;
    const generation = this.activate(key);
    this.subscriptions.get(key)?.();
    const interval = periodToBinanceInterval(period);
    if (!interval) return;

    let stopped = false;
    let socketOpened = false;
    let polling = false;
    let pollInFlight = false;
    let pollEpoch = 0;
    let lastTimestamp = -1;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let pollRequest: AbortController | null = null;
    const current = () => !stopped && this.isCurrent(key, generation);
    const emit = (bar: ChartCandle) => {
      if (!current() || !validBar(bar) || bar.timestamp < lastTimestamp) return;
      lastTimestamp = bar.timestamp;
      this.reportError("live", null);
      callback(bar);
    };
    const stopFallback = () => {
      pollEpoch += 1;
      clearTimeout(fallbackTimer);
      clearInterval(pollTimer);
      pollRequest?.abort();
      fallbackTimer = undefined;
      pollTimer = undefined;
      polling = false;
    };
    const poll = async () => {
      if (!current() || !polling || pollInFlight) return;
      pollInFlight = true;
      const epoch = pollEpoch;
      const controller = new AbortController();
      pollRequest = controller;
      try {
        const rows = await fetchHedgerKlines(
          { symbol: symbol.ticker, interval, limit: 1 },
          controller.signal,
        );
        if (current() && polling && epoch === pollEpoch) {
          const latest = rows.at(-1);
          if (latest) emit(hedgerBar(latest));
        }
      } catch (error) {
        if (current() && !controller.signal.aborted && epoch === pollEpoch) {
          this.reportError("live", errorMessage(error));
        }
      } finally {
        if (pollRequest === controller) pollRequest = null;
        pollInFlight = false;
      }
    };
    const startFallback = () => {
      if (!current() || polling) return;
      polling = true;
      void poll();
      pollTimer = setInterval(() => {
        void poll();
      }, HEDGER_POLL_MS);
    };

    fallbackTimer = setTimeout(() => {
      if (!socketOpened) startFallback();
    }, WS_FALLBACK_TIMEOUT_MS);

    const wsSymbol = symbol.ticker.toLowerCase();
    const url = `${BINANCE_CONFIG[this.priceSource].futuresMarketWsUrl}/${wsSymbol}@kline_${interval}`;
    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = binanceWs.subscribe(url, {
        onOpen: () => {
          if (!current()) return;
          socketOpened = true;
          stopFallback();
        },
        onError: () => startFallback(),
        onClose: () => {
          socketOpened = false;
          startFallback();
        },
        onMessage: (data) => {
          if (!current()) return;
          const message = data as {
            e?: string;
            k?: {
              t: number;
              o: string;
              h: string;
              l: string;
              c: string;
              v: string;
              q?: string;
            };
          };
          if (message?.e !== "kline" || !message.k) return;
          const { t, o, h, l, c, v, q } = message.k;
          // Quote-volume is the actual candle turnover, not close × volume.
          emit(binanceBar([t, o, h, l, c, v, undefined, q]));
        },
      });
    } catch {
      // A browser which cannot establish a WebSocket still has the backend
      // polling path. Do not let subscription setup clear loaded history.
      startFallback();
    }

    this.subscriptions.set(key, () => {
      stopped = true;
      stopFallback();
      unsubscribe();
    });
  }
}

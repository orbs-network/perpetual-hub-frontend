import { ORDER_BOOK_REST_DEPTH_LIMIT } from "@/config/constants";
import type {
  BinanceDepthMessage,
  OrderBookData,
  OrderBookLevel,
  RawDepthLevel,
} from "@/types";


const WS_DEPTH_LEVELS = 20;
const WS_DEPTH_UPDATE_SPEED = "500ms";

export function parseLevels(
  raw: RawDepthLevel[],
  side: "bid" | "ask",
): OrderBookLevel[] {
  let cumulative = 0;
  return raw
    .map(([priceStr, sizeStr]) => ({
      price: parseFloat(priceStr),
      size: parseFloat(sizeStr),
      total: 0,
    }))
    .filter(
      (level) => Number.isFinite(level.price) && Number.isFinite(level.size),
    )
    .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price))
    .map((level) => {
      cumulative += level.size;
      return { ...level, total: cumulative };
    });
}

function recalculateTotals(levels: OrderBookLevel[]): OrderBookLevel[] {
  let cumulative = 0;
  return levels.map((level) => {
    cumulative += level.size;
    return { ...level, total: cumulative };
  });
}

export function buildOrderBookData(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
): OrderBookData {
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const midPrice = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0;
  return { bids, asks, midPrice };
}

export function extractDepthLevels(msg: BinanceDepthMessage): {
  rawBids: RawDepthLevel[];
  rawAsks: RawDepthLevel[];
} {
  return {
    rawBids: msg.bids ?? msg.b ?? [],
    rawAsks: msg.asks ?? msg.a ?? [],
  };
}

export function mergeTopDepthUpdate(
  prev: OrderBookData | null,
  rawBids: RawDepthLevel[],
  rawAsks: RawDepthLevel[],
): OrderBookData {
  const wsAsks = parseLevels(rawAsks, "ask");
  const wsBids = parseLevels(rawBids, "bid");

  const prevAsks = prev?.asks ?? [];
  const prevBids = prev?.bids ?? [];

  const deepestWsAsk = wsAsks.at(-1)?.price;
  const deepestWsBid = wsBids.at(-1)?.price;

  const deepAsks =
    deepestWsAsk === undefined
      ? prevAsks
      : prevAsks.filter((level) => level.price > deepestWsAsk);
  const deepBids =
    deepestWsBid === undefined
      ? prevBids
      : prevBids.filter((level) => level.price < deepestWsBid);

  const asks = recalculateTotals(
    [...wsAsks, ...deepAsks].slice(0, ORDER_BOOK_REST_DEPTH_LIMIT),
  );
  const bids = recalculateTotals(
    [...wsBids, ...deepBids].slice(0, ORDER_BOOK_REST_DEPTH_LIMIT),
  );

  return buildOrderBookData(bids, asks);
}

function decimalPlaces(value: number): number {
  const valueText = value.toString().toLowerCase();
  const exponentMatch = valueText.match(/^(\d+(?:\.(\d+))?)e-(\d+)$/);
  if (exponentMatch) {
    return Number(exponentMatch[3]) + (exponentMatch[2]?.length ?? 0);
  }
  return valueText.split(".")[1]?.length ?? 0;
}

const GROUPING_BASE_PRICE_FRACTION = 0.000001;
const GROUPING_BASE_MULTIPLIERS = [1, 10, 20, 50] as const;

function niceFloor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const normalized = value / base;

  if (normalized >= 5) return 5 * base;
  if (normalized >= 2) return 2 * base;
  return base;
}

function snapGroupingTick(value: number, minimumTick: number): number {
  const decimalScale = Math.max(decimalPlaces(value), decimalPlaces(minimumTick));
  const scale = 10 ** Math.min(decimalScale, 8);
  const tickUnits = Math.max(1, Math.round(minimumTick * scale));
  const valueUnits = Math.max(
    tickUnits,
    Math.ceil((value * scale - 1e-6) / tickUnits) * tickUnits,
  );

  return Number((valueUnits / scale).toFixed(Math.min(decimalScale, 8)));
}

export function buildGroupingTicks(
  minimumTick: number,
  referencePrice: number | undefined,
): number[] {
  // if (!Number.isFinite(minimumTick) || minimumTick <= 0) return [0];

  const targetBase =
    Number.isFinite(referencePrice) && referencePrice && referencePrice > 0
      ? Math.max(
          minimumTick,
          niceFloor(referencePrice * GROUPING_BASE_PRICE_FRACTION),
        )
      : minimumTick;
  const baseTick = snapGroupingTick(targetBase, minimumTick);
  const ticks = [0];

  for (const multiplier of GROUPING_BASE_MULTIPLIERS) {
    const tick = snapGroupingTick(baseTick * multiplier, minimumTick);
    if (!ticks.includes(tick)) ticks.push(tick);
  }

  return ticks;
}

/**
 * Group order book levels by a price tick size.
 * Bids are floored to the nearest tick; asks are ceiled.
 * Sizes within a bucket are summed, totals recalculated.
 */
export function groupLevels(
  levels: OrderBookLevel[],
  tickSize: number,
  side: "bid" | "ask",
): OrderBookLevel[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0 || levels.length === 0) {
    return levels;
  }

  const buckets = new Map<number, number>();
  const decimalScale = Math.max(
    decimalPlaces(tickSize),
    ...levels.map((level) => decimalPlaces(level.price)),
  );
  const scale = 10 ** Math.min(decimalScale, 8);
  const tickUnits = Math.max(1, Math.round(tickSize * scale));

  for (const level of levels) {
    const priceUnits = Math.round(level.price * scale);
    const bucketUnits =
      side === "bid"
        ? Math.floor(priceUnits / tickUnits) * tickUnits
        : Math.ceil(priceUnits / tickUnits) * tickUnits;
    buckets.set(bucketUnits, (buckets.get(bucketUnits) ?? 0) + level.size);
  }

  const sorted = [...buckets.entries()].sort((a, b) =>
    side === "ask" ? a[0] - b[0] : b[0] - a[0],
  );

  let cumulative = 0;
  return sorted.map(([priceUnits, size]) => {
    cumulative += size;
    return { price: priceUnits / scale, size, total: cumulative };
  });
}

export function getOrderBookStreamUrl(
  // /public-routed endpoint base; <symbol>@depth<levels>@<speed> lives on /public.
  futuresPublicWsUrl: string,
  binanceSymbol: string,
): string {
  const stream = `${binanceSymbol.toLowerCase()}@depth${WS_DEPTH_LEVELS}@${WS_DEPTH_UPDATE_SPEED}`;
  return `${futuresPublicWsUrl}/${stream}`;
}

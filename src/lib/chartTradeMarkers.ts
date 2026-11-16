import type { TradeItem } from "@/types";
import { safeUpperCase } from "@/lib/utils";
import {
  domainPriceToDisplayNumber,
  formatDisplayPrice,
  fromScaledQuantity,
} from "@/utils/formatting";

export type ChartTradeMarkerSide = "BUY" | "SELL";

export interface ChartTradeMarker {
  id: number;
  side: ChartTradeMarkerSide;
  label: "B" | "S";
  time: number;
  price: number;
  displayTime: number;
  displayPrice: number;
  quantity: string;
  stackIndex: number;
  stackSize: number;
  tooltip: string;
}

const DEFAULT_MAX_MARKERS = 100;
const DEFAULT_RESOLUTION_SECONDS = 60 * 60;

type ChartTradeMarkerInput = TradeItem | null | undefined;

export function normalizeTradeSide(
  side: string | null | undefined,
): ChartTradeMarkerSide | null {
  const normalized = safeUpperCase(side);
  if (normalized === "BUY" || normalized === "SELL") return normalized;
  return null;
}

function formatQuantity(quantity: string): string {
  try {
    return fromScaledQuantity(BigInt(quantity));
  } catch {
    return quantity || "-";
  }
}

function tradeActionLabel(side: ChartTradeMarkerSide, isClose: boolean): string {
  if (side === "BUY") return isClose ? "Close Short" : "Open Long";
  return isClose ? "Close Long" : "Open Short";
}

export function resolutionToBucketSeconds(resolution: string): number {
  const normalized = safeUpperCase(resolution);

  if (/^\d+$/.test(normalized)) {
    const minutes = Number(normalized);
    return minutes > 0 ? minutes * 60 : DEFAULT_RESOLUTION_SECONDS;
  }

  const match = normalized.match(/^(\d+)?([DWM])$/);
  if (!match) return DEFAULT_RESOLUTION_SECONDS;

  const amount = Number(match[1] ?? "1");
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_RESOLUTION_SECONDS;

  if (unit === "D") return amount * 24 * 60 * 60;
  if (unit === "W") return amount * 7 * 24 * 60 * 60;
  return amount * 30 * 24 * 60 * 60;
}

function tradeTimeToBarTime(time: number, resolution: string): number {
  const normalized = safeUpperCase(resolution);

  if (normalized === "1M" || normalized === "M") {
    const date = new Date(time * 1000);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
  }

  const bucketSeconds = resolutionToBucketSeconds(resolution);

  if (normalized.endsWith("W")) {
    const mondayOffsetSeconds = 4 * 24 * 60 * 60;
    return (
      Math.floor((time - mondayOffsetSeconds) / bucketSeconds) * bucketSeconds +
      mondayOffsetSeconds
    );
  }

  return Math.floor(time / bucketSeconds) * bucketSeconds;
}

function stackMarkers(
  markers: ChartTradeMarker[],
  resolution: string,
): ChartTradeMarker[] {
  const groups = new Map<number, ChartTradeMarker[]>();

  for (const marker of markers) {
    const bucketTime = tradeTimeToBarTime(marker.time, resolution);
    groups.set(bucketTime, [...(groups.get(bucketTime) ?? []), marker]);
  }

  return markers.map((marker) => {
    const bucketTime = tradeTimeToBarTime(marker.time, resolution);
    const group = groups.get(bucketTime) ?? [marker];
    const stackIndex = Math.max(group.findIndex((item) => item.id === marker.id), 0);

    return {
      ...marker,
      displayTime: bucketTime,
      displayPrice: marker.price,
      stackIndex,
      stackSize: group.length,
    };
  });
}

export function buildChartTradeMarkers(
  trades: ChartTradeMarkerInput[],
  symbol: string,
  t: (value: string) => string,
  maxMarkers = DEFAULT_MAX_MARKERS,
  resolution = "60",
): ChartTradeMarker[] {
  const markers = trades
    .filter((trade): trade is TradeItem => trade?.symbol === symbol)
    .map((trade) => {
      const id = Number(trade.id);
      const side = normalizeTradeSide(trade.side);
      const price = domainPriceToDisplayNumber(trade.price);
      const time = Math.floor(trade.timestamp / 1000);
      if (
        !Number.isFinite(id) ||
        !side ||
        price <= 0 ||
        !Number.isFinite(time) ||
        time <= 0
      ) {
        return null;
      }

      const label = side === "BUY" ? "B" : "S";
      const quantity = formatQuantity(trade.quantity);
      const actionLabel = tradeActionLabel(side, trade.isClose);

      return {
        id,
        side,
        label,
        time,
        price,
        displayTime: time,
        displayPrice: price,
        quantity,
        stackIndex: 0,
        stackSize: 1,
        tooltip: `${t(actionLabel)} ${t("at")} ${formatDisplayPrice(price)}`,
      };
    })
    .filter((marker): marker is ChartTradeMarker => marker !== null)
    .slice(0, maxMarkers)
    .sort((a, b) => a.time - b.time || a.id - b.id);

  return stackMarkers(markers, resolution);
}

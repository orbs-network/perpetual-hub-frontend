import type { UserPortfolioResponse } from "@/types";
import type { PortfolioHistoryPoint } from "./portfolio";

export type PortfolioDateRange = "24H" | "7D" | "14D" | "30D" | "All";

const RANGE_DURATION_MS: Partial<Record<PortfolioDateRange, number>> = {
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "14D": 14 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
};

export function filterPortfolioHistoryPointsByRange(
  points: PortfolioHistoryPoint[],
  range: PortfolioDateRange,
  end: number,
) {
  const start = getPortfolioRangeStart(range, end);
  if (start === undefined) return points;
  return points.filter((point) => point.timestamp >= start);
}

export function getPortfolioRangeStart(
  range: PortfolioDateRange,
  end: number,
) {
  const duration = RANGE_DURATION_MS[range];
  return duration ? end - duration : undefined;
}

export function getPortfolioRangePnl(
  points: PortfolioHistoryPoint[],
  range: PortfolioDateRange,
  totalPnl: bigint,
) {
  if (range === "All") return totalPnl;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (!firstPoint || !lastPoint) return 0n;
  return lastPoint.pnl - (firstPoint.pnl - firstPoint.pnlDelta);
}

export function getPortfolioRangeVolume(
  portfolio: UserPortfolioResponse | undefined,
  range: PortfolioDateRange,
) {
  if (!portfolio) return undefined;
  if (range === "24H") return portfolio.volume24h;
  if (range === "7D") return undefined;
  if (range === "14D") return portfolio.volume14d;
  if (range === "All") return portfolio.volumeAllTime;
  return portfolio.volume30d;
}

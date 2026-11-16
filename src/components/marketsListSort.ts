import type { PriceData } from "@/types";
import { safeUpperCase } from "@/lib/utils";

export type AssetSortKey = "preferred" | "asset" | "price" | "change" | "volume";
export type SortDirection = "asc" | "desc";
export type AssetSortState = {
  key: AssetSortKey;
  direction: SortDirection;
};

export const DEFAULT_ASSET_SORT: AssetSortState = {
  key: "volume",
  direction: "desc",
};

export const PREFERRED_ASSET_SORT: AssetSortState = {
  key: "preferred",
  direction: "asc",
};

export const DEFAULT_ASSET_SORT_DIRECTIONS: Record<AssetSortKey, SortDirection> = {
  preferred: "asc",
  asset: "asc",
  price: "desc",
  change: "desc",
  volume: "desc",
};

function getSortNumber(
  prices: Record<string, PriceData>,
  symbol: string,
  key: Exclude<AssetSortKey, "asset">,
) {
  const priceData = prices[symbol];
  if (key === "price") return priceData?.price;
  if (key === "change") return priceData?.priceChangePercent;
  return priceData?.volume24h;
}

function compareNumbersWithMissingLast(
  a: number | undefined,
  b: number | undefined,
  direction: SortDirection,
) {
  const aValid = Number.isFinite(a);
  const bValid = Number.isFinite(b);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return direction === "asc" ? a! - b! : b! - a!;
}

function buildPriorityRank(prioritySymbols: readonly string[]) {
  return new Map(
    prioritySymbols.map((symbol, index) => [safeUpperCase(symbol), index]),
  );
}

export function getDefaultAssetSort(prioritySymbols: readonly string[] = []) {
  return prioritySymbols.length > 0 ? PREFERRED_ASSET_SORT : DEFAULT_ASSET_SORT;
}

function comparePreferredSymbols(
  a: string,
  b: string,
  prices: Record<string, PriceData>,
  priorityRank: Map<string, number>,
) {
  const aRank = priorityRank.get(safeUpperCase(a));
  const bRank = priorityRank.get(safeUpperCase(b));
  const aPreferred = aRank !== undefined;
  const bPreferred = bRank !== undefined;

  if (aPreferred && bPreferred && aRank !== bRank) {
    return aRank - bRank;
  }
  if (aPreferred !== bPreferred) {
    return aPreferred ? -1 : 1;
  }

  const volumeOrder = compareNumbersWithMissingLast(
    getSortNumber(prices, a, "volume"),
    getSortNumber(prices, b, "volume"),
    "desc",
  );
  return volumeOrder || a.localeCompare(b);
}

export function sortAssetSymbols(
  symbols: string[],
  prices: Record<string, PriceData>,
  sort: AssetSortState,
  prioritySymbols: readonly string[] = [],
) {
  if (sort.key === "preferred") {
    const priorityRank = buildPriorityRank(prioritySymbols);
    return [...symbols].sort((a, b) =>
      comparePreferredSymbols(a, b, prices, priorityRank),
    );
  }

  return [...symbols].sort((a, b) => {
    const primary =
      sort.key === "asset"
        ? a.localeCompare(b)
        : compareNumbersWithMissingLast(
            getSortNumber(prices, a, sort.key),
            getSortNumber(prices, b, sort.key),
            sort.direction,
          );

    if (primary !== 0) {
      return sort.direction === "asc" || sort.key !== "asset"
        ? primary
        : -primary;
    }
    return a.localeCompare(b);
  });
}

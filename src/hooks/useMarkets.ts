import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMarkets, type MarketInfo } from "../api/markets";
import { useTeeConfig } from "./useTeeConfig";
import { useCurrentPartnerChain } from "./useCurrentPartnerChain";
import { getDisplaySymbol, getMarketFromMarketsList } from "@/lib/utils";
import type { SymbolConfig, SystemConfig } from "@/api/tee";

const MARKETS_KEY = ["markets"] as const;

export function getMarketsQueryKey(chainId: number) {
  return [...MARKETS_KEY, chainId] as const;
}

function precisionFromIncrement(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const [, decimals = ""] = value.trim().split(".");
  return decimals.replace(/0+$/, "").length;
}

function withTeePrecision(market: MarketInfo, config: SymbolConfig): MarketInfo {
  return {
    ...market,
    pricePrecision: precisionFromIncrement(config.tickSize, market.pricePrecision),
    quantityPrecision: precisionFromIncrement(config.stepSize, market.quantityPrecision),
  };
}

export function filterMarketsByTeeConfig(
  markets: MarketInfo[] | undefined,
  symbolConfigs: SystemConfig["symbolConfigs"] | undefined,
): MarketInfo[] | undefined {
  if (!markets || !symbolConfigs) return undefined;

  const configsByDisplaySymbol = new Map<string, SymbolConfig>();
  for (const [key, config] of Object.entries(symbolConfigs)) {
    configsByDisplaySymbol.set(getDisplaySymbol(key), config);
    configsByDisplaySymbol.set(getDisplaySymbol(config.symbol), config);
  }

  return markets.flatMap((market) => {
    const config = configsByDisplaySymbol.get(getDisplaySymbol(market.symbol));
    if (!config?.enabled) return [];
    return [withTeePrecision(market, config)];
  });
}

export function useMarkets() {
  const queryClient = useQueryClient();
  const teeConfigQuery = useTeeConfig();
  const { chainId } = useCurrentPartnerChain();

  const query = useQuery({
    queryKey: getMarketsQueryKey(chainId),
    queryFn: ({ signal }) => fetchMarkets(signal),
    staleTime: 5 * 60 * 1000,
    retry: 10,
    retryOnMount: false,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const data = useMemo(
    () => filterMarketsByTeeConfig(
      query.data,
      teeConfigQuery.data?.symbolConfigs,
    ),
    [query.data, teeConfigQuery.data?.symbolConfigs],
  );

  const hasServiceError = query.failureCount > 0 || query.isError
    || teeConfigQuery.failureCount > 0 || teeConfigQuery.isError
    || (data === undefined && (query.errorUpdatedAt > 0 || teeConfigQuery.errorUpdatedAt > 0));
  const refetchMarkets = query.refetch;
  const refetchConfig = teeConfigQuery.refetch;
  const refetch = useCallback(
    async () => {
      // An explicit Retry interrupts automatic backoff, including the initial load.
      // Preserve failure state while retrying so failed panels do not flash skeletons.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: getMarketsQueryKey(chainId), exact: true }, { revert: false }),
        queryClient.cancelQueries({ queryKey: ['teeConfig'], exact: true }, { revert: false }),
      ]);
      return Promise.allSettled([refetchMarkets(), refetchConfig()]);
    },
    [queryClient, chainId, refetchMarkets, refetchConfig],
  );

  return {
    ...query,
    data,
    hasServiceError,
    isUnavailable: data === undefined && hasServiceError,
    refetch,
    isFetching: query.isFetching || teeConfigQuery.isFetching,
    isLoading: query.isLoading || teeConfigQuery.isLoading,
    isPending: query.isPending || teeConfigQuery.isPending,
  };
}

export function useMarket(symbol = ""): MarketInfo | undefined {
  const { data: markets } = useMarkets();

  return useMemo(() => {
    if (!symbol) return undefined;
    const target = getDisplaySymbol(symbol);
    return getMarketFromMarketsList(markets, target);
  }, [markets, symbol]);
}

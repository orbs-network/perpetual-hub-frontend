import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { routeSlugToSymbol } from "@/lib/utils";
import { appRoutes } from "@/routes";
import { useMarket } from "./useMarkets";
import { useQuery } from "@tanstack/react-query";
import { fetchAllowedLeverageInfo } from "@/api/markets";
import { useNavigateWithQuery } from "./useNavigation";

export function useSelectTradeSymbol() {
  const navigateWithQuery = useNavigateWithQuery();

  return useCallback(
    (symbol: string) => {
      navigateWithQuery(appRoutes.trade(symbol));
    },
    [navigateWithQuery],
  );
}

export const useTradeSymbol = () => {
  const { symbolSlug } = useParams();
  const routeSymbol = routeSlugToSymbol(symbolSlug);
  const market = useMarket(routeSymbol);

  const symbol = market?.symbol ?? routeSymbol;
  return useMemo(() => {
    return {
      symbol,
      market,
    };
  }, [symbol, market]);
};


export function useSelectedSymbolMaxLeverage() {
  const { symbol } = useTradeSymbol();

  return useQuery({
    queryKey: ["leverage-info", symbol],
    queryFn: ({ signal }) => fetchAllowedLeverageInfo(symbol, signal),
    enabled: !!symbol,
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: 1,
    select: (data) => data.symbolMaxLeverage,
  });
}

export function useSelectedSymbolLeverageInfo() {
  const { symbol } = useTradeSymbol();

  return useQuery({
    queryKey: ["leverage-info", symbol],
    queryFn: ({ signal }) => fetchAllowedLeverageInfo(symbol, signal),
    enabled: !!symbol,
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: 1,
  });
}

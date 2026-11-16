import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMarkets } from "@/hooks/useMarkets";
import { useOrderFormStore } from "@/stores/orderFormStore";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { compareSymbols } from "@/lib/utils";
import { usePath } from "@/hooks/useNavigation";
import { appRoutes } from "@/routes";

export function TradeRouteSymbolSync() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const previousSymbolRef = useRef<string | null>(null);
  const { data: markets } = useMarkets();
  const { symbol: routeSymbol } = useTradeSymbol();
  const canonicalPath = appRoutes.trade(routeSymbol);
  const path = usePath(canonicalPath);

  const redirectPath = usePath(appRoutes.trade());
  const isKnownMarket = useMemo(() => {
    if (!markets?.length) return true;
    return markets.some((market) => compareSymbols(market.symbol, routeSymbol));
  }, [markets, routeSymbol]);

  useEffect(() => {
    if (pathname !== canonicalPath) {
      navigate(path, { replace: true });
    }
  }, [canonicalPath, navigate, path, pathname]);

  useEffect(() => {
    if (markets?.length && !isKnownMarket) {
      navigate(redirectPath, {
        replace: true,
      });
    }
  }, [isKnownMarket, markets, navigate, redirectPath]);

  useEffect(() => {
    if (!isKnownMarket) return;

    const previousSymbol = previousSymbolRef.current;
    if (previousSymbol && previousSymbol !== routeSymbol) {
      useOrderFormStore.getState().resetSize();
    }
    previousSymbolRef.current = routeSymbol;
  }, [isKnownMarket, routeSymbol]);

  return null;
}

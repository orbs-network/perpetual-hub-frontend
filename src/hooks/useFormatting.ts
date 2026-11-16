import { formatNumber } from "@/utils/formatting";
import { useMarkets } from "./useMarkets";
import { useCallback, useMemo } from "react";
import { getDisplaySymbol, getMarketFromMarketsList } from "@/lib/utils";

export function resolveFormatSymbolPrecision(
  scaled: "quantity" | "price" | "domainPrice" | undefined,
  quantityPrecision?: number,
  pricePrecision?: number,
) {
  if (scaled === "quantity") return quantityPrecision;
  if (scaled === "price") return pricePrecision;
  return pricePrecision;
}

export function useIsSymbolMarketLoading(symbol?: string) {
  const { data: markets, isLoading, isPending, isFetching } = useMarkets();

  return useMemo(() => {
    if (!symbol) return false;

    const target = getDisplaySymbol(symbol);
    const market = getMarketFromMarketsList(markets, target);
    if (market) return false;

    return isLoading || isPending || (isFetching && !markets);
  }, [isFetching, isLoading, isPending, markets, symbol]);
}

export function useFormatSymbolAmount() {
  const { data: markets } = useMarkets();

  const pricePrecision = useCallback(
    (symbol?: string) => {
      const result = markets?.find(
        (market) =>
          getDisplaySymbol(market.symbol) === getDisplaySymbol(symbol ?? ""),
      );
      return result?.pricePrecision ?? undefined;
    },
    [markets],
  );

  const quantityPrecision = useCallback(
    (symbol?: string) => {
      const result = markets?.find(
        (market) =>
          getDisplaySymbol(market.symbol) === getDisplaySymbol(symbol ?? ""),
      );
      return result?.quantityPrecision ?? undefined;
    },
    [markets],
  );

  return useCallback(
    (
      amount?: number | string | bigint,
      symbol?: string,
      scaled?: "quantity" | "price" | "domainPrice",
    ) => {
      const precision = resolveFormatSymbolPrecision(
        scaled,
        quantityPrecision(symbol),
        pricePrecision(symbol),
      );
      return formatNumber(amount, { decimalScale: precision, scaled });
    },
    [pricePrecision, quantityPrecision],
  );
}

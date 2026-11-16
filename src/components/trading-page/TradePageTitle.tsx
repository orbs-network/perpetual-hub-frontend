import { useEffect, useMemo } from "react";

import { getPartnerDocumentTitle } from "@/config/partners";
import { usePrice } from "@/hooks/useBinancePrices";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { getTradePageDocumentTitle } from "./tradeDocumentTitle";

export function TradePageTitle() {
  const { symbol, market } = useTradeSymbol();
  const priceData = usePrice(symbol);
  const price = priceData?.markPrice ?? priceData?.price ?? null;
  const pricePrecision = market?.pricePrecision ?? 2;

  const title = useMemo(
    () =>
      getTradePageDocumentTitle({
        price,
        pricePrecision,
        symbol,
      }),
    [price, pricePrecision, symbol],
  );

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    return () => {
      document.title = getPartnerDocumentTitle();
    };
  }, []);

  return null;
}

export default TradePageTitle;

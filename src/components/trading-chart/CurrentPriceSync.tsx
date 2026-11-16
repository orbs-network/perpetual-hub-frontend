import { useEffect, type RefObject } from "react";
import { usePrice } from "@/hooks/useBinancePrices";

export function CurrentPriceSync({
  symbol,
  currentMarketPriceRef,
  syncOverlaysRef,
}: {
  symbol: string;
  currentMarketPriceRef: RefObject<number>;
  syncOverlaysRef: RefObject<(() => Promise<void>) | null>;
}) {
  const currentPriceData = usePrice(symbol);
  const currentMarketPrice =
    currentPriceData?.markPrice ?? currentPriceData?.price ?? 0;

  useEffect(() => {
    currentMarketPriceRef.current = currentMarketPrice;
    void syncOverlaysRef.current?.();
  }, [currentMarketPrice, currentMarketPriceRef, symbol, syncOverlaysRef]);

  return null;
}

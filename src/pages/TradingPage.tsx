import { useWebSocket } from "../hooks/useWebSocket";
import { useBinanceSocket } from "../hooks/useBinancePrices";
import { useIsMobile } from "../hooks/useIsMobile";
import { useOrderBookSocket } from "@/hooks/useOrderBook";
import { MobileTradingPage } from "@/components/trading-page/MobileTradingPage";
import DesktopTradingPage from "@/components/trading-page/DesktopTradingPage";
import { TradeRouteSymbolSync } from "@/components/trading-page/TradeRouteSymbolSync";
import TradePageTitle from "@/components/trading-page/TradePageTitle";
import { useMarkets } from "@/hooks/useMarkets";

const Listeners = () => {
  // Initialize data fetching and WebSocket connections
  useMarkets();
  useWebSocket();
  useBinanceSocket();
  useOrderBookSocket();

  return null;
};

export function TradingPage() {
  const isMobile = useIsMobile();

  return (
    <>
      <TradePageTitle />
      <TradeRouteSymbolSync />
      {isMobile ? <MobileTradingPage /> : <DesktopTradingPage />}
      <Listeners />
    </>
  );
}

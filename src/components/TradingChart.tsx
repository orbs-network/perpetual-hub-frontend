import { useRef, useMemo, useEffect } from "react";
import type { TradingChartController } from "@/lib/chart/model";
import type { MarketInfo } from "@/api/markets";
import type { TradeItem } from "@/types";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useMarkets } from "@/hooks/useMarkets";
import { useUserAccount } from "@/hooks/useUserAccount";
import { useOrderFormStore } from "@/stores/orderFormStore";
import { ACTIVE_ORDER_STATUSES, DEFAULT_PRICE_SOURCE } from "@/config/constants";
import { useCurrentPosition } from "@/hooks/usePosition";
import { useTradeHistory } from "@/hooks/useTradeHistory";
import { useIsMobile } from "@/hooks/useIsMobile";
import { compareSymbols } from "@/lib/utils";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { ChartOverlayLayer } from "@/components/trading-chart/ChartOverlayLayer";
import { TradingServiceError } from "./TradingServiceError";
import { ChartSkeleton } from "@/components/trading-chart/ChartSkeleton";
import { CurrentPriceSync } from "@/components/trading-chart/CurrentPriceSync";
import { useChartOrderInteractions } from "@/components/trading-chart/hooks/useChartOrderInteractions";
import {
  useChartOverlays,
  useSyncChartOverlays,
} from "@/components/trading-chart/hooks/useChartOverlays";
import { useLightweightChart } from "@/components/trading-chart/hooks/useLightweightChart";
import { ChartToolbar } from "@/components/trading-chart/ChartToolbar";
import { useAppliedThemeColors } from "@/hooks/useAppliedThemeColors";
import { useCurrentPartnerChainKey } from "@/hooks/useCurrentPartnerChain";
import { DEFAULT_CHART_APPEARANCE, useChartPreferencesStore } from "@/stores/chartPreferencesStore";

const EMPTY_MARKETS: MarketInfo[] = [];
const EMPTY_TRADES: TradeItem[] = [];

export function TradingChart() {
  const { i18n, t } = useTranslation();
  const theme = useAppliedThemeColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TradingChartController | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const preferenceScope = useCurrentPartnerChainKey();
  const preferences = useChartPreferencesStore((state) => state.settings[preferenceScope] ?? DEFAULT_CHART_APPEARANCE);
  const period = preferences.period;

  const { symbol, market: selectedMarket } = useTradeSymbol();
  const priceSource = DEFAULT_PRICE_SOURCE;
  const { data: markets = EMPTY_MARKETS, isUnavailable } = useMarkets();
  const { data: userAccount } = useUserAccount();
  const isMobile = useIsMobile();
  const { data: trades } = useTradeHistory();
  const showBuysSellsOnChart = useUserPreferencesStore(
    (state) => state.showBuysSellsOnChart,
  );
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);

  const position = useCurrentPosition();

  // Stabilize PnL display values — only changes when the formatted text changes,
  // not on every price tick. This prevents the PnL chip from flickering.
  const pnlDisplayText = position.pnl?.formatted;
  const pnlIsPositive = position.pnl?.isPositive;

  // Match `usePosition.ts` — `ACTIVE_ORDER_STATUSES` covers NEW,
  // PENDING_ACTIVATION, and PARTIALLY_FILLED. The old hand-rolled filter
  // missed PENDING_ACTIVATION, which is the status TP/SL orders sit at
  // until their trigger fires — so the chips were never drawn for them.
  const pendingOrders = useMemo(
    () =>
      userAccount?.orders.filter(
        (order) =>
          compareSymbols(order.symbol, symbol) &&
          ACTIVE_ORDER_STATUSES.has(order.status),
      ) ?? [],
    [symbol, userAccount?.orders],
  );

  // Order form live preview prices
  const formSide = useOrderFormStore((s) => s.side);
  const formUiOrderType = useOrderFormStore((s) => s.uiOrderType);
  const formPrice = useOrderFormStore((s) => s.price);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const { chart, isChartLoading, error, retry, overlayRenderNonce } =
    useLightweightChart({
      containerRef,
      chartRef,
      symbol,
      preferenceScope,
      markets,
      priceSource,
      period,
      locale,
      theme,
      trades: trades ?? EMPTY_TRADES,
      showBuysSellsOnChart,
    });

  const isChartReady = Boolean(
    chart && !isChartLoading && chart.getData().length > 0,
  );

  const currentMarketPriceRef = useRef(0);

  const {
    beginChartOrderDrag,
    cancelChartOrder,
    cancelledOrderIds: chartCancelledOrderIds,
    cancelledOrderIdsRef: chartCancelledOrderIdsRef,
    cancellingOrderIds: chartCancellingOrderIds,
    dragPreview: chartDragPreview,
    dragPreviewRef: chartDragPreviewRef,
    optimisticOrderReplacements,
    optimisticOrderReplacementsRef,
    replaceChartOrderPrice,
    updatingOrderIds: chartUpdatingOrderIds,
    updatingOrderIdsRef: chartUpdatingOrderIdsRef,
  } = useChartOrderInteractions({
    enabled: isChartReady,
    period,
    symbol,
    priceSource,
    containerRef,
    currentMarketPriceRef,
    pendingOrders,
    position: position.raw,
    pricePrecision: selectedMarket?.pricePrecision ?? 2,
    t,
    userOrders: userAccount?.orders,
    chartRef,
  });

  const {
    chartOverlayLabels,
    setChartOverlayLabels,
    setupSyncOverlays,
    syncOverlaysRef,
  } = useChartOverlays({
    symbol,
    cancelledOrderIdsRef: chartCancelledOrderIdsRef,
    currentMarketPriceRef,
    dragPreviewRef: chartDragPreviewRef,
    formPrice,
    formSide,
    formUiOrderType,
    hidePnl,
    optimisticOrderReplacementsRef,
    pendingOrders,
    pnlDisplayText,
    pnlIsPositive,
    position: position.raw,
    pricePrecision: selectedMarket?.pricePrecision ?? 2,
    quantityPrecision: selectedMarket?.quantityPrecision ?? 8,
    t,
    updatingOrderIdsRef: chartUpdatingOrderIdsRef,
  });

  useEffect(() => {
    if (!chart) return;
    syncOverlaysRef.current = setupSyncOverlays(chart);
    void syncOverlaysRef.current();
    return () => {
      syncOverlaysRef.current = null;
      setChartOverlayLabels([]);
    };
  }, [chart, setupSyncOverlays, setChartOverlayLabels, syncOverlaysRef]);

  useSyncChartOverlays({
    cancellingOrderIds: chartCancellingOrderIds,
    cancelledOrderIds: chartCancelledOrderIds,
    dragPreview: chartDragPreview,
    formPrice,
    formSide,
    formUiOrderType,
    hidePnl,
    optimisticOrderReplacements,
    overlayRenderNonce,
    pendingOrders,
    pnlDisplayText,
    pnlIsPositive,
    position: position.raw,
    pricePrecision: selectedMarket?.pricePrecision ?? 2,
    quantityPrecision: selectedMarket?.quantityPrecision ?? 8,
    symbol,
    syncOverlaysRef,
    updatingOrderIds: chartUpdatingOrderIds,
  });

  const overlayLayer = (
    <ChartOverlayLayer
      beginOrderDrag={beginChartOrderDrag}
      cancellingOrderIds={chartCancellingOrderIds}
      cancelOrder={cancelChartOrder}
      changeOrderPrice={replaceChartOrderPrice}
      labels={chartOverlayLabels}
      t={t}
      updatingOrderIds={chartUpdatingOrderIds}
    />
  );

  return (
    <div
      ref={fullscreenRef}
      className="relative flex h-full min-h-0 w-full min-w-0 flex-col bg-surface"
      data-testid="trading-chart"
    >
      <CurrentPriceSync
        symbol={symbol}
        currentMarketPriceRef={currentMarketPriceRef}
        syncOverlaysRef={syncOverlaysRef}
      />
      <ChartToolbar
        chart={isChartReady ? chart : null}
        symbol={symbol}
        period={period}
        onPeriodChange={(period) => useChartPreferencesStore.getState().updateAppearance(preferenceScope, { period })}
        chartType={preferences.chartType}
        onChartTypeChange={(type) => chart?.setChartType(type)}
        containerRef={fullscreenRef}
        isMobile={isMobile}
      />
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        data-testid="trading-chart-surface"
        role="region"
        aria-label={`${symbol} ${t("Chart")}`}
        aria-busy={isChartLoading && !isUnavailable}
        style={{ backgroundColor: theme.surface }}
      >
        <div
          ref={containerRef}
          inert={!isChartReady}
          className="absolute inset-0 min-h-0 min-w-0"
        />
        {isChartReady ? overlayLayer : null}
        {isUnavailable ? <div className="absolute inset-0 z-20"><TradingServiceError /></div> : isChartLoading ? <ChartSkeleton /> : null}
        {error && !isUnavailable ? (
          <div
            role="status"
            className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 border-t border-edge bg-surface/95 px-3 py-2 text-center text-xs text-content-muted"
          >
            <p>{t("Unable to load chart data")}</p>
            <button
              type="button"
              onClick={retry}
              className="rounded border border-edge px-3 py-1.5 text-content hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
            >
              {t("Retry")}
            </button>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 border-t border-edge px-2 py-0.5 text-[9px] text-content-muted">
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer"
          className="rounded hover:text-content-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          TradingView Lightweight Charts™ · Copyright © 2025 TradingView, Inc.
        </a>
      </div>
    </div>
  );
}

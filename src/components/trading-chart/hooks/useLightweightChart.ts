import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import type { MarketInfo } from '@/api/markets';
import type { PriceSource } from '@/config/constants';
import type { ThemeColors } from '@/config/partners';
import { MarketChartDatafeed } from '@/lib/chart/datafeed';
import { LightweightChartController } from '@/lib/chart/engine';
import type { ChartPeriod, TradingChartController } from '@/lib/chart/model';
import { chartDrawingStorageKey, DEFAULT_CHART_APPEARANCE, useChartPreferencesStore } from '@/stores/chartPreferencesStore';
import { buildChartTradeMarkers } from '@/lib/chartTradeMarkers';
import type { TradeItem } from '@/types';
import i18n from '@/i18n';
import { periodToResolution } from '../tradeMarkers';

interface Options {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: MutableRefObject<TradingChartController | null>;
  symbol: string;
  preferenceScope: string;
  markets: MarketInfo[];
  priceSource: PriceSource;
  period: ChartPeriod;
  locale: string;
  theme: ThemeColors;
  trades: TradeItem[];
  showBuysSellsOnChart: boolean;
}

export function useLightweightChart({ containerRef, chartRef, symbol, preferenceScope, markets, priceSource, period, locale, theme, trades, showBuysSellsOnChart }: Options) {
  const [chart, setChart] = useState<LightweightChartController | null>(null);
  const [overlayRenderNonce, setOverlayRenderNonce] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [initializedSession, setInitializedSession] = useState<object | null>(null);
  const [failure, setFailure] = useState<{ session: object; message: string } | null>(null);
  const sessionKey = `${preferenceScope}:${priceSource}:${symbol}:${period.type}:${period.span}:${retryNonce}`;
  const sessionCleanup = useRef<(() => void) | null>(null);
  const inputs = useRef({ theme, locale, markets });
  useEffect(() => { inputs.current = { theme, locale, markets }; }, [theme, locale, markets]);
  const marketsReady = markets.length > 0;
  const market = markets.find(item => item.symbol === symbol);
  const precision = market?.pricePrecision ?? 2;
  const marketFound = Boolean(market);
  const requestedSession = useMemo(() => ({ key: sessionKey, chart, precision, marketFound }), [sessionKey, chart, precision, marketFound]);
  const retry = useCallback(() => setRetryNonce(value => value + 1), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !marketsReady) return;
    let frame: number | null = null;
    let disposed = false;
    const refresh = () => {
      if (disposed || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!disposed) setOverlayRenderNonce(value => value + 1);
      });
    };
    const controller = new LightweightChartController(container, inputs.current.theme, inputs.current.locale, refresh);
    const preferences = useChartPreferencesStore.getState().settings[preferenceScope] ?? DEFAULT_CHART_APPEARANCE;
    controller.setChartType(preferences.chartType);
    if (preferences.indicators !== null) {
      controller.getIndicators().forEach(({ id }) => controller.removeIndicator(id));
      for (const indicator of preferences.indicators) {
        controller.addIndicator(indicator.name);
        const added = controller.getIndicators().find(({ name }) => name === indicator.name);
        if (added) controller.updateIndicator(added.id, indicator.calcParams);
      }
    }
    const unsubscribePreferences = controller.subscribePreferences((change) => {
      if (change !== 'appearance') return;
      useChartPreferencesStore.getState().updateAppearance(preferenceScope, {
        chartType: controller.getChartType(),
        indicators: controller.getIndicators().map(({ name, calcParams }) => ({ name, calcParams })),
      });
    });
    chartRef.current = controller;
    const resize = new ResizeObserver(() => { controller.resize(); setChart(controller); refresh(); });
    resize.observe(container);
    // Price-axis scaling/pane dragging does not necessarily change the visible
    // time range. Refresh app overlays after the renderer handles these events.
    const onViewport = () => {
      refresh();
      requestAnimationFrame(() => { if (!disposed) controller.refreshGeometry(); });
    };
    for (const event of ['pointermove', 'pointerup', 'pointercancel', 'wheel', 'dblclick'] as const) {
      container.addEventListener(event, onViewport, { passive: true });
    }
    return () => {
      disposed = true;
      sessionCleanup.current?.();
      sessionCleanup.current = null;
      unsubscribePreferences();
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect();
      for (const event of ['pointermove', 'pointerup', 'pointercancel', 'wheel', 'dblclick'] as const) container.removeEventListener(event, onViewport);
      chartRef.current = null;
      controller.destroy();
    };
  }, [containerRef, chartRef, marketsReady, preferenceScope]);

  useEffect(() => {
    if (!chart || chartRef.current !== chart || !marketFound) return;
    let active = true;
    let historyReady = false;
    let loadingOlder = false;
    let moreHistory = true;
    let paginationFrame: number | null = null;
    const feed = new MarketChartDatafeed(priceSource, inputs.current.markets, message => {
      if (active) setFailure(message ? { session: requestedSession, message } : null);
    });
    const resolvedSymbol = feed.resolveSymbol(symbol);
    if (!resolvedSymbol) { feed.destroy(); return; }
    const loader = feed.createDataLoader();
    const requestedPeriod = { span: period.span, type: period.type };
    const drawingKey = chartDrawingStorageKey(preferenceScope, symbol, requestedPeriod);
    chart.cancelDrawing();
    chart.clearDrawings();
    chart.restoreDrawings(useChartPreferencesStore.getState().drawings[drawingKey] ?? []);
    chart.setContext(symbol, requestedPeriod, precision);
    chart.setTradeMarkers([]);
    chart.setData([]);
    const unsubscribeDrawings = chart.subscribePreferences((change) => {
      if (change === 'drawings') useChartPreferencesStore.getState().saveDrawings(drawingKey, chart.getDrawings());
    });
    const fail = (error: unknown) => {
      if (!active) return;
      setFailure({ session: requestedSession, message: error instanceof Error ? error.message : 'Unable to load chart data' });
    };
    const paginate = () => {
      if (!active || !historyReady || loadingOlder || !moreHistory) return;
      const range = chart.native.timeScale().getVisibleLogicalRange();
      const first = chart.getData()[0];
      if (!range || range.from > 30 || !first) return;
      loadingOlder = true;
      Promise.resolve(loader.getBars({
        type: 'forward', timestamp: first.timestamp, symbol: resolvedSymbol, period: requestedPeriod,
        callback: (older, more) => {
          if (!active) return;
          loadingOlder = false;
          moreHistory = more;
          const current = chart.getData();
          const firstTimestamp = current[0]?.timestamp ?? Infinity;
          const prepend = older.filter(bar => bar.timestamp < firstTimestamp);
          if (!prepend.length) return;
          const viewport = chart.native.timeScale().getVisibleLogicalRange();
          chart.setData([...prepend, ...current]);
          if (viewport) chart.native.timeScale().setVisibleLogicalRange({ from: viewport.from + prepend.length, to: viewport.to + prepend.length });
        },
      })).catch(error => { loadingOlder = false; fail(error); });
    };
    const queuePagination = () => {
      if (paginationFrame !== null) return;
      paginationFrame = requestAnimationFrame(() => { paginationFrame = null; paginate(); });
    };
    chart.native.timeScale().subscribeVisibleLogicalRangeChange(queuePagination);
    Promise.resolve(loader.getBars({
      type: 'init', timestamp: null, symbol: resolvedSymbol, period: requestedPeriod,
      callback: (bars, more) => {
        if (!active) return;
        if (!bars.length) { fail(new Error('Unable to load chart data')); return; }
        chart.setData(bars, true);
        historyReady = true;
        moreHistory = more;
        setInitializedSession(requestedSession);
        loader.subscribeBar({ symbol: resolvedSymbol, period: requestedPeriod, callback: bar => {
          if (!active || !historyReady) return;
          try { chart.updateBar(bar); } catch (error) { fail(error); }
        } });
      },
    })).catch(fail);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      active = false;
      unsubscribeDrawings();
      chart.cancelDrawing();
      chart.native.timeScale().unsubscribeVisibleLogicalRangeChange(queuePagination);
      if (paginationFrame !== null) cancelAnimationFrame(paginationFrame);
      feed.destroy();
    };
    sessionCleanup.current = cleanup;
    return cleanup;
  }, [chart, chartRef, symbol, preferenceScope, priceSource, period.span, period.type, requestedSession, precision, marketFound]);

  useEffect(() => { if (chart && chartRef.current === chart) chart.applyTheme(theme, locale); }, [chart, chartRef, theme, locale]);
  useEffect(() => {
    if (!chart || chartRef.current !== chart || initializedSession !== requestedSession) return;
    const markers = showBuysSellsOnChart ? buildChartTradeMarkers(trades, symbol, value => i18n.t(value), undefined, periodToResolution(period)) : [];
    chart.setTradeMarkers(markers);
  }, [chart, chartRef, initializedSession, requestedSession, showBuysSellsOnChart, trades, symbol, period, locale]);

  const error = failure?.session === requestedSession ? failure.message : null;
  return {
    chart,
    isChartLoading: !error && (!marketsReady || !marketFound || initializedSession !== requestedSession),
    error,
    retry,
    overlayRenderNonce,
  };
}

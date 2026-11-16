import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  dispose,
  init,
  type ActionType,
  type Chart,
  type DataLoader,
  type OverlayCreate,
  type Period,
} from "klinecharts";
import type { MarketInfo } from "@/api/markets";
import type { PriceSource } from "@/config/constants";
import type { ThemeColors } from "@/config/partners";
import i18n from "@/i18n";
import { MarketChartDatafeed } from "@/lib/chart/datafeed";
import { buildChartTradeMarkers } from "@/lib/chartTradeMarkers";
import type { TradeItem } from "@/types";
import { getChartStyles, registerChartLocale } from "../chartOptions";
import { periodToResolution, syncTradeMarkers } from "../tradeMarkers";
import { USER_DRAWING_GROUP } from "../toolbarOptions";

interface UseKLineChartOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: MutableRefObject<Chart | null>;
  symbol: string;
  markets: MarketInfo[];
  priceSource: PriceSource;
  period: Period;
  locale: string;
  theme: ThemeColors;
  trades: TradeItem[];
  showBuysSellsOnChart: boolean;
}

const VIEWPORT_ACTIONS: ActionType[] = [
  "onZoom",
  "onScroll",
  "onVisibleRangeChange",
  "onPaneDrag",
];
const VIEWPORT_DOM_EVENTS = [
  "pointermove",
  "pointerup",
  "pointercancel",
  "wheel",
  "dblclick",
] as const;

function dataSessionKey(
  priceSource: PriceSource,
  symbol: string,
  period: Period,
  retryNonce: number,
) {
  return `${priceSource}:${symbol}:${period.type}:${period.span}:${retryNonce}`;
}

function snapshotDrawings(chart: Chart): OverlayCreate[] {
  return chart
    .getOverlays({ groupId: USER_DRAWING_GROUP })
    .filter((overlay) => overlay.currentStep === -1)
    .map((overlay) => ({
      id: overlay.id,
      name: overlay.name,
      groupId: USER_DRAWING_GROUP,
      paneId: overlay.paneId,
      lock: overlay.lock,
      visible: overlay.visible,
      mode: overlay.mode,
      modeSensitivity: overlay.modeSensitivity,
      zLevel: overlay.zLevel,
      styles: overlay.styles,
      extendData: overlay.extendData,
      // Timestamp-based anchors survive timeframe changes; a stored dataIndex
      // refers to the previous period's bars and must not override them.
      points: overlay.points.map(({ timestamp, value, dataIndex }) =>
        timestamp === undefined ? { dataIndex, value } : { timestamp, value },
      ),
    }));
}

export function useKLineChart({
  containerRef,
  chartRef,
  symbol,
  markets,
  priceSource,
  period,
  locale,
  theme,
  trades,
  showBuysSellsOnChart,
}: UseKLineChartOptions) {
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [overlayRenderNonce, setOverlayRenderNonce] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestedSessionKey = dataSessionKey(
    priceSource,
    symbol,
    period,
    retryNonce,
  );
  const [initializedSessionKey, setInitializedSessionKey] = useState<
    string | null
  >(null);
  const [failure, setFailure] = useState<{
    sessionKey: string;
    message: string;
  } | null>(null);
  const error =
    failure?.sessionKey === requestedSessionKey ? failure.message : null;
  const [chartInstance, setChartInstance] = useState<Chart | null>(null);
  const feedRef = useRef<MarketChartDatafeed | null>(null);
  const drawingSnapshotsRef = useRef(new Map<string, OverlayCreate[]>());
  const themeRef = useRef(theme);
  const inputsRef = useRef({
    symbol,
    markets,
    period,
    locale,
    requestedSessionKey,
  });
  themeRef.current = theme;
  inputsRef.current = { symbol, markets, period, locale, requestedSessionKey };
  const retry = useCallback(() => setRetryNonce((nonce) => nonce + 1), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !inputsRef.current.markets.length) return;
    const drawingSnapshots = drawingSnapshotsRef.current;

    let disposed = false;
    let frame: number | null = null;
    let chart: Chart | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let candleResizeObserver: ResizeObserver | null = null;
    let initializationSequence = 0;
    let activeRequestSessionKey: string | null = null;
    const refreshOverlays = () => {
      if (disposed || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!disposed) setOverlayRenderNonce((nonce) => nonce + 1);
      });
    };
    const feed = new MarketChartDatafeed(
      priceSource,
      inputsRef.current.markets,
      (message) => {
        if (
          !disposed &&
          activeRequestSessionKey === inputsRef.current.requestedSessionKey
        ) {
          setFailure(
            message ? { sessionKey: activeRequestSessionKey, message } : null,
          );
        }
      },
    );
    feedRef.current = feed;
    setIsChartLoading(true);
    setFailure(null);

    try {
      chart = init(container, {
        locale: registerChartLocale(inputsRef.current.locale),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        styles: getChartStyles(
          themeRef.current,
          getComputedStyle(container).fontFamily,
        ),
      });
      if (!chart) throw new Error("Chart could not be initialized");
      chartRef.current = chart;
      setChartInstance(chart);
      chart.createIndicator("VOL");
      chart.setOffsetRightDistance(70);
      const loader = feed.createDataLoader();
      const wrappedLoader: DataLoader = {
        getBars: (params) => {
          const sessionKey = dataSessionKey(
            priceSource,
            params.symbol.ticker,
            params.period,
            retryNonce,
          );
          if (params.type === "init") {
            initializationSequence += 1;
            activeRequestSessionKey = sessionKey;
            if (sessionKey === inputsRef.current.requestedSessionKey)
              setIsChartLoading(true);
          }
          const requestSequence = initializationSequence;
          return loader.getBars({
            ...params,
            callback: (bars, more) => {
              if (
                disposed ||
                sessionKey !== inputsRef.current.requestedSessionKey ||
                requestSequence !== initializationSequence
              )
                return;
              params.callback(bars, more);
              if (params.type === "init") {
                setInitializedSessionKey(sessionKey);
                setIsChartLoading(false);
              }
              refreshOverlays();
            },
          });
        },
        subscribeBar: (params) => {
          const sessionKey = dataSessionKey(
            priceSource,
            params.symbol.ticker,
            params.period,
            retryNonce,
          );
          return loader.subscribeBar?.({
            ...params,
            callback: (bar) => {
              if (
                disposed ||
                sessionKey !== inputsRef.current.requestedSessionKey
              )
                return;
              params.callback(bar);
              refreshOverlays();
            },
          });
        },
        unsubscribeBar: (params) => loader.unsubscribeBar?.(params),
      };
      chart.setDataLoader(wrappedLoader);
      const initial = inputsRef.current;
      const market = initial.markets.find(
        (item) => item.symbol === initial.symbol,
      );
      chart.setSymbol({
        ticker: initial.symbol,
        pricePrecision: market?.pricePrecision ?? 2,
        volumePrecision: market?.quantityPrecision ?? 8,
      });
      chart.setPeriod(initial.period);
      const drawings = drawingSnapshots.get(initial.symbol);
      if (drawings?.length) chart.createOverlay(drawings);
      VIEWPORT_ACTIONS.forEach((action) =>
        chart?.subscribeAction(action, refreshOverlays),
      );
      // Native price-axis drags and double-click auto-scale do not emit a
      // viewport action. Refresh on the following frame, after KLineChart has
      // processed the input, so account lines remain aligned with the canvas.
      VIEWPORT_DOM_EVENTS.forEach((event) =>
        container.addEventListener(event, refreshOverlays, { passive: true }),
      );
      resizeObserver = new ResizeObserver(() => {
        chart?.resize();
        refreshOverlays();
      });
      resizeObserver.observe(container);
      const candlePane = chart.getDom("candle_pane", "main");
      if (candlePane) {
        // Adding/removing/resizing indicator panes changes the candle pane's
        // size without changing its outer container. Never resize recursively.
        candleResizeObserver = new ResizeObserver(refreshOverlays);
        candleResizeObserver.observe(candlePane);
      }
      refreshOverlays();
    } catch (cause) {
      setIsChartLoading(false);
      setFailure({
        sessionKey: inputsRef.current.requestedSessionKey,
        message:
          cause instanceof Error
            ? cause.message
            : "Chart could not be initialized",
      });
    }

    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      candleResizeObserver?.disconnect();
      VIEWPORT_DOM_EVENTS.forEach((event) =>
        container.removeEventListener(event, refreshOverlays),
      );
      feed.destroy();
      if (feedRef.current === feed) feedRef.current = null;
      if (chart) {
        const activeSymbol = chart.getSymbol()?.ticker;
        if (activeSymbol)
          drawingSnapshots.set(activeSymbol, snapshotDrawings(chart));
        VIEWPORT_ACTIONS.forEach((action) =>
          chart.unsubscribeAction(action, refreshOverlays),
        );
        if (chartRef.current === chart) chartRef.current = null;
        setChartInstance((current) => (current === chart ? null : current));
        dispose(container);
      }
    };
    // Live market metadata, symbol, period, language and palette are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, chartRef, priceSource, markets.length > 0, retryNonce]);

  useEffect(() => {
    feedRef.current?.updateMarkets(markets);
    const chart = chartRef.current;
    if (!chart) return;
    const market = markets.find((item) => item.symbol === symbol);
    const current = chart.getSymbol();
    const pricePrecision = market?.pricePrecision ?? 2;
    const volumePrecision = market?.quantityPrecision ?? 8;
    if (
      current?.ticker !== symbol ||
      current.pricePrecision !== pricePrecision ||
      current.volumePrecision !== volumePrecision
    ) {
      setFailure(null);
      setIsChartLoading(true);
      if (current?.ticker !== symbol) {
        if (current?.ticker)
          drawingSnapshotsRef.current.set(
            current.ticker,
            snapshotDrawings(chart),
          );
        chart.removeOverlay({ groupId: USER_DRAWING_GROUP });
        chart.setSymbol({ ticker: symbol, pricePrecision, volumePrecision });
        const drawings = drawingSnapshotsRef.current.get(symbol);
        if (drawings?.length) chart.createOverlay(drawings);
      } else {
        chart.setSymbol({ ticker: symbol, pricePrecision, volumePrecision });
      }
      setOverlayRenderNonce((nonce) => nonce + 1);
    }
  }, [chartRef, markets, symbol]);

  useEffect(() => {
    const chart = chartRef.current;
    const current = chart?.getPeriod();
    if (
      chart &&
      (current?.type !== period.type || current.span !== period.span)
    ) {
      setFailure(null);
      setIsChartLoading(true);
      chart.setPeriod(period);
      setOverlayRenderNonce((nonce) => nonce + 1);
    }
  }, [chartRef, period]);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;
    container.style.backgroundColor = theme.surface;
    chart.setStyles(
      getChartStyles(theme, getComputedStyle(container).fontFamily),
    );
    setOverlayRenderNonce((nonce) => nonce + 1);
  }, [chartInstance, chartRef, containerRef, theme]);

  useEffect(() => {
    chartRef.current?.setLocale(registerChartLocale(locale));
  }, [chartInstance, chartRef, locale]);

  const markers = useMemo(
    () =>
      showBuysSellsOnChart
        ? buildChartTradeMarkers(
            trades,
            symbol,
            (key) => String(i18n.getFixedT(locale)(key)),
            undefined,
            periodToResolution(period),
          )
        : [],
    [locale, period, showBuysSellsOnChart, symbol, trades],
  );
  const markerSignature = JSON.stringify({
    markers,
    up: theme.up,
    down: theme.down,
    text: theme["content-inverse"],
  });
  const lastMarkerSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // Include chart identity: a retry/source change creates a new instance even
    // if the account's trades and colours have not changed.
    const signature = `${chart.id}:${markerSignature}`;
    if (lastMarkerSignatureRef.current === signature) return;
    syncTradeMarkers(chart, markers, theme);
    lastMarkerSignatureRef.current = signature;
  }, [
    chartInstance,
    chartRef,
    markerSignature,
    markers,
    overlayRenderNonce,
    theme,
  ]);

  return {
    chart: chartInstance,
    // Selection changes must hide the previous canvas during render, before
    // effects request the next dataset. Only its matching init callback can
    // expose that dataset to drawing and account-order interactions.
    isChartLoading:
      isChartLoading ||
      (!error && initializedSessionKey !== requestedSessionKey),
    error,
    retry,
    overlayRenderNonce,
  };
}

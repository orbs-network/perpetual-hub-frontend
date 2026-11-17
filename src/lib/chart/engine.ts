import {
  AreaSeries, BarSeries, CandlestickSeries, createChart, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesType,
  type Time, type UTCTimestamp,
} from 'lightweight-charts';
import type { ThemeColors } from '@/config/partners';
import type { ChartTradeMarker } from '@/lib/chartTradeMarkers';
import { getChartOptions } from '@/components/trading-chart/chartOptions';
import { toSeriesMarkers } from '@/components/trading-chart/tradeMarkers';
import { createDrawingManager } from '@/components/trading-chart/drawingTools';
import { createIndicatorManager } from './indicators';
import { periodToBinanceInterval } from './datafeed';
import type { ChartCandle, ChartDrawing, ChartPeriod, ChartType, ChartPreferenceChange, DrawingTool, TradingChartController } from './model';

export class LightweightChartController implements TradingChartController {
  readonly native: IChartApi;
  private series: ISeriesApi<SeriesType>;
  private candles: ChartCandle[] = [];
  private theme: ThemeColors;
  private chartType: ChartType = 'candles';
  private precision = 2;
  private symbol = '';
  private period: ChartPeriod = { span: 1, type: 'hour' };
  private markers: ChartTradeMarker[] = [];
  private markerPlugin: ISeriesMarkersPluginApi<Time>;
  private legend: HTMLDivElement;
  private drawings;
  private indicators;
  private disposed = false;
  private container: HTMLDivElement;
  private onChange: () => void;
  private locale: string;
  private hoveredTimestamp: number | undefined;
  private preferenceListeners = new Set<(change: ChartPreferenceChange) => void>();

  constructor(container: HTMLDivElement, theme: ThemeColors, locale: string, onChange: () => void) {
    this.container = container;
    this.onChange = onChange;
    this.locale = locale;
    this.theme = theme;
    this.native = createChart(container, { ...getChartOptions(theme, locale), width: container.clientWidth, height: container.clientHeight });
    this.series = this.createPriceSeries();
    this.markerPlugin = createSeriesMarkers(this.series, [], { autoScale: false });
    this.drawings = createDrawingManager({
      container, chart: this.native, getSeries: () => this.series,
      getTheme: () => this.theme, getData: () => this.candles,
      getPlotArea: () => this.getPlotArea(),
      onChange: () => { onChange(); this.notifyPreferences('drawings'); },
    });
    this.indicators = createIndicatorManager({
      chart: this.native, getMainSeries: () => this.series, getBars: () => this.candles,
      getTheme: () => this.theme, onLayoutChange: onChange,
    });
    this.indicators.addIndicator('VOL');
    this.legend = document.createElement('div');
    this.legend.dataset.chartPriceLegend = 'true';
    Object.assign(this.legend.style, {
      position: 'absolute', left: '8px', top: '6px', zIndex: '2', pointerEvents: 'none',
      maxWidth: 'calc(100% - 78px)', font: '11px/18px Inter, Arial, sans-serif',
      color: theme['content-secondary'], whiteSpace: 'normal',
    });
    this.legend.setAttribute('aria-hidden', 'true');
    container.appendChild(this.legend);
    this.native.subscribeCrosshairMove(event => {
      this.hoveredTimestamp = typeof event.time === 'number' && event.point ? event.time * 1000 : undefined;
      this.updateLegend();
      const marker = this.markers.find(item => `trade-${item.id}` === String(event.hoveredObjectId));
      if (marker) container.title = marker.tooltip;
      else container.removeAttribute('title');
    });
    this.native.timeScale().subscribeVisibleLogicalRangeChange(() => this.refreshGeometry());
    this.resize();
  }

  private createPriceSeries(): ISeriesApi<SeriesType> {
    const { theme } = this;
    const common = { priceFormat: { type: 'price' as const, precision: this.precision, minMove: 10 ** -this.precision } };
    if (this.chartType === 'area') return this.native.addSeries(AreaSeries, {
      ...common, lineColor: theme['accent-primary'], topColor: `${theme['accent-primary']}38`, bottomColor: theme.surface,
    }, 0);
    if (this.chartType === 'bars') return this.native.addSeries(BarSeries, {
      ...common, upColor: theme.up, downColor: theme.down,
    }, 0);
    return this.native.addSeries(CandlestickSeries, {
      ...common, upColor: this.chartType === 'hollow-candles' ? theme.surface : theme.up,
      downColor: theme.down, borderUpColor: theme.up, borderDownColor: theme.down,
      wickUpColor: theme.up, wickDownColor: theme.down,
    }, 0);
  }

  private seriesData(candle: ChartCandle) {
    const time = (candle.timestamp / 1000) as UTCTimestamp;
    return this.chartType === 'area' ? { time, value: candle.close } : {
      time, open: candle.open, high: candle.high, low: candle.low, close: candle.close,
    };
  }

  private updateLegend() {
    const bar = this.hoveredTimestamp === undefined ? this.candles.at(-1)
      : this.candles.find(candle => candle.timestamp === this.hoveredTimestamp) ?? this.candles.at(-1);
    if (!bar) { this.legend.textContent = ''; return; }
    const formatted = (value: number) => this.series.priceFormatter().format(value);
    this.legend.textContent = `${this.symbol} · ${periodToBinanceInterval(this.period) ?? ''}   O ${formatted(bar.open)}   H ${formatted(bar.high)}   L ${formatted(bar.low)}   C ${formatted(bar.close)}   V ${new Intl.NumberFormat(this.locale, { maximumFractionDigits: 2 }).format(bar.volume)}`;
  }

  private refreshMarkers() {
    const first = this.candles[0]?.timestamp ?? Infinity;
    const last = this.candles.at(-1)?.timestamp ?? -Infinity;
    const visible = this.markers.filter(marker => marker.displayTime * 1000 >= first && marker.displayTime * 1000 <= last);
    this.markerPlugin.setMarkers(toSeriesMarkers(visible, this.theme));
  }

  setContext(symbol: string, period: ChartPeriod, precision: number) {
    this.hoveredTimestamp = undefined;
    this.symbol = symbol;
    this.period = period;
    this.precision = precision;
    this.series.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } });
    this.updateLegend();
  }

  setData(candles: ChartCandle[], resetViewport = false) {
    this.candles = candles;
    this.series.setData(candles.map(candle => this.seriesData(candle)));
    this.indicators.refresh();
    this.refreshMarkers();
    if (resetViewport && candles.length) {
      const visible = Math.max(25, Math.floor(this.getPlotArea().width / 7));
      this.native.timeScale().setVisibleLogicalRange({ from: candles.length - visible, to: candles.length + 8 });
    }
    this.updateLegend();
    this.refreshGeometry();
  }

  updateBar(bar: ChartCandle) {
    const last = this.candles.at(-1);
    if (last && bar.timestamp < last.timestamp) return;
    if (last?.timestamp === bar.timestamp) this.candles[this.candles.length - 1] = bar;
    else this.candles.push(bar);
    this.series.update(this.seriesData(bar));
    this.indicators.refresh();
    this.refreshMarkers();
    this.updateLegend();
    this.refreshGeometry();
  }

  setTradeMarkers(markers: ChartTradeMarker[]) { this.markers = markers; this.refreshMarkers(); }
  getData() { return this.candles; }
  getPlotArea() {
    const pane = this.native.paneSize(0);
    return { left: 0, top: 0, width: pane.width, height: pane.height, right: this.native.priceScale('right', 0).width() };
  }
  priceToCoordinate(price: number) { return this.series.priceToCoordinate(price); }
  coordinateToPrice(y: number) { return this.series.coordinateToPrice(y); }
  refreshGeometry() {
    if (this.disposed) return;
    this.drawings.refresh();
    this.onChange();
  }
  resize() {
    if (this.disposed) return;
    this.native.resize(Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight));
    this.refreshGeometry();
  }
  getChartType() { return this.chartType; }
  subscribePreferences(listener: (change: ChartPreferenceChange) => void) {
    this.preferenceListeners.add(listener);
    return () => { this.preferenceListeners.delete(listener); };
  }
  private notifyPreferences(change: ChartPreferenceChange) {
    this.preferenceListeners.forEach((listener) => listener(change));
  }
  setChartType(type: ChartType) {
    if (type === this.chartType) return;
    this.chartType = type;
    this.replacePriceSeries();
    this.notifyPreferences('appearance');
  }
  private replacePriceSeries() {
    const old = this.series;
    // Keep a series in the price pane while replacing it, so native pane removal
    // cannot move a volume/oscillator pane into the price pane's index.
    this.series = this.createPriceSeries();
    this.series.setData(this.candles.map(candle => this.seriesData(candle)));
    this.markerPlugin.detach();
    this.native.removeSeries(old);
    this.markerPlugin = createSeriesMarkers(this.series, [], { autoScale: false });
    this.refreshMarkers();
    this.indicators.refresh();
    this.refreshGeometry();
  }
  applyTheme(theme: ThemeColors, locale: string) {
    this.theme = theme;
    this.locale = locale;
    this.native.applyOptions(getChartOptions(theme, locale));
    this.legend.style.color = theme['content-secondary'];
    this.replacePriceSeries();
    this.indicators.applyTheme();
    this.refreshGeometry();
  }
  getIndicators() { return this.indicators.getIndicators(); }
  addIndicator(name: string) { this.indicators.addIndicator(name); this.refreshGeometry(); this.notifyPreferences('appearance'); }
  removeIndicator(id: string) { this.indicators.removeIndicator(id); this.refreshGeometry(); this.notifyPreferences('appearance'); }
  updateIndicator(id: string, params: number[]) { this.indicators.updateIndicator(id, params); this.refreshGeometry(); this.notifyPreferences('appearance'); }
  startDrawing(tool: DrawingTool, onFinish: () => void) { return this.drawings.startDrawing(tool, onFinish); }
  cancelDrawing(id?: string) { this.drawings.cancelDrawing(id); }
  getDrawings() { return this.drawings.getDrawings(); }
  restoreDrawings(drawings: ChartDrawing[]) { this.drawings.restoreDrawings(drawings); }
  setDrawingsLocked(locked: boolean) { this.drawings.setDrawingsLocked(locked); }
  clearDrawings() { this.drawings.clearDrawings(); }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.preferenceListeners.clear();
    this.drawings.destroy();
    this.indicators.destroy();
    this.markerPlugin.detach();
    this.legend.remove();
    this.container.removeAttribute('title');
    this.native.remove();
  }
}

import {
  HistogramSeries,
  LineSeries,
  type HistogramData,
  type IChartApi,
  type IPaneApi,
  type ISeriesApi,
  type LineData,
  type SeriesType,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from 'lightweight-charts';
import type { ThemeColors } from '@/config/partners';
import type { ChartCandle, ChartIndicator } from './model';
import {
  INDICATOR_DEFINITIONS,
  type IndicatorDefinition,
  type IndicatorFigure,
  type IndicatorValues,
} from './indicatorCalculations';

const MAIN_PANE_INDICATORS = new Set(['BBI', 'BOLL', 'EMA', 'MA', 'SAR', 'SMA']);
const VARIABLE_PERIOD_INDICATORS = new Set(['BIAS', 'EMA', 'MA', 'RSI', 'VOL', 'WR']);
const definitions = new Map(INDICATOR_DEFINITIONS.map((definition) => [definition.name, definition]));

/** Bound user-selected display studies and their persisted representation equally. */
export const MAX_INDICATOR_PARAMETERS = 16;
export const MAX_INDICATOR_PARAMETER = 100_000;

export function getSupportedIndicators(): string[] {
  return INDICATOR_DEFINITIONS.map(({ name }) => name);
}

export function isValidIndicatorParams(name: string, params: readonly number[]): boolean {
  const definition = definitions.get(name);
  if (!definition || params.length > MAX_INDICATOR_PARAMETERS) return false;
  const defaults = definition.calcParams ?? [];
  if (VARIABLE_PERIOD_INDICATORS.has(name) ? params.length === 0 : params.length !== defaults.length) return false;
  return params.every((value, index) => {
    if (!Number.isFinite(value) || value <= 0 || value > MAX_INDICATOR_PARAMETER) return false;
    // Deviation multipliers and acceleration percentages need not be integer periods.
    return name === 'SAR' || (name === 'BOLL' && index === 1) ||
      (name === 'SMA' && index === 1) || Number.isSafeInteger(value);
  });
}

interface IndicatorSeries {
  figure: IndicatorFigure;
  series: ISeriesApi<'Line'> | ISeriesApi<'Histogram'>;
}

interface ActiveIndicator {
  summary: ChartIndicator;
  definition: IndicatorDefinition;
  pane: IPaneApi<Time> | null;
  plots: IndicatorSeries[];
  legend: HTMLDivElement;
  results: IndicatorValues[];
}

export interface IndicatorManagerOptions {
  chart: IChartApi;
  getMainSeries: () => ISeriesApi<SeriesType>;
  getBars: () => readonly ChartCandle[];
  getTheme: () => ThemeColors;
  onLayoutChange: () => void;
}

export function createIndicatorManager({ chart, getMainSeries, getBars, getTheme, onLayoutChange }: IndicatorManagerOptions) {
  const active = new Map<string, ActiveIndicator>();
  let nextId = 0;
  let destroyed = false;
  let hoveredTime: number | null = null;
  let legendFrame: number | null = null;
  const chartElement = chart.chartElement();
  const previousPosition = chartElement.style.position;
  const adjustPosition = getComputedStyle(chartElement).position === 'static';
  if (adjustPosition) chartElement.style.position = 'relative';
  const legendObserver = new ResizeObserver(() => scheduleLegendLayout());

  function scheduleLegendLayout(): void {
    if (destroyed || legendFrame !== null) return;
    legendFrame = requestAnimationFrame(() => {
      legendFrame = null;
      if (destroyed) return;
      const chartBounds = chartElement.getBoundingClientRect();
      const priceLegend = chartElement.parentElement?.querySelector<HTMLElement>('[data-chart-price-legend]');
      const priceLegendBounds = priceLegend?.getBoundingClientRect();
      let mainOffset = priceLegendBounds ? Math.max(4, priceLegendBounds.bottom - chartBounds.top + 4) : 44;
      const paneElements = new Set<HTMLElement>([chartElement]);
      if (priceLegend) paneElements.add(priceLegend);
      for (const indicator of active.values()) {
        const pane = indicator.pane ?? chart.panes()[0];
        const element = pane?.getHTMLElement();
        if (!element) { indicator.legend.hidden = true; continue; }
        paneElements.add(element);
        indicator.legend.hidden = false;
        const bounds = element.getBoundingClientRect();
        const offset = indicator.pane ? 4 : mainOffset;
        Object.assign(indicator.legend.style, {
          top: `${bounds.top - chartBounds.top + offset}px`,
          width: `${Math.max(0, chart.paneSize(pane.paneIndex()).width - 16)}px`,
          maxHeight: `${Math.max(0, bounds.height - offset - 2)}px`,
        });
        if (!indicator.pane) mainOffset += indicator.legend.getBoundingClientRect().height + 2;
      }
      legendObserver.disconnect();
      paneElements.forEach((element) => legendObserver.observe(element));
    });
  }

  function createLegend(name: string): HTMLDivElement {
    const legend = document.createElement('div');
    legend.dataset.chartIndicator = name;
    legend.setAttribute('aria-hidden', 'true');
    Object.assign(legend.style, {
      position: 'absolute', left: '8px', zIndex: '2', pointerEvents: 'none',
      display: 'flex', flexWrap: 'wrap', columnGap: '8px', overflow: 'hidden',
      font: '11px/18px Inter, Arial, sans-serif',
    });
    chartElement.appendChild(legend);
    return legend;
  }

  function renderLegend(indicator: ActiveIndicator): void {
    const bars = getBars();
    const index = hoveredTime === null ? bars.length - 1 : bars.findIndex((bar) => bar.timestamp / 1000 === hoveredTime);
    const values = indicator.results[index];
    const theme = getTheme();
    const palette = colors();
    const label = document.createElement('span');
    label.style.color = theme['content-secondary'];
    label.textContent = `${indicator.summary.name}${indicator.summary.calcParams.length ? `(${indicator.summary.calcParams.join(',')})` : ''}`;
    const figures = indicator.plots.map(({ figure, series }, figureIndex) => {
      const value = values?.[figure.key];
      const span = document.createElement('span');
      let color = palette[figureIndex % palette.length];
      if (figure.type === 'bar' && Number.isFinite(value)) {
        const rising = indicator.summary.name === 'VOL' ? bars[index].close >= bars[index].open
          : indicator.summary.name === 'AO' ? value >= (indicator.results[index - 1]?.[figure.key] ?? value)
            : value >= (figure.baseValue ?? 0);
        color = rising ? theme.up : theme.down;
      } else if (figure.type === 'circle' && Number.isFinite(value)) {
        color = value < (bars[index].high + bars[index].low) / 2 ? theme.up : theme.down;
      }
      span.style.color = color;
      span.textContent = `${figure.title.trim()} ${Number.isFinite(value) ? series.priceFormatter().format(value) : '—'}`;
      return span;
    });
    indicator.legend.replaceChildren(label, ...figures);
  }

  const handleCrosshair = (event: MouseEventParams<Time>) => {
    hoveredTime = typeof event.time === 'number' && event.point ? event.time : null;
    active.forEach(renderLegend);
    scheduleLegendLayout();
  };
  chart.subscribeCrosshairMove(handleCrosshair);

  function colors(): string[] {
    const theme = getTheme();
    return [theme['accent-primary'], theme['accent-secondary'], theme.warning,
      theme['accent-tertiary'], theme.long, theme.short, theme['content-secondary']];
  }

  function getFigures(definition: IndicatorDefinition, params: number[]): IndicatorFigure[] {
    return definition.regenerateFigures?.(params) ?? definition.figures;
  }

  function addPlots(indicator: ActiveIndicator): void {
    const { definition, summary } = indicator;
    if (!MAIN_PANE_INDICATORS.has(summary.name) && !indicator.pane) {
      indicator.pane = chart.addPane();
      indicator.pane.setStretchFactor(1);
      chart.panes()[0]?.setStretchFactor(4);
    }
    const palette = colors();
    const paneIndex = indicator.pane?.paneIndex() ?? 0;
    const priceScaleId = indicator.pane ? 'right' : getMainSeries().options().priceScaleId || 'right';
    indicator.plots = getFigures(definition, summary.calcParams).map((figure, index) => {
      const common = {
        // Names and values live in the pane legends, not stacked on the price axis.
        title: '',
        priceScaleId,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      };
      if (figure.type === 'bar') {
        return {
          figure,
          series: chart.addSeries(HistogramSeries, {
            ...common,
            base: figure.baseValue ?? 0,
            color: getTheme().up,
            priceFormat: definition.series === 'volume' ? { type: 'volume' } : { type: 'price', precision: 2, minMove: 0.01 },
          }, paneIndex),
        };
      }
      return {
        figure,
        series: chart.addSeries(LineSeries, {
          ...common,
          color: palette[index % palette.length],
          lineWidth: 1,
          lineVisible: figure.type !== 'circle',
          pointMarkersVisible: figure.type === 'circle',
          pointMarkersRadius: 2,
          priceFormat: definition.series === 'volume' ? { type: 'volume' }
            : indicator.pane ? { type: 'price', precision: 2, minMove: 0.01 }
              : getMainSeries().options().priceFormat,
        }, paneIndex),
      };
    });
    indicator.pane?.setPreserveEmptyPane(false);
  }

  function removePlots(indicator: ActiveIndicator, preservePane = false): void {
    if (preservePane) indicator.pane?.setPreserveEmptyPane(true);
    for (const { series } of indicator.plots) chart.removeSeries(series);
    indicator.plots = [];
    if (preservePane) return;
    // Native charts can remove empty panes automatically when their last series leaves.
    if (indicator.pane && chart.panes().includes(indicator.pane)) chart.removePane(indicator.pane.paneIndex());
    indicator.pane = null;
  }

  function refreshIndicator(indicator: ActiveIndicator): void {
    const bars = getBars();
    // AVP prefers actual exchange quote-volume. Providers without it use close ×
    // base-volume as a display-only estimate; no order/account amount uses this.
    const calculationBars = indicator.summary.name === 'AVP'
      ? bars.map((bar) => ({ ...bar, turnover: bar.turnover ?? bar.close * bar.volume }))
      : bars;
    const results = indicator.definition.calc(calculationBars, {
      calcParams: indicator.summary.calcParams,
      figures: indicator.plots.map(({ figure }) => figure),
    });
    indicator.results = results;
    const theme = getTheme();
    for (const { figure, series } of indicator.plots) {
      // Studies survive symbol switches, so their formatter must follow the
      // current price series instead of retaining its creation-time precision.
      if (!indicator.pane) series.applyOptions({ priceFormat: getMainSeries().options().priceFormat });
      const data: Array<LineData<Time> | HistogramData<Time> | WhitespaceData<Time>> = bars.map((bar, index) => {
        const time = (bar.timestamp / 1000) as UTCTimestamp;
        const value = results[index]?.[figure.key];
        if (!Number.isFinite(value)) return { time };
        if (figure.type === 'bar') {
          const rising = indicator.summary.name === 'VOL' ? bar.close >= bar.open
            : indicator.summary.name === 'AO' ? value >= (results[index - 1]?.[figure.key] ?? value)
              : value >= (figure.baseValue ?? 0);
          return { time, value, color: rising ? theme.up : theme.down };
        }
        if (figure.type === 'circle') return { time, value, color: value < (bar.high + bar.low) / 2 ? theme.up : theme.down };
        return { time, value };
      });
      series.setData(data);
    }
    renderLegend(indicator);
  }

  function refresh(): void {
    if (destroyed) return;
    active.forEach(refreshIndicator);
    scheduleLegendLayout();
  }

  return {
    getIndicators(): ChartIndicator[] {
      return [...active.values()].map(({ summary }) => ({ ...summary, calcParams: [...summary.calcParams] }));
    },
    addIndicator(name: string): void {
      if (destroyed || [...active.values()].some(({ summary }) => summary.name === name)) return;
      const definition = definitions.get(name);
      if (!definition) return;
      const id = `indicator-${++nextId}`;
      const indicator: ActiveIndicator = {
        summary: { id, name, calcParams: [...definition.calcParams ?? []] },
        definition, pane: null, plots: [], legend: createLegend(name), results: [],
      };
      addPlots(indicator);
      active.set(id, indicator);
      refreshIndicator(indicator);
      scheduleLegendLayout();
      onLayoutChange();
    },
    removeIndicator(id: string): void {
      const indicator = active.get(id);
      if (!indicator || destroyed) return;
      removePlots(indicator);
      indicator.legend.remove();
      active.delete(id);
      scheduleLegendLayout();
      onLayoutChange();
    },
    updateIndicator(id: string, params: number[]): void {
      const indicator = active.get(id);
      if (!indicator || destroyed || !isValidIndicatorParams(indicator.summary.name, params)) return;
      removePlots(indicator, true);
      indicator.summary.calcParams = [...params];
      addPlots(indicator);
      refreshIndicator(indicator);
      scheduleLegendLayout();
      onLayoutChange();
    },
    refresh,
    applyTheme(): void {
      if (destroyed) return;
      const palette = colors();
      active.forEach((indicator) => indicator.plots.forEach(({ figure, series }, index) => {
        if (figure.type !== 'bar') series.applyOptions({ color: palette[index % palette.length] });
      }));
      refresh();
    },
    destroy(): void {
      if (destroyed) return;
      chart.unsubscribeCrosshairMove(handleCrosshair);
      legendObserver.disconnect();
      if (legendFrame !== null) cancelAnimationFrame(legendFrame);
      legendFrame = null;
      active.forEach((indicator) => { removePlots(indicator); indicator.legend.remove(); });
      active.clear();
      if (adjustPosition) chartElement.style.position = previousPosition;
      destroyed = true;
    },
  };
}

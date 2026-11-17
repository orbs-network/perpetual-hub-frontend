export interface ChartCandle {
  /** Exchange candle-open time in milliseconds. */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Actual quote volume, when supplied by the market-data provider. */
  turnover?: number;
}

export interface ChartPeriod {
  span: number;
  type: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
}

export type ChartType = 'candles' | 'hollow-candles' | 'bars' | 'area';
export type DrawingTool = 'trend-line' | 'extended-line' | 'ray' | 'horizontal-line' |
  'horizontal-ray' | 'vertical-line' | 'rectangle' | 'parallel-channel' |
  'price-channel' | 'fibonacci' | 'brush';

export const DRAWING_POINT_COUNTS: Readonly<Record<DrawingTool, number>> = {
  'trend-line': 2, 'extended-line': 2, ray: 2, 'horizontal-line': 1,
  'horizontal-ray': 1, 'vertical-line': 1, rectangle: 2,
  'parallel-channel': 3, 'price-channel': 3, fibonacci: 2, brush: 2,
};

export type ChartPreferenceChange = 'appearance' | 'drawings';

export interface ChartDrawing {
  id: string;
  tool: DrawingTool;
  points: Array<{ timestamp: number; value: number }>;
  locked: boolean;
}

export interface ChartIndicator {
  id: string;
  name: string;
  calcParams: number[];
}

export interface ChartPlotArea {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
}

/** App chart controls and coordinates, independent of a rendering library. */
export interface TradingChartController {
  getData(): readonly ChartCandle[];
  getPlotArea(): ChartPlotArea;
  priceToCoordinate(price: number): number | null;
  coordinateToPrice(y: number): number | null;
  resize(): void;
  getChartType(): ChartType;
  setChartType(type: ChartType): void;
  subscribePreferences(listener: (change: ChartPreferenceChange) => void): () => void;
  getIndicators(): ChartIndicator[];
  addIndicator(name: string): void;
  removeIndicator(id: string): void;
  updateIndicator(id: string, params: number[]): void;
  startDrawing(tool: DrawingTool, onFinish: () => void): string;
  cancelDrawing(id?: string): void;
  getDrawings(): ChartDrawing[];
  setDrawingsLocked(locked: boolean): void;
  clearDrawings(): void;
}

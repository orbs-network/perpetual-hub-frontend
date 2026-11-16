import type { CandleType, Period } from "klinecharts";

export const USER_DRAWING_GROUP = "user-drawings";

export const CHART_PERIODS: ReadonlyArray<{ label: string; period: Period }> = [
  { label: "1m", period: { span: 1, type: "minute" } },
  { label: "3m", period: { span: 3, type: "minute" } },
  { label: "5m", period: { span: 5, type: "minute" } },
  { label: "15m", period: { span: 15, type: "minute" } },
  { label: "30m", period: { span: 30, type: "minute" } },
  { label: "1h", period: { span: 1, type: "hour" } },
  { label: "2h", period: { span: 2, type: "hour" } },
  { label: "4h", period: { span: 4, type: "hour" } },
  { label: "8h", period: { span: 8, type: "hour" } },
  { label: "12h", period: { span: 12, type: "hour" } },
  { label: "1D", period: { span: 1, type: "day" } },
  { label: "3D", period: { span: 3, type: "day" } },
  { label: "1W", period: { span: 1, type: "week" } },
  { label: "1M", period: { span: 1, type: "month" } },
];

export const CHART_TYPES: ReadonlyArray<{ label: string; value: CandleType }> =
  [
    { label: "Candles", value: "candle_solid" },
    { label: "Hollow candles", value: "candle_stroke" },
    { label: "Bars", value: "ohlc" },
    { label: "Area", value: "area" },
  ];

export const DRAWING_TOOLS = [
  { name: "segment", label: "Trend line" },
  { name: "straightLine", label: "Extended line" },
  { name: "rayLine", label: "Ray" },
  { name: "horizontalStraightLine", label: "Horizontal line" },
  { name: "horizontalRayLine", label: "Horizontal ray" },
  { name: "verticalStraightLine", label: "Vertical line" },
  { name: "chartRectangle", label: "Rectangle" },
  { name: "parallelStraightLine", label: "Parallel channel" },
  { name: "priceChannelLine", label: "Price channel" },
  { name: "fibonacciLine", label: "Fibonacci retracement" },
  { name: "brush", label: "Brush" },
] as const;

export const MAIN_PANE_INDICATORS = new Set([
  "BBI",
  "BOLL",
  "EMA",
  "MA",
  "SAR",
  "SMA",
]);

export function periodKey(period: Period) {
  return `${period.span}:${period.type}`;
}

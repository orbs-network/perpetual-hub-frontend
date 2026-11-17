import type { ChartPeriod, ChartType } from "@/lib/chart/model";

export const CHART_PERIODS: ReadonlyArray<{ label: string; period: ChartPeriod }> = [
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

export const CHART_TYPES: ReadonlyArray<{ label: string; value: ChartType }> =
  [
    { label: "Candles", value: "candles" },
    { label: "Hollow candles", value: "hollow-candles" },
    { label: "Bars", value: "bars" },
    { label: "Area", value: "area" },
  ];

export const DRAWING_TOOLS = [
  { name: "trend-line", label: "Trend line" },
  { name: "extended-line", label: "Extended line" },
  { name: "ray", label: "Ray" },
  { name: "horizontal-line", label: "Horizontal line" },
  { name: "horizontal-ray", label: "Horizontal ray" },
  { name: "vertical-line", label: "Vertical line" },
  { name: "rectangle", label: "Rectangle" },
  { name: "parallel-channel", label: "Parallel channel" },
  { name: "price-channel", label: "Price channel" },
  { name: "fibonacci", label: "Fibonacci retracement" },
  { name: "brush", label: "Brush" },
] as const;

export function periodKey(period: ChartPeriod) {
  return `${period.span}:${period.type}`;
}

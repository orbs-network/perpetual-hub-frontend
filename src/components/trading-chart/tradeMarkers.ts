import {
  getOverlayClass,
  registerOverlay,
  type Chart,
  type OverlayCreate,
  type OverlayFigure,
  type OverlayTemplate,
  type Period,
} from "klinecharts";
import type { ThemeColors } from "@/config/partners";
import type { ChartTradeMarker } from "@/lib/chartTradeMarkers";

export const TRADE_MARKER_GROUP = "perpetual-trades";
const TRADE_MARKER_NAME = "perpetualTradeMarker";

interface TradeMarkerData {
  label: string;
  tooltip: string;
  color: string;
  textColor: string;
  stackIndex: number;
  side: "BUY" | "SELL";
}

export function periodToResolution(period: Period): string {
  switch (period.type) {
    case "minute":
      return String(period.span);
    case "hour":
      return String(period.span * 60);
    case "day":
      return `${period.span}D`;
    case "week":
      return `${period.span}W`;
    case "month":
      return `${period.span}M`;
    default:
      return "60";
  }
}

export const tradeMarkerTemplate: OverlayTemplate<TradeMarkerData> = {
  name: TRADE_MARKER_NAME,
  totalStep: 1,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  createPointFigures: ({ coordinates, overlay }) => {
    const point = coordinates[0];
    if (!point) return [];
    const data = overlay.extendData;
    const offset = 16 + data.stackIndex * 18;
    const y = point.y + (data.side === "BUY" ? offset : -offset);
    return [
      {
        type: "circle",
        attrs: { x: point.x, y, r: 8 },
        styles: { style: "fill", color: data.color },
      },
      {
        type: "text",
        attrs: {
          x: point.x,
          y,
          text: data.label,
          align: "center",
          baseline: "middle",
        },
        styles: { color: data.textColor, size: 10, weight: "bold" },
      },
    ] satisfies OverlayFigure[];
  },
  onMouseEnter: ({ chart, overlay }) => {
    const canvas = chart.getDom("candle_pane", "main");
    if (canvas) canvas.title = overlay.extendData.tooltip;
  },
  onMouseLeave: ({ chart }) => {
    const canvas = chart.getDom("candle_pane", "main");
    if (canvas) canvas.removeAttribute("title");
  },
};

export function syncTradeMarkers(
  chart: Pick<
    Chart,
    "getOverlays" | "overrideOverlay" | "createOverlay" | "removeOverlay"
  >,
  markers: ChartTradeMarker[],
  theme: ThemeColors,
) {
  if (!getOverlayClass(TRADE_MARKER_NAME)) registerOverlay(tradeMarkerTemplate);
  const existing = new Set(
    chart.getOverlays({ groupId: TRADE_MARKER_GROUP }).map(({ id }) => id),
  );
  for (const marker of markers) {
    const id = `perpetual-trade-${marker.id}`;
    const options = {
      id,
      name: TRADE_MARKER_NAME,
      groupId: TRADE_MARKER_GROUP,
      paneId: "candle_pane",
      lock: true,
      zLevel: 10,
      points: [
        { timestamp: marker.displayTime * 1000, value: marker.displayPrice },
      ],
      extendData: {
        label: marker.label,
        tooltip: marker.tooltip,
        color: marker.side === "BUY" ? theme.up : theme.down,
        textColor: theme["content-inverse"],
        stackIndex: marker.stackIndex,
        side: marker.side,
      },
    } satisfies OverlayCreate<TradeMarkerData>;
    if (existing.delete(id)) chart.overrideOverlay(options);
    else chart.createOverlay(options);
  }
  for (const id of existing) chart.removeOverlay({ id });
}

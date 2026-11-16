import { getSupportedOverlays, registerOverlay } from "klinecharts";

/** Native overlay extension: the two opposite corners remain draggable. */
export function registerChartDrawingTools() {
  if (getSupportedOverlays().includes("chartRectangle")) return;
  registerOverlay({
    name: "chartRectangle",
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return [];
      const [first, second] = coordinates;
      return [
        {
          type: "rect",
          attrs: {
            x: Math.min(first.x, second.x),
            y: Math.min(first.y, second.y),
            width: Math.abs(first.x - second.x),
            height: Math.abs(first.y - second.y),
          },
          styles: { style: "stroke_fill" },
        },
      ];
    },
  });
}

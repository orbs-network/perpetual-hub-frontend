import type { Chart } from "klinecharts";
import type { Order } from "@/types";
import { classifyPendingOrder } from "@/lib/pendingOrderChart";
import type { ChartOverlayLabel } from "./types";

export function isTpSlChartOrder(order: Order) {
  const kind = classifyPendingOrder(order);
  return kind === "TP" || kind === "SL";
}

export function haveSameChartOverlayLabels(
  current: ChartOverlayLabel[],
  next: ChartOverlayLabel[],
) {
  return (
    current.length === next.length &&
    current.every((label, index) => {
      const nextLabel = next[index];
      return (
        label.key === nextLabel.key &&
        label.top === nextLabel.top &&
        label.left === nextLabel.left &&
        label.text === nextLabel.text &&
        label.quantity === nextLabel.quantity &&
        label.color === nextLabel.color &&
        label.quantityColor === nextLabel.quantityColor &&
        label.cancelOrderId === nextLabel.cancelOrderId &&
        label.cancelBorderColor === nextLabel.cancelBorderColor &&
        label.draggableOrderId === nextLabel.draggableOrderId &&
        label.isUpdating === nextLabel.isUpdating &&
        label.price === nextLabel.price &&
        label.pricePrecision === nextLabel.pricePrecision &&
        label.right === nextLabel.right
      );
    })
  );
}

export function createOptimisticReplacementOrder(
  order: Order,
  orderId: string,
  kind: "LIMIT" | "TP" | "SL",
  // Exact 1e18 domain price, the same unit as Order prices.
  nextPrice: bigint,
): Order {
  return {
    ...order,
    orderId,
    price: kind === "LIMIT" ? nextPrice : order.price,
    stopPrice: kind === "LIMIT" ? order.stopPrice : nextPrice,
    timestamp: Date.now(),
    status: "NEW",
  };
}

export function getChartPriceFromClientY(
  chart: Chart | null | undefined,
  container: HTMLDivElement | null,
  clientY: number,
): number | null {
  if (!chart || !container) return null;
  const pane = chart.getSize("candle_pane", "main");
  if (!pane || pane.height <= 0) return null;
  const y = Math.min(
    Math.max(clientY - container.getBoundingClientRect().top, pane.top),
    pane.top + pane.height,
  );
  const result = chart.convertFromPixel([{ y }], {
    paneId: "candle_pane",
    absolute: true,
  });
  const point = Array.isArray(result) ? result[0] : result;
  return typeof point?.value === "number" && Number.isFinite(point.value)
    ? point.value
    : null;
}

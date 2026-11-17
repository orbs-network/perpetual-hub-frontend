import type { TradingChartController } from "@/lib/chart/model";
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
  chart: TradingChartController | null | undefined,
  container: HTMLDivElement | null,
  clientY: number,
): number | null {
  if (!chart || !container) return null;
  const pane = chart.getPlotArea();
  if (pane.height <= 0 || !Number.isFinite(clientY)) return null;
  const y = Math.min(
    Math.max(clientY - container.getBoundingClientRect().top, pane.top),
    pane.top + pane.height,
  );
  const price = chart.coordinateToPrice(y);
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

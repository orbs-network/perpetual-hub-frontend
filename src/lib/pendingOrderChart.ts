import { SL_ORDER_TYPES, TP_ORDER_TYPES } from "@/config/constants";
import type { Order } from "@/types";

/**
 * The visual kind we render for a pending order on the chart.
 *
 * - `TP` / `SL` → render the styled chip (body + quantity) at `stopPrice`,
 *   matching the existing position-line PNL chip.
 * - `LIMIT` → render the existing `OrderLine` primitive at `price`.
 * - `OTHER` → skip (e.g. an inflight order with no price set yet, or an
 *   order type we don't draw on the chart).
 *
 * Discrimination is by the canonical `orderType` strings (NOT by
 * `reduceOnly`, since both TPs and SLs are reduce-only — relying on the
 * flag was the bug this module replaces).
 */
export type PendingOrderKind = "TP" | "SL" | "LIMIT" | "OTHER";

type ChartOrder = Pick<Order, "orderType" | "stopPrice" | "price">;

export function classifyPendingOrder(order: ChartOrder): PendingOrderKind {
  if (TP_ORDER_TYPES.has(order.orderType) && order.stopPrice > 0n) {
    return "TP";
  }
  if (SL_ORDER_TYPES.has(order.orderType) && order.stopPrice > 0n) {
    return "SL";
  }
  if (order.orderType === "LIMIT" && order.price > 0n) {
    return "LIMIT";
  }
  return "OTHER";
}

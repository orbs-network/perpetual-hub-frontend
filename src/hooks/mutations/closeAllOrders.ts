import type { Order, OrderStatus, Position } from "@/types";

export type CloseAllMethod = "market" | "limit-mid";

const ACTIVE_CLOSE_ORDER_STATUSES = new Set<OrderStatus>([
  "NEW",
  "PENDING_ACTIVATION",
  "PARTIALLY_FILLED",
]);

const TP_ORDER_TYPES = new Set([
  "TAKE_PROFIT",
  "TAKE_PROFIT_MARKET",
  "TAKE_PROFIT_LIMIT",
]);

const SL_ORDER_TYPES = new Set(["STOP", "STOP_MARKET", "STOP_LOSS_LIMIT"]);

function getAssociatedTpSlOrders(position: Position, orders: Order[]) {
  const closeSide = position.quantity > 0n ? "SELL" : "BUY";
  return orders.filter(
    (order) =>
      order.symbol === position.symbol &&
      order.side === closeSide &&
      ACTIVE_CLOSE_ORDER_STATUSES.has(order.status) &&
      (order.reduceOnly || order.closePosition) &&
      (TP_ORDER_TYPES.has(order.orderType) ||
        SL_ORDER_TYPES.has(order.orderType)),
  );
}

function getFullCloseLimitOrdersToReplace(
  orders: Order[],
  symbol: string,
  side: Order["side"],
) {
  return orders.filter(
    (order) =>
      order.symbol === symbol &&
      order.side === side &&
      order.orderType === "LIMIT" &&
      order.closePosition &&
      ACTIVE_CLOSE_ORDER_STATUSES.has(order.status),
  );
}

export function getCloseAllOrdersToCancel(
  positions: Position[],
  orders: Order[],
  method: CloseAllMethod,
) {
  const byId = new Map<string, Order>();

  for (const position of positions) {
    const closeSide = position.quantity > 0n ? "SELL" : "BUY";
    const associatedOrders = getAssociatedTpSlOrders(position, orders);
    if (method === "limit-mid") {
      associatedOrders.push(
        ...getFullCloseLimitOrdersToReplace(
          orders,
          position.symbol,
          closeSide,
        ),
      );
    }
    for (const order of associatedOrders) {
      byId.set(order.orderId, order);
    }
  }

  return [...byId.values()];
}

export function countRejectedSettledResults(
  results: PromiseSettledResult<unknown>[],
) {
  return results.filter((result) => result.status === "rejected").length;
}

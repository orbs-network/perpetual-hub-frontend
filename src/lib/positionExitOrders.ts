import { SL_ORDER_TYPES, TP_ORDER_TYPES } from "@/config/constants";
import type { Order } from "@/types";

const LIVE_POSITION_EXIT_STATUSES = new Set([
  "NEW",
  "PARTIALLY_FILLED",
]);

export function isLivePositionExitOrder(order: Order, symbol: string) {
  return (
    order.symbol === symbol &&
    LIVE_POSITION_EXIT_STATUSES.has(order.status) &&
    (order.reduceOnly || order.closePosition) &&
    (TP_ORDER_TYPES.has(order.orderType) || SL_ORDER_TYPES.has(order.orderType))
  );
}

export function isTakeProfitOrder(order: Order) {
  return TP_ORDER_TYPES.has(order.orderType);
}

export function isStopLossOrder(order: Order) {
  return SL_ORDER_TYPES.has(order.orderType);
}

export function isAttachedExitOrder(order: Order) {
  return !!order.parentOrderId || !!order.bracketGroupId || !!order.attachedRole;
}

export function isLiveFullPositionExitOrder(order: Order, symbol: string) {
  return (
    isLivePositionExitOrder(order, symbol) &&
    order.closePosition &&
    !isAttachedExitOrder(order)
  );
}

function selectPositionFormExitOrder(
  orders: Order[] | undefined,
  predicate: (order: Order) => boolean,
) {
  if (!orders) return undefined;
  return orders.find(predicate);
}

export function selectPositionExitOrders(
  orders: Order[] | undefined,
  symbol: string,
) {
  const exitOrders = orders
    ?.filter((order) => isLiveFullPositionExitOrder(order, symbol))
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    takeProfitOrder: selectPositionFormExitOrder(exitOrders, isTakeProfitOrder),
    stopLossOrder: selectPositionFormExitOrder(exitOrders, isStopLossOrder),
  };
}

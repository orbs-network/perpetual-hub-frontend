import { SL_ORDER_TYPES, TP_ORDER_TYPES } from "@/config/constants";
import type { Order } from "@/types";

export function isTpSlExitOrder(order: Order) {
  return (
    (order.reduceOnly || order.closePosition) &&
    (TP_ORDER_TYPES.has(order.orderType) || SL_ORDER_TYPES.has(order.orderType))
  );
}

export function isFullPositionTpSlOrder(order: Order) {
  return isTpSlExitOrder(order) && order.closePosition;
}

export function isAttachedFixedSizeTpSlOrder(order: Order) {
  return (
    isTpSlExitOrder(order) &&
    order.reduceOnly &&
    !order.closePosition &&
    !!order.parentOrderId &&
    !!order.bracketGroupId &&
    !!order.attachedRole
  );
}

export function canEditOrderSize(order: Order) {
  if (isTpSlExitOrder(order)) {
    return order.reduceOnly && !order.closePosition;
  }
  return true;
}

export function canEditOrderPrice(order: Order) {
  if (isTpSlExitOrder(order)) return false;
  return order.price > 0n;
}

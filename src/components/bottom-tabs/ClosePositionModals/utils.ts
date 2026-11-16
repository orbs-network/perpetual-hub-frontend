import BN from "bignumber.js";
import { fromScaledQuantity, normalizeQuantity } from "@/utils/formatting";
import type { SizeUnit } from "@/components/ui/size-input";
import type { Order, OrderSide, OrderStatus } from "@/types";

const ACTIVE_CLOSE_REPLACE_STATUSES = new Set<OrderStatus>([
  "NEW",
  "PENDING_ACTIVATION",
  "PARTIALLY_FILLED",
]);

const FULL_CLOSE_TP_ORDER_TYPES = new Set([
  "TAKE_PROFIT",
  "TAKE_PROFIT_MARKET",
  "TAKE_PROFIT_LIMIT",
]);

const FULL_CLOSE_SL_ORDER_TYPES = new Set([
  "STOP",
  "STOP_MARKET",
  "STOP_LOSS_LIMIT",
]);

export function getBaseAsset(symbol: string): string {
  if (symbol.endsWith("USDT")) return symbol.slice(0, -4);
  if (symbol.endsWith("USDC")) return symbol.slice(0, -4);
  return symbol;
}

export function deriveCloseSizeValue(
  pct: number,
  absQuantity: BN,
  markPrice: number,
  sizeUnit: SizeUnit,
  qtyPrecision = 8,
): string {
  if (pct <= 0) return "";
  const closeQuantity = absQuantity.multipliedBy(Math.round(pct)).dividedToIntegerBy(100);
  const normalizedQuantity = normalizeQuantity(
    BigInt(closeQuantity.toFixed(0)),
    qtyPrecision,
  );
  const qtyNum = BN(fromScaledQuantity(normalizedQuantity));
  if (qtyNum.lte(0)) return "";
  if (sizeUnit === "usd") {
    const usdValue = qtyNum.multipliedBy(markPrice);
    return usdValue.gte(1)
      ? usdValue.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
      : usdValue.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }
  return qtyNum.toFixed(qtyPrecision).replace(/0+$/, "").replace(/\.$/, "");
}

export function computeCloseQuantity(absQuantity: BN, sizePercent: number): BN {
  return absQuantity.multipliedBy(Math.round(sizePercent)).dividedToIntegerBy(100);
}

export function resolveCloseParams(
  absQuantity: BN,
  sizePercent: number,
  qtyPrecision: number,
) {
  const isFullClose = Math.round(sizePercent) >= 100;
  const exceedsPosition = sizePercent > 100;
  const closeQuantity = normalizeQuantity(
    BigInt(computeCloseQuantity(absQuantity, Math.min(sizePercent, 100)).toFixed(0)),
    qtyPrecision,
  );
  const absQtyBigint = BigInt(absQuantity.toFixed(0));
  const quantity = isFullClose ? absQtyBigint : closeQuantity;
  const displayQuantity = fromScaledQuantity(quantity);
  const isValid = quantity > 0n && !exceedsPosition;

  return { quantity, isFullClose, displayQuantity, isValid, exceedsPosition };
}

export function getFullCloseLimitOrdersToReplace(
  orders: Order[],
  symbol: string,
  side: OrderSide,
) {
  return orders.filter(
    (order) =>
      order.symbol === symbol &&
      order.side === side &&
      order.orderType === "LIMIT" &&
      order.closePosition &&
      ACTIVE_CLOSE_REPLACE_STATUSES.has(order.status),
  );
}

export function getFullCloseTpSlOrdersToReplace(
  orders: Order[],
  symbol: string,
  side: OrderSide,
  role: "take-profit" | "stop-loss",
) {
  const orderTypes =
    role === "take-profit" ? FULL_CLOSE_TP_ORDER_TYPES : FULL_CLOSE_SL_ORDER_TYPES;

  return orders.filter(
    (order) =>
      order.symbol === symbol &&
      order.side === side &&
      order.closePosition &&
      orderTypes.has(order.orderType) &&
      ACTIVE_CLOSE_REPLACE_STATUSES.has(order.status),
  );
}

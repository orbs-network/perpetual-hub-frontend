import { isAttachedFixedSizeTpSlOrder } from "@/lib/orderEditPermissions";
import type { CreateOrderInput } from "@/hooks/mutations/useSubmitOrder";
import type { Order } from "@/types";
import {
  toDomainTickPrice,
  toScaledQuantity,
} from "@/utils/formatting";

export type EditOrderMode = "size" | "price";

export function buildEditOrderInput({
  order,
  mode,
  quantity,
  price,
  qtyPrecision,
  pricePrecision,
}: {
  order: Order;
  mode: EditOrderMode;
  quantity: string;
  price: string;
  qtyPrecision: number;
  pricePrecision: number;
}): CreateOrderInput {
  const isSizeMode = mode === "size";
  const isPriceMode = mode === "price";
  const canEditPrice = order.price > 0n;
  const fixedSizeCloseEdit = isSizeMode && order.closePosition;
  const attachedFixedSizeEdit =
    isSizeMode && isAttachedFixedSizeTpSlOrder(order);
  const limitOrderEdit = order.orderType === "LIMIT";

  return {
    symbol: order.symbol,
    orderType: order.orderType,
    side: order.side,
    quantity: isSizeMode
      ? toScaledQuantity(quantity, qtyPrecision)
      : order.quantity,
    // Order prices are exact 1e18: a size-only edit re-sends them unchanged.
    price: canEditPrice
      ? isPriceMode
        ? toDomainTickPrice(price, pricePrecision)
        : order.price
      : undefined,
    stopPrice: order.stopPrice > 0n ? order.stopPrice : undefined,
    reduceOnly: fixedSizeCloseEdit ? true : order.reduceOnly,
    closePosition: fixedSizeCloseEdit ? false : order.closePosition,
    timeInForce: order.timeInForce,
    replacement:
      attachedFixedSizeEdit || limitOrderEdit
        ? { orderId: order.orderId }
        : undefined,
  };
}

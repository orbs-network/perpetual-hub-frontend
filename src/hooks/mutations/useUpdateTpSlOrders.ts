import { useMutation } from "@tanstack/react-query";
import type { Order, OrderResponse, OrderSide, Position } from "@/types";
import { toDomainTickPrice } from "@/utils/formatting";
import { ACTIVE_ORDER_STATUSES } from "@/config/constants";
import { getFullCloseTpSlOrdersToReplace } from "@/components/bottom-tabs/ClosePositionModals/utils";
import type { CreateOrderInput } from "./useSubmitOrder";
import { useCancelOrder } from "./useCancelOrder";
import { useSubmitOrder } from "./useSubmitOrder";
import { useUserAccount } from "../useUserAccount";
import { toast } from "sonner";
import { useOnOrdersChangeCallback } from "./useOnOrdersChangeCallback";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useTranslation } from "@/hooks/useSafeTranslation";

interface UpdateTpSlOrdersInput {
  position: Position;
  configureAmount: boolean;
  sizePercent: number;
  closeQuantity: bigint;
  hasTp: boolean;
  tpPrice: string;
  hasSl: boolean;
  slPrice: string;
  limitPrice: boolean;
  tpLimitPrice: string;
  slLimitPrice: string;
  existingTpOrder?: Order;
  existingSlOrder?: Order;
  lockExistingFullPosition?: boolean;
  pricePrecision: number;
  onSuccess: () => void;
}

function getCloseSide(position: Position): OrderSide {
  return position.quantity > 0n ? "SELL" : "BUY";
}

type TpSlRole = "take-profit" | "stop-loss";

const TP_LIMIT_ORDER_TYPES = new Set(["TAKE_PROFIT", "TAKE_PROFIT_LIMIT"]);
const SL_LIMIT_ORDER_TYPES = new Set(["STOP", "STOP_LOSS_LIMIT"]);

function isActiveOrder(order: Order | undefined): order is Order {
  return !!order && ACTIVE_ORDER_STATUSES.has(order.status);
}

function hasPositivePrice(price: string) {
  return !!price && parseFloat(price) > 0;
}

function isLimitOrder(role: TpSlRole, order: Order) {
  if (order.price <= 0n) return false;
  return role === "take-profit"
    ? TP_LIMIT_ORDER_TYPES.has(order.orderType)
    : SL_LIMIT_ORDER_TYPES.has(order.orderType);
}

function buildDesiredTpSlOrder({
  role,
  position,
  closeSide,
  quantity,
  isFullClose,
  enabled,
  triggerPrice,
  limitPriceEnabled,
  limitPrice,
  pricePrecision,
}: {
  role: TpSlRole;
  position: Position;
  closeSide: OrderSide;
  quantity: bigint;
  isFullClose: boolean;
  enabled: boolean;
  triggerPrice: string;
  limitPriceEnabled: boolean;
  limitPrice: string;
  pricePrecision: number;
}): CreateOrderInput | undefined {
  if (!enabled || !hasPositivePrice(triggerPrice)) return undefined;

  const useLimit = limitPriceEnabled && hasPositivePrice(limitPrice);
  return {
    symbol: position.symbol,
    orderType:
      role === "take-profit"
        ? useLimit
          ? "TAKE_PROFIT_LIMIT"
          : "TAKE_PROFIT_MARKET"
        : useLimit
          ? "STOP_LOSS_LIMIT"
          : "STOP_MARKET",
    side: closeSide,
    quantity,
    stopPrice: toDomainTickPrice(triggerPrice, pricePrecision),
    ...(useLimit && {
      price: toDomainTickPrice(limitPrice, pricePrecision),
    }),
    closePosition: isFullClose,
    reduceOnly: !isFullClose,
  };
}

function orderMatchesDesiredTpSl(
  role: TpSlRole,
  order: Order | undefined,
  desired: CreateOrderInput | undefined,
) {
  if (!desired) return !isActiveOrder(order);
  if (!isActiveOrder(order)) return false;

  const desiredStopPrice = desired.stopPrice ?? 0n;
  if (order.stopPrice !== desiredStopPrice) {
    return false;
  }

  const desiredIsLimit = desired.price !== undefined && desired.price > 0n;
  if (isLimitOrder(role, order) !== desiredIsLimit) return false;
  if (desiredIsLimit && order.price !== desired.price) {
    return false;
  }

  const desiredClosePosition = !!desired.closePosition;
  const desiredReduceOnly = !!desired.reduceOnly;
  if (order.closePosition !== desiredClosePosition) return false;
  if (order.reduceOnly !== desiredReduceOnly) return false;

  if (!desiredClosePosition && order.quantity !== desired.quantity) {
    return false;
  }

  return true;
}

function addOrderOnce(orders: Order[], order: Order | undefined) {
  if (!order || !isActiveOrder(order)) return orders;
  if (orders.some((item) => item.orderId === order.orderId)) return orders;
  return [...orders, order];
}

function isFixedSizeTpSlOrder(order: Order | undefined): order is Order {
  return !!order && order.reduceOnly && !order.closePosition;
}

function isAttachedFixedSizeTpSlOrder(order: Order | undefined): order is Order {
  return (
    isFixedSizeTpSlOrder(order) &&
    !!order.parentOrderId &&
    !!order.bracketGroupId &&
    !!order.attachedRole
  );
}

function replacementOrderId(order: Order | undefined) {
  if (!isAttachedFixedSizeTpSlOrder(order)) return undefined;
  if (!/^\d+$/.test(order.orderId)) return undefined;
  return BigInt(order.orderId) > 0n ? order.orderId : undefined;
}

export function buildTpSlLegUpdate({
  role,
  position,
  closeSide,
  quantity,
  isFullClose,
  enabled,
  triggerPrice,
  limitPriceEnabled,
  limitPrice,
  pricePrecision,
  existingOrder,
  orders,
  lockExistingFullPosition = false,
}: {
  role: TpSlRole;
  position: Position;
  closeSide: OrderSide;
  quantity: bigint;
  isFullClose: boolean;
  enabled: boolean;
  triggerPrice: string;
  limitPriceEnabled: boolean;
  limitPrice: string;
  pricePrecision: number;
  existingOrder?: Order;
  orders: Order[];
  lockExistingFullPosition?: boolean;
}): {
  ordersToCancel: Order[];
  orderToSubmit?: CreateOrderInput;
  replacementOrderId?: string;
} {
  if (
    lockExistingFullPosition &&
    isActiveOrder(existingOrder) &&
    existingOrder.closePosition
  ) {
    return enabled
      ? { ordersToCancel: [] }
      : { ordersToCancel: [existingOrder] };
  }

  const preserveExistingFixedSize =
    isFullClose && isFixedSizeTpSlOrder(existingOrder);
  const effectiveQuantity = preserveExistingFixedSize
    ? existingOrder.quantity
    : quantity;
  const effectiveIsFullClose = preserveExistingFixedSize ? false : isFullClose;

  const orderToSubmit = buildDesiredTpSlOrder({
    role,
    position,
    closeSide,
    quantity: effectiveQuantity,
    isFullClose: effectiveIsFullClose,
    enabled,
    triggerPrice,
    limitPriceEnabled,
    limitPrice,
    pricePrecision,
  });

  if (orderMatchesDesiredTpSl(role, existingOrder, orderToSubmit)) {
    return { ordersToCancel: [] };
  }

  const replacementId = orderToSubmit
    ? replacementOrderId(existingOrder)
    : undefined;
  if (replacementId) {
    return {
      ordersToCancel: [],
      orderToSubmit,
      replacementOrderId: replacementId,
    };
  }

  const fullCloseOrdersToReplace = getFullCloseTpSlOrdersToReplace(
    orders,
    position.symbol,
    closeSide,
    role,
  );
  const ordersToCancel = isFullClose
    ? addOrderOnce(fullCloseOrdersToReplace, existingOrder)
    : existingOrder && isActiveOrder(existingOrder)
      ? [existingOrder]
      : [];

  return { ordersToCancel, orderToSubmit };
}

export function useUpdateTpSlOrders() {
  const { t } = useTranslation();
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const { mutateAsync: cancelOrder } = useCancelOrder();
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const { data: userAccount } = useUserAccount();
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );

  return useMutation({
    mutationFn: async ({
      position,
      configureAmount,
      closeQuantity,
      hasTp,
      tpPrice,
      hasSl,
      slPrice,
      limitPrice,
      tpLimitPrice,
      slLimitPrice,
      existingTpOrder,
      existingSlOrder,
      lockExistingFullPosition,
      pricePrecision,
      onSuccess,
    }: UpdateTpSlOrdersInput) => {
      const absQtyBigint =
        position.quantity > 0n ? position.quantity : -position.quantity;
      const closeSide = getCloseSide(position);
      const isFullClose = !configureAmount;
      const quantity = isFullClose ? absQtyBigint : closeQuantity;
      const orders = userAccount?.orders ?? [];

      const updates = [
        {
          role: "take-profit" as const,
          ...buildTpSlLegUpdate({
            role: "take-profit",
            position,
            closeSide,
            quantity,
            isFullClose,
            enabled: hasTp,
            triggerPrice: tpPrice,
            limitPriceEnabled: limitPrice,
            limitPrice: tpLimitPrice,
            pricePrecision,
            existingOrder: existingTpOrder,
            orders,
            lockExistingFullPosition,
          }),
        },
        {
          role: "stop-loss" as const,
          ...buildTpSlLegUpdate({
            role: "stop-loss",
            position,
            closeSide,
            quantity,
            isFullClose,
            enabled: hasSl,
            triggerPrice: slPrice,
            limitPriceEnabled: limitPrice,
            limitPrice: slLimitPrice,
            pricePrecision,
            existingOrder: existingSlOrder,
            orders,
            lockExistingFullPosition,
          }),
        },
      ];

      const toastId = toast.loading(t("Modify request submitted"));
      const submittedOrders: Array<{
        role: TpSlRole;
        response: OrderResponse;
      }> = [];
      const hasCancellations = updates.some(
        (update) => update.ordersToCancel.length > 0,
      );
      if (hasCancellations) {
        beginOrderReplacement();
      }

      try {
        for (const update of updates) {
          for (const order of update.ordersToCancel) {
            await cancelOrder({
              orderId: order.orderId,
              silent: true,
              refetchOnSuccess: false,
            });
          }
          if (update.orderToSubmit) {
            const response = await submitOrder({
              input: {
                ...update.orderToSubmit,
                replacement: update.replacementOrderId
                  ? { orderId: update.replacementOrderId }
                  : undefined,
              },
            });
            submittedOrders.push({ role: update.role, response });
          }
        }
        await refetchOrders();
        toast.success(t("Modified order"), {
          id: toastId,
          duration: 3000,
        });
        onSuccess();
        return { submittedOrders };
      } catch (error) {
        console.error(error);
        try {
          await refetchOrders();
        } catch (refetchError) {
          console.error(refetchError);
        }
        toast.error(t("Modify failed"), { id: toastId, duration: 3000 });
        throw error;
      } finally {
        if (hasCancellations) {
          endOrderReplacement();
        }
      }
    },
  });
}

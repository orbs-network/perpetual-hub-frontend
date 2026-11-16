import { getCollateralSymbol } from "@/utils/collateralDisplay";
import type { OrderSide, OrderType, TimeInForce } from "../../types";
import { useMutation } from "@tanstack/react-query";
import { useOrderFormStore } from "@/stores/orderFormStore";
import {
  domainPriceNotional,
  toDomainPrice,
  toDomainTickPriceWithTick,
  toScaledPrice,
  toScaledQuantityWithStep,
} from "@/utils/formatting";
import { useFormMarginInfo } from "@/hooks/order-form/useFormMarginInfo";
import { useMarket } from "../useMarkets";
import {
  getSubmitOrderErrorTitle,
  useSubmitOrder,
  type CreateOrderInput,
  type BracketOrderInput,
  type BracketOrderLegInput,
} from "./useSubmitOrder";
import { useSubmitOrderSuccessTitle } from "../useFormatFillMessage";
import { useAccountSymbolLeverage, useUserAccount } from "../useUserAccount";
import { getReduceOnlyMaxQuantity } from "@/utils/orderSizing";
import { useSymbolConfig } from "../useSymbolConfig";
import { useSelectedSymbolMaxLeverage, useTradeSymbol } from "../useSelectTradeSymbol";
import { toast } from "sonner";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useOnOrdersChangeCallback } from "./useOnOrdersChangeCallback";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  getInvalidAttachedTpSlTriggerPriceMessage,
} from "@/lib/tpSlValidation";

type LogFn = (reason: string, extra?: Record<string, unknown>) => void;

function validateQuantity(
  quantity: bigint,
  derivedQuantity: string,
  price: string,
  log: LogFn,
) {
  if (quantity <= 0n) {
    log("invalid-derived-quantity", { derivedQuantity, price });
    throw new Error("Order size resolved to zero");
  }
}

function validateMargin(
  marginInfo: {
    hasEnough: boolean;
    hasValidQuantity: boolean;
    derivedQuantity: string;
  },
  effectiveReduceOnly: boolean,
  skipRiskEngine: boolean,
  quantity: bigint,
  log: LogFn,
) {
  if (
    !effectiveReduceOnly &&
    !skipRiskEngine &&
    (!marginInfo.hasEnough || !marginInfo.hasValidQuantity)
  ) {
    log("margin-check-failed", {
      derivedQuantity: marginInfo.derivedQuantity,
      quantity: quantity.toString(),
      hasEnough: marginInfo.hasEnough,
      hasValidQuantity: marginInfo.hasValidQuantity,
    });
    throw new Error("Order failed validation before submission");
  }
}

function parsePositiveScaledAmount(value: string | undefined) {
  if (!value) return undefined;
  const scaled = toScaledPrice(value);
  return scaled > 0n ? scaled : undefined;
}

function parseLimitPrice(
  price: string,
  pricePrecision: number,
  tickSize: string | undefined,
  log: LogFn,
): bigint {
  const parsed = parseFloat(price);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return toDomainTickPriceWithTick(price, tickSize, pricePrecision);
  }
  log("invalid-limit-price", { price });
  throw new Error("Invalid limit price");
}

function validateMarketFlipRemainderNotional({
  isFlipOrder,
  remainderQuantity,
  selectedOrderPrice,
  minNotional,
  t,
  log,
}: {
  isFlipOrder: boolean;
  remainderQuantity: bigint;
  selectedOrderPrice: string;
  minNotional: string | undefined;
  t: (value: string) => string;
  log: LogFn;
}) {
  if (!isFlipOrder) return;

  const minNotionalScaled = parsePositiveScaledAmount(minNotional);
  if (minNotionalScaled === undefined) return;

  const referencePrice = toDomainPrice(selectedOrderPrice);
  if (referencePrice <= 0n) return;

  const remainderNotional = domainPriceNotional(remainderQuantity, referencePrice);
  if (remainderNotional >= minNotionalScaled) return;

  const message = `Flip remainder is below the ${minNotional} ${getCollateralSymbol()} minimum notional. Increase size or close to flat.`;
  log("flip-remainder-below-min-notional", {
    remainderQuantity: remainderQuantity.toString(),
    selectedOrderPrice,
    minNotional,
    remainderNotional: remainderNotional.toString(),
  });
  toast.error(t("Order failed"), {
    description: t(message),
    duration: 6000,
  });
  throw new Error(message);
}

function parseAttachedLeg(
  triggerPrice: string,
  limitPrice: string,
  marketType: OrderType,
  limitType: OrderType,
  label: string,
  pricePrecision: number,
  tickSize: string | undefined,
  log: LogFn,
): BracketOrderLegInput {
  const parsedTrigger = parseFloat(triggerPrice);
  if (!Number.isFinite(parsedTrigger) || parsedTrigger <= 0) {
    log("invalid-attached-trigger-price", { label, triggerPrice });
    throw new Error(`Invalid ${label} trigger price`);
  }
  const leg: BracketOrderLegInput = {
    orderType: marketType,
    stopPrice: toDomainTickPriceWithTick(triggerPrice, tickSize, pricePrecision),
    timeInForce: "GTC",
  };
  if (limitPrice) {
    const parsedLimit = parseFloat(limitPrice);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      log("invalid-attached-limit-price", { label, limitPrice });
      throw new Error(`Invalid ${label} limit price`);
    }
    leg.orderType = limitType;
    leg.price = toDomainTickPriceWithTick(limitPrice, tickSize, pricePrecision);
  }
  return leg;
}

function buildBracket(
  form: {
    takeProfitEnabled: boolean;
    takeProfitPrice: string;
    takeProfitLimitPrice: string;
    stopLossEnabled: boolean;
    stopLossPrice: string;
    stopLossLimitPrice: string;
  },
  effectiveReduceOnly: boolean,
  closePosition: boolean,
  pricePrecision: number,
  tickSize: string | undefined,
  side: OrderSide,
  selectedOrderPrice: string,
  t: (value: string) => string,
  log: LogFn,
): BracketOrderInput | undefined {
  if (effectiveReduceOnly || closePosition) return undefined;
  if (!form.takeProfitEnabled && !form.stopLossEnabled) return undefined;

  const bracket: BracketOrderInput = {};
  const validateAttachedTrigger = (
    kind: "TP" | "SL",
    label: string,
    triggerPrice: string,
  ) => {
    const message = getInvalidAttachedTpSlTriggerPriceMessage({
      kind,
      side,
      triggerPrice: parseFloat(triggerPrice),
      entryPrice: parseFloat(selectedOrderPrice),
      t,
    });
    if (!message) return;

    log("attached-trigger-wrong-side-of-entry", {
      label,
      triggerPrice,
      selectedOrderPrice,
    });
    throw new Error(message);
  };

  if (form.takeProfitEnabled) {
    validateAttachedTrigger("TP", "take-profit", form.takeProfitPrice);
    bracket.takeProfit = parseAttachedLeg(
      form.takeProfitPrice,
      form.takeProfitLimitPrice,
      "TAKE_PROFIT_MARKET",
      "TAKE_PROFIT",
      "take-profit",
      pricePrecision,
      tickSize,
      log,
    );
  }
  if (form.stopLossEnabled) {
    validateAttachedTrigger("SL", "stop-loss", form.stopLossPrice);
    bracket.stopLoss = parseAttachedLeg(
      form.stopLossPrice,
      form.stopLossLimitPrice,
      "STOP_MARKET",
      "STOP",
      "stop-loss",
      pricePrecision,
      tickSize,
      log,
    );
  }
  return bracket;
}

export function useSubmitFormOrder() {
  const { t } = useTranslation();
  const { mutateAsync: submitOrder } = useSubmitOrder();
  const {
    marginInfo,
    effectiveReduceOnly,
    selectedOrderPrice,
  } = useFormMarginInfo();
  const {
    side,
    uiOrderType,
    price,
    closePosition,
    skipRiskEngine,
    takeProfitEnabled,
    takeProfitPrice,
    takeProfitLimitPrice,
    stopLossEnabled,
    stopLossPrice,
    stopLossLimitPrice,
    resetAttachedExits,
  } = useOrderFormStore();
  const { symbol } = useTradeSymbol();
  const getSubmitOrderSuccessTitle = useSubmitOrderSuccessTitle(symbol);
  const market = useMarket(symbol);
  const symbolConfig = useSymbolConfig(symbol);
  const { refetch: refetchMaxLeverage } = useSelectedSymbolMaxLeverage();
  const { leverage: userLeverage } = useAccountSymbolLeverage(symbol);
  const { data: userAccount } = useUserAccount();
  const { mutateAsync: refetchOrders } = useOnOrdersChangeCallback();
  const beginOrderReplacement = useOrderOperationsStore(
    (state) => state.beginOrderReplacement,
  );
  const endOrderReplacement = useOrderOperationsStore(
    (state) => state.endOrderReplacement,
  );
  const suppressFillToastForOrder = useOrderOperationsStore(
    (state) => state.suppressFillToastForOrder,
  );
  const claimOrderSubmitToast = useOrderOperationsStore(
    (state) => state.claimOrderSubmitToast,
  );

  const orderType: OrderType = uiOrderType;
  const pricePrecision = market?.pricePrecision ?? 2;

  const log: LogFn = (reason, extra) => {
    if (!import.meta.env.DEV) return;
    console.warn("[OrderSubmit] blocked", {
      reason,
      symbol,
      orderType,
      side,
      closePosition,
      skipRiskEngine,
      effectiveReduceOnly,
      marginPercent: useOrderFormStore.getState().marginPercent,
      marginInfo,
      ...extra,
    });
  };

  return useMutation({
    mutationFn: async () => {
      const requestedQuantity = toScaledQuantityWithStep(
        marginInfo.derivedQuantity,
        symbolConfig?.stepSize,
        market?.quantityPrecision ?? 3,
      );
      const reduceOnlyMaxQuantity = getReduceOnlyMaxQuantity(
        userAccount?.positions ?? [],
        symbol,
        side,
      );
      const shouldCloseOppositeImmediately = orderType !== "LIMIT";
      const hasOppositeLivePosition =
        !effectiveReduceOnly && !closePosition && reduceOnlyMaxQuantity > 0n;
      const isOppositeLimitReduce =
        orderType === "LIMIT" &&
        hasOppositeLivePosition &&
        requestedQuantity <= reduceOnlyMaxQuantity;
      const isOppositeCloseOnly =
        shouldCloseOppositeImmediately &&
        hasOppositeLivePosition &&
        requestedQuantity <= reduceOnlyMaxQuantity;
      const isFlipCloseOnly =
        isOppositeCloseOnly && requestedQuantity === reduceOnlyMaxQuantity;
      const isFlipOrder =
        shouldCloseOppositeImmediately &&
        hasOppositeLivePosition &&
        requestedQuantity > reduceOnlyMaxQuantity;

      if (effectiveReduceOnly && reduceOnlyMaxQuantity <= 0n) {
        log("reduce-only-without-closable-position", {
          requestedQuantity: requestedQuantity.toString(),
        });
        throw new Error("Reduce Only is available only for an open position");
      }

      let quantity = requestedQuantity;
      if (isFlipOrder) {
        quantity = requestedQuantity - reduceOnlyMaxQuantity;
      } else if (effectiveReduceOnly && requestedQuantity > reduceOnlyMaxQuantity) {
        quantity = reduceOnlyMaxQuantity;
      }

      validateQuantity(quantity, marginInfo.derivedQuantity, price, log);
      validateMarketFlipRemainderNotional({
        isFlipOrder,
        remainderQuantity: quantity,
        selectedOrderPrice,
        minNotional: symbolConfig?.minNotional,
        t,
        log,
      });
      validateMargin(
        marginInfo,
        effectiveReduceOnly || isOppositeCloseOnly || isOppositeLimitReduce,
        skipRiskEngine,
        quantity,
        log,
      );

      const input: CreateOrderInput = {
        symbol,
        orderType: isOppositeCloseOnly ? "MARKET" : orderType,
        side,
        quantity,
        reduceOnly: isOppositeCloseOnly ? !isFlipCloseOnly : effectiveReduceOnly,
        closePosition: isFlipCloseOnly ? true : closePosition,
        timeInForce: "GTC" as TimeInForce,
        skipRiskEngine: skipRiskEngine || undefined,
      };

      if (!isOppositeCloseOnly && orderType === "LIMIT") {
        input.price = parseLimitPrice(
          price,
          pricePrecision,
          symbolConfig?.tickSize,
          log,
        );
      }

      const attachedTpSlForm = {
        takeProfitEnabled,
        takeProfitPrice,
        takeProfitLimitPrice,
        stopLossEnabled,
        stopLossPrice,
        stopLossLimitPrice,
      };
      // Verify user's leverage doesn't exceed the latest max

      const validationFn = async () => {
        const latestMaxLeverage = (await refetchMaxLeverage()).data ?? 0;
        if (latestMaxLeverage && userLeverage > latestMaxLeverage) {
          throw new Error(
            `Your leverage (${userLeverage}x) exceeds the current maximum (${latestMaxLeverage}x). Please reduce your leverage before placing this order.`,
          );
        }
      };

      const toastId = toast.loading(t("Order submitted"));
      const pauseAccountRefresh = isFlipOrder && !isFlipCloseOnly;
      if (pauseAccountRefresh) {
        beginOrderReplacement();
      }

      try {
        if (!isOppositeCloseOnly) {
          input.bracket = buildBracket(
            attachedTpSlForm,
            effectiveReduceOnly,
            closePosition,
            pricePrecision,
            symbolConfig?.tickSize,
            side,
            selectedOrderPrice,
            t,
            log,
          );
        }

        if (import.meta.env.DEV) {
          console.info("[OrderSubmit] submitting", {
            symbol,
            orderType,
            side,
            closePosition,
            skipRiskEngine,
            effectiveReduceOnly,
            hasOppositeLivePosition,
            shouldCloseOppositeImmediately,
            isOppositeLimitReduce,
            isFlipOrder,
            isOppositeCloseOnly,
            isFlipCloseOnly,
            derivedQuantity: marginInfo.derivedQuantity,
            input,
          });
        }

        if (isFlipOrder && !isFlipCloseOnly) {
          // Reject a known-invalid opening leg before closing the live position.
          // The opening submission still rechecks after the close completes.
          await validationFn();
          const closeInput: CreateOrderInput = {
            symbol,
            orderType: "MARKET",
            side,
            quantity: reduceOnlyMaxQuantity,
            closePosition: true,
            timeInForce: "GTC" as TimeInForce,
          };

          const closeResponse = await submitOrder({ input: closeInput });
          suppressFillToastForOrder(closeResponse.orderId);
        }

        const response = await submitOrder({
          input,
          validationFn: isOppositeCloseOnly ? undefined : validationFn,
        });
        const shouldShowSubmitToast = claimOrderSubmitToast(
          response.orderId,
          response.status === "FILLED",
        );
        await refetchOrders();
        if (shouldShowSubmitToast) {
          toast.success(getSubmitOrderSuccessTitle(response, input), {
            id: toastId,
            duration: 4000,
          });
        } else {
          toast.dismiss(toastId);
        }
        return response;
      } catch (error) {
        if (pauseAccountRefresh) {
          try {
            await refetchOrders();
          } catch (refetchError) {
            console.error(refetchError);
          }
        }
        toast.error(getSubmitOrderErrorTitle(input, t), {
          id: toastId,
          duration: 6000,
        });
        throw error;
      } finally {
        if (pauseAccountRefresh) {
          endOrderReplacement();
        }
      }
    },
    onSuccess: () => {
      resetAttachedExits();
    },
  });
}

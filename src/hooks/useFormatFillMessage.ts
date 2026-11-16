import { useCallback } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import type { OrderResponse, OrderSide, OrderType } from "@/types";
import { useMarket } from "./useMarkets";
import {
  domainPriceToDisplayNumber,
  formatNumber,
  fromScaledQuantity,
} from "@/utils/formatting";
import { getDisplaySymbol } from "@/lib/utils";

interface FillMessageResponse {
  quantity?: string;
  entryPrice?: string;
  side?: string;
  symbol?: string;
}

interface FillMessageInput {
  side: OrderSide;
  symbol: string;
  quantity: bigint;
}

interface SubmitOrderSuccessInput extends FillMessageInput {
  orderType: OrderType;
  reduceOnly?: boolean;
  closePosition?: boolean;
}

const EXIT_ORDER_TYPES: OrderType[] = [
  "STOP",
  "STOP_MARKET",
  "STOP_LOSS_LIMIT",
  "TAKE_PROFIT",
  "TAKE_PROFIT_MARKET",
  "TAKE_PROFIT_LIMIT",
];

function buildFillMessage(
  response: FillMessageResponse,
  input: FillMessageInput,
  pricePrecision: number,
  quantityPrecision: number,
  t: (value: string) => string,
): string {
  const symbol = getDisplaySymbol(input.symbol || response.symbol || "");
  const qty = formatNumber(fromScaledQuantity(input.quantity), {
    decimalScale: quantityPrecision,
  });
  const action = t(input.side === "BUY" ? "bought" : "sold");

  if (response.entryPrice) {
    const price = domainPriceToDisplayNumber(response.entryPrice);
    if (price > 0) {
      const formattedPrice = formatNumber(price, {
        decimalScale: pricePrecision,
      });
      return `${qty} ${symbol} ${action} ${t("at average price")} $${formattedPrice}`;
    }
  }

  return `${qty} ${symbol} ${action}`;
}

export function useFormatFillMessage(symbol = "") {
  const { t } = useTranslation();
  const market = useMarket(symbol);
  const pricePrecision = market?.pricePrecision ?? 2;
  const quantityPrecision = market?.quantityPrecision ?? 8;

  return useCallback(
    (response: FillMessageResponse, input: FillMessageInput) =>
      buildFillMessage(response, input, pricePrecision, quantityPrecision, t),
    [pricePrecision, quantityPrecision, t],
  );
}

export function getSuccessTitle(
  isFilled: boolean,
  isClose: boolean,
  isTriggerExit: boolean,
  t: (value: string) => string,
) {
  if (isFilled)
    return t(isClose ? "Position closed!" : "Order filled!");
  if (isTriggerExit) return t("TP/SL placed");
  return t(isClose ? "Close order placed" : "Order placed");
}

export function useSubmitOrderSuccessTitle(symbol = "") {
  const { t } = useTranslation();
  const formatFillMessage = useFormatFillMessage(symbol);

  return useCallback(
    (response: OrderResponse, input: SubmitOrderSuccessInput) => {
      const isFilled = response.status === "FILLED";
      if (isFilled) {
        return formatFillMessage(response, input);
      }

      const isClose = input.closePosition || false;
      const isExitIntent = input.reduceOnly || input.closePosition || false;
      const isTriggerExitOrder =
        isExitIntent && EXIT_ORDER_TYPES.includes(input.orderType);

      return getSuccessTitle(isFilled, isClose, isTriggerExitOrder, t);
    },
    [formatFillMessage, t],
  );
}

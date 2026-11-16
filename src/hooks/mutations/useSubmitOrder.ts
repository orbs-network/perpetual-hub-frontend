import { createOrder } from "../../api/orders";
import { generateRequestId } from "../../api/client";
import { useAuthSession } from "../useAuthSession";
import { signOrder, signBracketOrder, signCancel } from "../../utils/signing";
import type { OrderType, OrderSide, TimeInForce } from "../../types";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  domainPriceToDecimal,
  domainPriceToLegacyPrice,
} from "@/utils/formatting";

import { useActiveAddress } from "@/hooks/useActiveAddress";
import { useSupportedChainId } from "@/hooks/useSupportedChainId";

// All prices are exact backend/TEE PriceScale (1e18) bigints.
export interface CreateOrderInput {
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: bigint;
  price?: bigint;
  stopPrice?: bigint;
  reduceOnly?: boolean;
  closePosition?: boolean;
  timeInForce?: TimeInForce;
  skipRiskEngine?: boolean;
  bracket?: BracketOrderInput;
  replacement?: OrderReplacementInput;
}

export interface OrderReplacementInput {
  orderId: string;
}

export interface BracketOrderLegInput {
  orderType: OrderType;
  stopPrice: bigint;
  price?: bigint;
  timeInForce?: TimeInForce;
}

export interface BracketOrderInput {
  takeProfit?: BracketOrderLegInput;
  stopLoss?: BracketOrderLegInput;
}

/**
 * Request fields for one exact 1e18 price: the exact decimal string always,
 * plus the legacy 1e6 integer only when the price is representable at 1e6
 * (so an older backend still accepts every on-grid order). A missing or zero
 * price produces no fields.
 */
export function serializeOrderPrice(price?: bigint): {
  legacy?: string;
  decimal?: string;
} {
  if (!price || price <= 0n) return {};
  return {
    legacy: domainPriceToLegacyPrice(price),
    decimal: domainPriceToDecimal(price),
  };
}

function serializeBracketLeg(leg?: BracketOrderLegInput) {
  if (!leg) return undefined;
  const stopPrice = serializeOrderPrice(leg.stopPrice);
  const price = serializeOrderPrice(leg.price);
  return {
    orderType: leg.orderType,
    stopPrice: stopPrice.legacy,
    stopPriceDecimal: stopPrice.decimal,
    price: price.legacy,
    priceDecimal: price.decimal,
    timeInForce: leg.timeInForce ?? "GTC",
  };
}

/**
 * Top-level price fields of the order request. A zero/absent price keeps the
 * legacy "0" exactly as before and sends no decimal field.
 */
export function buildOrderPriceParams(input: Pick<CreateOrderInput, "price" | "stopPrice">) {
  const price = serializeOrderPrice(input.price);
  const stopPrice = serializeOrderPrice(input.stopPrice);
  return {
    price: price.decimal ? price.legacy : "0",
    priceDecimal: price.decimal,
    stopPrice: stopPrice.decimal ? stopPrice.legacy : "0",
    stopPriceDecimal: stopPrice.decimal,
  };
}

async function signInput(
  input: CreateOrderInput,
  sessionKey: `0x${string}`,
  address: `0x${string}`,
  chainId: number,
) {
  // The EIP-712 types sign every price as uint256 at 1e18, so the exact
  // domain prices are signed as they are.
  const price = input.price || 0n;
  const stopPrice = input.stopPrice || 0n;
  const timestamp = BigInt(Date.now());
  const timeInForce = input.timeInForce || "GTC";

  const takeProfit = input.bracket?.takeProfit;
  const stopLoss = input.bracket?.stopLoss;

  const bracketSignature = input.bracket
    ? await signBracketOrder({
        sessionKey,
        chainId,
        user: address,
        symbol: input.symbol,
        orderType: input.orderType,
        side: input.side,
        quantity: input.quantity,
        price,
        stopPrice,
        reduceOnly: input.reduceOnly || false,
        closePosition: input.closePosition || false,
        timeInForce,
        timestamp,
        takeProfitType: takeProfit?.orderType,
        takeProfitStopPrice: takeProfit?.stopPrice,
        takeProfitPrice: takeProfit?.price,
        stopLossType: stopLoss?.orderType,
        stopLossStopPrice: stopLoss?.stopPrice,
        stopLossPrice: stopLoss?.price,
      })
    : undefined;

  // Bracket orders use the bracket signature as the request authority.
  // If a backend strips the bracket, this signature no longer verifies as
  // a standalone Order signature.
  const signature =
    bracketSignature ??
    (await signOrder({
      sessionKey,
      chainId,
      user: address,
      symbol: input.symbol,
      orderType: input.orderType,
      side: input.side,
      quantity: input.quantity,
      price,
      stopPrice,
      reduceOnly: input.reduceOnly || false,
      closePosition: input.closePosition || false,
      timeInForce,
      timestamp,
    }));

  const replacement = input.replacement
    ? {
        orderId: input.replacement.orderId,
        timestamp: Number(timestamp),
        signature: await signCancel({
          sessionKey,
          chainId,
          user: address,
          orderId: BigInt(input.replacement.orderId),
          timestamp,
        }),
      }
    : undefined;

  return {
    signature,
    bracketSignature,
    timestamp,
    timeInForce,
    replacement,
  };
}

function buildBracketPayload(
  input: CreateOrderInput,
  bracketSignature: string,
) {
  if (!input.bracket || !bracketSignature) return undefined;
  return {
    takeProfit: serializeBracketLeg(input.bracket.takeProfit),
    stopLoss: serializeBracketLeg(input.bracket.stopLoss),
    bracketSignature,
  };
}

export function getSubmitOrderErrorTitle(
  input: CreateOrderInput,
  t: (value: string) => string,
) {
  return t(input.closePosition ? "Close failed" : "Order failed");
}

export function useSubmitOrder() {
  const { t } = useTranslation();
  const address = useActiveAddress();
  const sessionKey = useAuthSession().sessionKey;
  const chainId = useSupportedChainId();

  return useMutation({
    mutationFn: async ({
      input,
      validationFn,
    }: {
      input: CreateOrderInput;
      validationFn?: () => Promise<void>;
    }) => {
      if (!address || !sessionKey) {
        throw new Error("Sign in required");
      }
      if (!chainId) {
        throw new Error(t("Wallet chain is still loading"));
      }

      if (validationFn) {
        await validationFn();
      }

      const isClose = input.closePosition || false;
      const serverRequestId = generateRequestId();

      const {
        signature,
        bracketSignature,
        timestamp,
        timeInForce,
        replacement,
      } = await signInput(
        input,
        sessionKey,
        address,
        chainId,
      );


      const response = await createOrder({
        requestId: serverRequestId,
        user: address,
        symbol: input.symbol,
        orderType: input.orderType,
        side: input.side,
        quantity: input.quantity.toString(),
        ...buildOrderPriceParams(input),
        reduceOnly: input.reduceOnly || false,
        closePosition: isClose,
        timeInForce,
        timestamp: Number(timestamp),
        signature,
        skipRiskEngine: input.skipRiskEngine,
        bracket: bracketSignature
          ? buildBracketPayload(input, bracketSignature)
          : undefined,
        replacement,
      });


      return response;

    },
  });
}

import BN from "bignumber.js";
import type { SystemConfig } from "@/api/tee";
import { PRICE_SCALE } from "@/config/constants";
import {
  calculateAvailableBalance,
  calculatePositionNotional,
  calculatePositionUnrealizedPnL,
  calculateTotalInitialMargin,
  calculateTotalUnrealizedPnL,
  resolvePositionLeverage,
  resolvePositionPrice,
} from "@/lib/margin";
import { getDisplaySymbol } from "@/lib/utils";
import type { CreateOrderInput } from "@/hooks/mutations/useSubmitOrder";
import type { Order, Position, PriceData } from "@/types";
import { fromScaledQuantity } from "@/utils/formatting";
import { calculateEstimatedOrderReserve } from "@/utils/orderSizing";

export interface ReversePositionPreflightInput {
  position: Position;
  positions: Position[];
  pendingOrders: Order[];
  prices: Record<string, PriceData>;
  balance: bigint;
  leveragePreferences?: Record<string, number>;
  teeConfig?: SystemConfig;
  feeRateBps: number;
}

export interface ReversePositionPreflight {
  canReverse: boolean;
  reason?: string;
  postCloseAvailable: bigint;
  openingReserve: bigint;
  closeFee: bigint;
  postCloseBalance: bigint;
}

function absBigInt(value: bigint) {
  return value >= 0n ? value : -value;
}

function applyBps(value: bigint, bps: number) {
  return (value * BigInt(Math.trunc(bps))) / 10_000n;
}

function displayAmountToScaledCeil(value: BN) {
  if (!value.isFinite() || value.lte(0)) return 0n;
  return BigInt(
    value
      .multipliedBy(PRICE_SCALE.toString())
      .decimalPlaces(0, BN.ROUND_CEIL)
      .toFixed(0),
  );
}

function getSymbolConfig(teeConfig: SystemConfig | undefined, symbol: string) {
  const base = getDisplaySymbol(symbol);
  return teeConfig?.symbolConfigs[symbol] ?? teeConfig?.symbolConfigs[base];
}

export function buildReversePositionOrders(
  position: Position,
): { closeInput: CreateOrderInput; openInput: CreateOrderInput } | null {
  if (position.quantity === 0n) return null;

  const quantity = absBigInt(position.quantity);
  const side: CreateOrderInput["side"] =
    position.quantity > 0n ? "SELL" : "BUY";
  const baseInput = {
    symbol: position.symbol,
    orderType: "MARKET" as const,
    side,
    quantity,
    timeInForce: "GTC" as const,
  };

  return {
    closeInput: {
      ...baseInput,
      closePosition: true,
    },
    openInput: {
      ...baseInput,
      reduceOnly: false,
      closePosition: false,
    },
  };
}

export function evaluateReversePositionPreflight({
  position,
  positions,
  pendingOrders,
  prices,
  balance,
  leveragePreferences,
  teeConfig,
  feeRateBps,
}: ReversePositionPreflightInput): ReversePositionPreflight {
  const emptyResult = {
    canReverse: false,
    postCloseAvailable: 0n,
    openingReserve: 0n,
    closeFee: 0n,
    postCloseBalance: balance,
  };

  if (position.quantity === 0n) {
    return { ...emptyResult, reason: "Position size is unavailable" };
  }

  const markPrice = resolvePositionPrice(prices, position.symbol);
  if (!markPrice || markPrice <= 0) {
    return { ...emptyResult, reason: "Latest mark price unavailable" };
  }

  const symbolConfig = getSymbolConfig(teeConfig, position.symbol);
  const leverage = resolvePositionLeverage(
    position.symbol,
    leveragePreferences,
    position.leverage,
    teeConfig,
  );
  if (leverage <= 0) {
    return { ...emptyResult, reason: "Position leverage is unavailable" };
  }

  const closePnl = calculatePositionUnrealizedPnL(position, markPrice);
  const positionNotional = calculatePositionNotional(position, markPrice);
  const closeFee = applyBps(positionNotional, feeRateBps);
  const postCloseBalance = balance + closePnl - closeFee;
  const remainingPositions = positions.filter(
    (item) =>
      getDisplaySymbol(item.symbol) !== getDisplaySymbol(position.symbol),
  );
  const remainingUnrealizedPnl = calculateTotalUnrealizedPnL(
    remainingPositions,
    prices,
  );
  const remainingInitialMargin = calculateTotalInitialMargin(
    remainingPositions,
    pendingOrders,
    prices,
    leveragePreferences,
    teeConfig,
    feeRateBps,
  );
  const postCloseAvailable = calculateAvailableBalance(
    postCloseBalance,
    remainingUnrealizedPnl,
    remainingInitialMargin,
  );

  const displayQuantity = BN(fromScaledQuantity(absBigInt(position.quantity)));
  const openingNotional = displayQuantity.multipliedBy(markPrice);
  const openingReserve = displayAmountToScaledCeil(
    calculateEstimatedOrderReserve(openingNotional, markPrice, leverage, {
      feeRateBps,
      orderType: "MARKET",
      side: position.quantity > 0n ? "SELL" : "BUY",
      markPrice,
      mmBrackets: symbolConfig?.mmBrackets,
      stepSize: symbolConfig?.stepSize,
    }),
  );

  if (postCloseAvailable < openingReserve) {
    return {
      canReverse: false,
      reason: "Insufficient available balance after close to open the reverse position",
      postCloseAvailable,
      openingReserve,
      closeFee,
      postCloseBalance,
    };
  }

  return {
    canReverse: true,
    postCloseAvailable,
    openingReserve,
    closeFee,
    postCloseBalance,
  };
}

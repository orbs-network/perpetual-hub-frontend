import { formatFunding, formatScaled } from "@/components/bottom-tabs/utils";
import {
  resolvePositionLeverage,
  calculatePositionNotional,
  calculatePositionInitialMargin,
  DEFAULT_TRADING_FEE_RATE_BPS,
  resolveFeeRateBps,
} from "@/lib/margin";
import { getDisplaySymbol, calculatePositionPnL, compareSymbols } from "@/lib/utils";
import { usePrice } from "./useBinancePrices";
import { useTeeConfig } from "./useTeeConfig";
import { useAccountSymbolLeverage, useUserAccount } from "./useUserAccount";
import type { Position } from "@/types";
import { useMemo } from "react";
import {
  selectPositionExitOrders,
} from "@/lib/positionExitOrders";
import { useTradeSymbol } from "./useSelectTradeSymbol";

const EMPTY_RESULT = {
  markPrice: undefined as number | undefined,
  isLong: false,
  absQuantity: 0n,
  pnl: null as ReturnType<typeof calculatePositionPnL> | null,
  funding: formatFunding(0n),
  symbolShort: "",
  leverage: 1,
  positionValue: 0,
  marginDisplay: "$0.00",
  raw: undefined,
  takeProfitOrder: undefined,
  stopLossOrder: undefined
};

export function usePosition(position: Position | undefined | null) {
  const userAccount = useUserAccount().data;
  const orders = userAccount?.orders;
  const feeTier = userAccount?.feeTier;

  const priceData = usePrice(position?.symbol);
  const leverageOverride = useAccountSymbolLeverage(
    position?.symbol ?? "",
  ).leverage;

  const { data: teeConfig } = useTeeConfig();
  return useMemo(() => {
    if (!position) {
      return EMPTY_RESULT;
    }

    const markPrice = priceData?.markPrice ?? priceData?.price;
    const isLong = position.quantity > 0n;
    const absQuantity =
      position.quantity > 0n ? position.quantity : -position.quantity;
    const funding = formatFunding(position.accumulatedFunding);
    const symbolShort = getDisplaySymbol(position.symbol);
    const leverage = resolvePositionLeverage(
      position.symbol,
      undefined,
      leverageOverride,
      teeConfig,
    );
    const feeRateBps =
      resolveFeeRateBps(teeConfig, feeTier) ?? DEFAULT_TRADING_FEE_RATE_BPS;
    const pnl = markPrice
      ? calculatePositionPnL(position, markPrice, feeRateBps, leverage)
      : null;

    const positionNotional = calculatePositionNotional(position, markPrice);
    const positionValue = Number(positionNotional) / 1_000_000;
    const initialMargin = calculatePositionInitialMargin(
      position,
      leverage,
      markPrice,
    );
    const marginDisplay = formatScaled(initialMargin);
    const { takeProfitOrder, stopLossOrder } = selectPositionExitOrders(
      orders,
      position.symbol,
    );

    return {
      markPrice,
      isLong,
      absQuantity,
      pnl,
      funding,
      symbolShort,
      leverage,
      positionValue,
      marginDisplay,
      takeProfitOrder,
      stopLossOrder,
      raw: position
    };
  }, [
    feeTier,
    leverageOverride,
    orders,
    position,
    priceData?.markPrice,
    priceData?.price,
    teeConfig,
  ]);
}

export const useCurrentPosition = () => {
  const userAccount = useUserAccount().data;
  const { symbol } = useTradeSymbol();
  const rawPosition = useMemo(
    () =>
      userAccount?.positions.find(
        (p) => compareSymbols(p.symbol, symbol) && p.quantity !== 0n,
      ) ?? null,
    [symbol, userAccount?.positions],
  );

  return usePosition(rawPosition);
};

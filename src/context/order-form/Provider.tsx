import React, { useMemo } from "react";
import { OrderFormContext } from "./Context";
import BN from "bignumber.js";
import { useOrderFormStore } from "../../stores/orderFormStore";
import { usePrice, usePrices } from "@/hooks/useBinancePrices";
import {
  useAccountSymbolLeverage,
  useUserAccount,
} from "@/hooks/useUserAccount";
import { useMarket } from "@/hooks/useMarkets";
import {
  domainPriceToDecimal,
  fromScaledPrice,
  toDomainTickPriceWithTick,
  toScaledQuantity,
} from "@/utils/formatting";
import { useLiveAccountRisk } from "@/hooks/useLiveAccountRisk";
import {
  calculateLiquidationEstimateFromPreview,
  type LiquidationEstimate,
} from "@/lib/liquidation";
import { calculateSideAwareAvailableBalance } from "@/lib/margin";
import { useRiskPreview } from "@/hooks/useRiskPreview";
import {
  calculateReduceOnlyOrderSize,
  calculateStepAlignedOrderSize,
  calculateOrderSizeFromInput,
  getReduceOnlyMaxQuantity,
} from "@/utils/orderSizing";
import type { MarginInfo } from "@/types";
import { useSymbolConfig } from "@/hooks/useSymbolConfig";
import { useTeeConfig } from "@/hooks/useTeeConfig";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";

const EMPTY_PRICES = {};

function useFormMarginInfo() {
  const { marginPercent, uiOrderType, price, side, reduceOnly, sizeValue, sizeUnit, sizeSource } =
    useOrderFormStore();
  const { symbol } = useTradeSymbol();
  const liveRisk = useLiveAccountRisk();
  const { data: userAccount } = useUserAccount();
  const { data: teeConfig } = useTeeConfig();
  const calculationSymbols = useMemo(
    () => [
      symbol,
      ...(userAccount?.positions.map((position) => position.symbol) ?? []),
      ...(userAccount?.orders.map((order) => order.symbol) ?? []),
    ],
    [symbol, userAccount?.positions, userAccount?.orders],
  );
  const { data: calculationPrices = EMPTY_PRICES } =
    usePrices(calculationSymbols);
  const symbolConfig = useSymbolConfig(symbol);
  const { leverage } = useAccountSymbolLeverage(symbol);
  const market = useMarket(symbol);
  const priceData = usePrice(symbol);
  const currentPrice = priceData?.markPrice ?? priceData?.price ?? 0;
  const riskPreview = useRiskPreview(symbol, !reduceOnly);

  return useMemo(() => {
    const rawAvailableBalance = fromScaledPrice(liveRisk.availableBalance);
    const sideAwareAvailableBalance = calculateSideAwareAvailableBalance({
      availableBalance: liveRisk.availableBalance,
      positions: userAccount?.positions ?? [],
      symbol,
      side,
      prices: calculationPrices,
      leveragePreferences: userAccount?.leveragePreferences ?? {},
      teeConfig,
      leverageOverride: leverage,
    });
    const availableBalance = fromScaledPrice(sideAwareAvailableBalance);
    const useStandaloneReserveBudget =
      sideAwareAvailableBalance > liveRisk.availableBalance;

    const reduceOnlyMaxQuantity = getReduceOnlyMaxQuantity(
      userAccount?.positions ?? [],
      symbol,
      side,
    );
    const effectiveReduceOnly = reduceOnly;
    const limitPrice = BN(price || 0);
    const pricePrecision = market?.pricePrecision ?? 2;
    const selectedPriceInput =
      uiOrderType === "LIMIT" && limitPrice.gt(0)
        ? limitPrice
        : BN(currentPrice);
    const selectedOrderPrice = selectedPriceInput.gt(0)
      ? BN(
          domainPriceToDecimal(
            toDomainTickPriceWithTick(
              selectedPriceInput.toFixed(),
              symbolConfig?.tickSize,
              pricePrecision,
            ),
          ),
        )
      : BN(0);
    const orderSizingBrackets =
      symbolConfig?.mmBrackets ??
      riskPreview.data?.mmBrackets?.map((bracket) => ({
        maxNotional: fromScaledPrice(bracket.maxNotional),
        mmrBps: bracket.mmrBps,
      })) ??
      [];
    const feeRateBps = riskPreview.data?.feeRateBps ?? liveRisk.feeRateBps;

    // --- Margin info ---
    const avail = BN(availableBalance);
    const selectedAvailableBalance = avail.multipliedBy(marginPercent).div(100);
    const quantityPrecision = market?.quantityPrecision ?? 8;

    let marginInfo: MarginInfo;

    if (effectiveReduceOnly) {
      const size = calculateReduceOnlyOrderSize({
        maxQuantity: reduceOnlyMaxQuantity,
        marginPercent,
        selectedOrderPrice: selectedOrderPrice.toFixed(),
        quantityPrecision,
      });
      marginInfo = {
        allocated: "0",
        available: availableBalance,
        estimatedOrderReserve: "0",
        required: "0",
        hasEnough: true,
        hasValidQuantity: size.hasValidQuantity,
        derivedQuantity: size.quantity,
        notionalValue: size.notionalValue,
      };
    } else if (
      selectedOrderPrice.lte(0) ||
      leverage <= 0 ||
      feeRateBps === undefined
    ) {
      marginInfo = {
        allocated: selectedAvailableBalance.toFixed(),
        available: availableBalance,
        estimatedOrderReserve: "0",
        required: selectedAvailableBalance.toFixed(),
        hasEnough: selectedAvailableBalance.lte(avail),
        hasValidQuantity: false,
        derivedQuantity: "0",
        notionalValue: "0",
      };
    } else {
      const costOptions = {
        feeRateBps,
        orderType: uiOrderType,
        side,
        markPrice: currentPrice,
        mmBrackets: orderSizingBrackets,
        stepSize: symbolConfig?.stepSize,
        symbol,
        positions: userAccount?.positions ?? [],
        pendingOrders: userAccount?.orders ?? [],
        prices: calculationPrices,
        leveragePreferences: userAccount?.leveragePreferences ?? {},
        teeConfig,
      };

      const useDirectInput = sizeSource === "input" && !!sizeValue;

      const size = useDirectInput
        ? calculateOrderSizeFromInput({
            inputValue: sizeValue,
            sizeUnit,
            availableBalance: rawAvailableBalance,
            sizingAvailableBalance: availableBalance,
            useStandaloneReserveBudget,
            selectedOrderPrice: selectedOrderPrice.toFixed(),
            leverage,
            quantityPrecision,
            ...costOptions,
          })
        : calculateStepAlignedOrderSize({
            availableBalance: rawAvailableBalance,
            sizingAvailableBalance: availableBalance,
            useStandaloneReserveBudget,
            marginPercent,
            selectedOrderPrice: selectedOrderPrice.toFixed(),
            leverage,
            quantityPrecision,
            ...costOptions,
          });

      marginInfo = {
        allocated: size.allocatedMargin,
        available: availableBalance,
        estimatedOrderReserve: size.estimatedOrderReserve,
        required: size.requiredMargin,
        hasEnough: size.hasEnough,
        hasValidQuantity: size.hasValidQuantity,
        notionalValue: size.notionalValue,
        derivedQuantity: size.quantity,
      };
    }

    // --- Liquidation estimate ---
    let liquidationEstimate: LiquidationEstimate | null = null;

    if (
      BN(marginInfo.allocated).gt(0) &&
      leverage > 0 &&
      !effectiveReduceOnly &&
      selectedOrderPrice.gt(0) &&
      riskPreview.data
    ) {
      const orderQuantity = toScaledQuantity(
        marginInfo.derivedQuantity,
        quantityPrecision,
      );
      liquidationEstimate = calculateLiquidationEstimateFromPreview({
        preview: riskPreview.data,
        side,
        orderQuantity,
        orderPrice: selectedOrderPrice.toFixed(),
      });
    }

    return {
      marginInfo,
      liquidationEstimate,
      availableBalance,
      rawAvailableBalance,
      useStandaloneReserveBudget,
      selectedOrderPrice: selectedOrderPrice.toFixed(),
      feeRateBps,
      orderSizingBrackets,
      orderSizingStepSize: symbolConfig?.stepSize,
      orderSizingPrices: calculationPrices,
      orderSizingTeeConfig: teeConfig,
      currentPrice,
      leverage,
      effectiveReduceOnly,
      isLoading: !effectiveReduceOnly && feeRateBps === undefined,
    };
  }, [
    liveRisk.availableBalance,
    liveRisk.feeRateBps,
    userAccount?.positions,
    symbol,
    reduceOnly,
    uiOrderType,
    price,
    currentPrice,
    symbolConfig?.mmBrackets,
    symbolConfig?.stepSize,
    symbolConfig?.tickSize,
    riskPreview.data,
    calculationPrices,
    teeConfig,
    userAccount?.orders,
    userAccount?.leveragePreferences,
    marginPercent,
    sizeValue,
    sizeUnit,
    sizeSource,
    market?.quantityPrecision,
    market?.pricePrecision,
    leverage,
    side,
  ]);
}

function OrderFormProvider({ children }: { children: React.ReactNode }) {
  const marginPayload = useFormMarginInfo();
  const contextValue = useMemo(() => ({ marginPayload }), [marginPayload]);
  return (
    <OrderFormContext.Provider value={contextValue}>
      {children}
    </OrderFormContext.Provider>
  );
}

export default OrderFormProvider;

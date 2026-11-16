import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOrderFormStore } from "../../../stores/orderFormStore";
import { useFormMarginInfo } from "@/hooks/order-form/useFormMarginInfo";
import { useAccountSymbolLeverage, useUserAccount } from "@/hooks/useUserAccount";
import {
  calculateMarginPercentFromSize,
  calculateReduceOnlyPercentFromSize,
  deriveReduceOnlySizeValue,
  deriveSizeValueFromMarginPercent,
  getReduceOnlyMaxQuantity,
} from "@/utils/orderSizing";
import { SizeInput } from "@/components/ui/size-input";
import { useMarket } from "@/hooks/useMarkets";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";

export function OrderSizeInput() {
  const {
    marginPercent,
    setSizeFromInput,
    setSizeFromSlider,
    sizeValue,
    sizeUnit,
    setSizeUnit,
    reduceOnly,
    uiOrderType,
    side,
    sizeSource,
  } = useOrderFormStore();
  const { symbol } = useTradeSymbol();
  const { leverage } = useAccountSymbolLeverage(symbol);
  const { data: userAccount } = useUserAccount();
  const {
    availableBalance,
    rawAvailableBalance,
    useStandaloneReserveBudget,
    selectedOrderPrice,
    currentPrice,
    feeRateBps,
    orderSizingBrackets,
    orderSizingStepSize,
    orderSizingPrices,
    orderSizingTeeConfig,
  } = useFormMarginInfo();
  const precision = useMarket(symbol)?.quantityPrecision ?? 0;

  const baseAsset = useMemo(() => symbol.replace("USDT", ""), [symbol]);
  const reduceOnlyMaxQuantity = useMemo(
    () => getReduceOnlyMaxQuantity(userAccount?.positions ?? [], symbol, side),
    [userAccount?.positions, symbol, side],
  );
  const hasReduceOnlyMax = reduceOnly && reduceOnlyMaxQuantity > 0n;

  const sizingOptions = useMemo(
    () => ({
      feeRateBps,
      orderType: uiOrderType,
      side,
      markPrice: currentPrice,
      mmBrackets: orderSizingBrackets,
      stepSize: orderSizingStepSize,
      symbol,
      positions: userAccount?.positions ?? [],
      pendingOrders: userAccount?.orders ?? [],
      prices: orderSizingPrices,
      leveragePreferences: userAccount?.leveragePreferences ?? {},
      teeConfig: orderSizingTeeConfig,
    }),
    [
      feeRateBps,
      uiOrderType,
      side,
      currentPrice,
      orderSizingBrackets,
      orderSizingStepSize,
      symbol,
      userAccount?.positions,
      userAccount?.orders,
      userAccount?.leveragePreferences,
      orderSizingPrices,
      orderSizingTeeConfig,
    ],
  );

  const deriveReduceOnlyValue = useCallback(
    (pct: number, unit = sizeUnit) =>
      deriveReduceOnlySizeValue({
        marginPercent: pct,
        maxQuantity: reduceOnlyMaxQuantity,
        selectedOrderPrice,
        sizeUnit: unit,
        quantityPrecision: precision,
      }),
    [precision, reduceOnlyMaxQuantity, selectedOrderPrice, sizeUnit],
  );

  const deriveMarginPercentFromInput = useCallback(
    (inputValue: string) =>
      calculateMarginPercentFromSize({
        inputValue,
        sizeUnit,
        selectedOrderPrice: parseFloat(selectedOrderPrice),
        leverage,
        availableBalance: parseFloat(rawAvailableBalance),
        sizingAvailableBalance: availableBalance,
        useStandaloneReserveBudget,
        quantityPrecision: precision,
        ...sizingOptions,
      }),
    [
      sizeUnit,
      selectedOrderPrice,
      leverage,
      rawAvailableBalance,
      availableBalance,
      useStandaloneReserveBudget,
      sizingOptions,
      precision,
    ],
  );

  const deriveValueFromMarginPercent = useCallback(
    (pct: number, unit = sizeUnit) =>
      deriveSizeValueFromMarginPercent({
        availableBalance: rawAvailableBalance,
        sizingAvailableBalance: availableBalance,
        useStandaloneReserveBudget,
        marginPercent: pct,
        selectedOrderPrice,
        leverage,
        quantityPrecision: precision,
        sizeUnit: unit,
        ...sizingOptions,
      }),
    [
      availableBalance,
      rawAvailableBalance,
      useStandaloneReserveBudget,
      selectedOrderPrice,
      leverage,
      precision,
      sizeUnit,
      sizingOptions,
    ],
  );

  const sizeRepriceKey = useMemo(
    () =>
      [
        symbol,
        side,
        uiOrderType,
        sizeUnit,
        selectedOrderPrice,
        leverage,
        rawAvailableBalance,
        availableBalance,
        useStandaloneReserveBudget ? "standalone" : "delta",
        feeRateBps ?? "",
        currentPrice,
        orderSizingStepSize ?? "",
        precision,
      ].join("|"),
    [
      availableBalance,
      currentPrice,
      feeRateBps,
      leverage,
      orderSizingStepSize,
      precision,
      rawAvailableBalance,
      selectedOrderPrice,
      side,
      sizeUnit,
      symbol,
      uiOrderType,
      useStandaloneReserveBudget,
    ],
  );
  const prevSizeRepriceKeyRef = useRef<string | null>(null);
  const prevReduceOnlyRef = useRef(reduceOnly);
  const previousNormalSizeRef = useRef<{
    marginPercent: number;
    sizeValue: string;
  } | null>(null);
  const reduceOnlySizeEditedRef = useRef(false);
  useEffect(() => {
    const previousKey = prevSizeRepriceKeyRef.current;
    prevSizeRepriceKeyRef.current = sizeRepriceKey;
    const sizingContextChanged =
      previousKey !== null && previousKey !== sizeRepriceKey;

    if (
      sizeSource === "slider" &&
      !reduceOnly &&
      marginPercent > 0 &&
      (sizingContextChanged || !sizeValue)
    ) {
      const nextValue = deriveValueFromMarginPercent(marginPercent);
      if (nextValue !== sizeValue) {
        setSizeFromSlider(nextValue, marginPercent);
      }
      return;
    }

    const shouldDeriveSeededInputPercent =
      sizeSource === "input" && !!sizeValue && marginPercent <= 0;
    if (
      (previousKey === null || previousKey === sizeRepriceKey) &&
      !shouldDeriveSeededInputPercent
    ) {
      return;
    }

    if (!sizeValue || reduceOnly || sizeSource !== "input") return;

    const newPct = deriveMarginPercentFromInput(sizeValue);

    if (Math.abs(newPct - marginPercent) > 0.000001) {
      setSizeFromInput(sizeValue, newPct);
    }
  }, [
    availableBalance,
    deriveMarginPercentFromInput,
    deriveValueFromMarginPercent,
    marginPercent,
    reduceOnly,
    setSizeFromInput,
    setSizeFromSlider,
    sizeRepriceKey,
    sizeValue,
    sizeSource,
  ]);

  useEffect(() => {
    const wasReduceOnly = prevReduceOnlyRef.current;
    prevReduceOnlyRef.current = reduceOnly;

    if (!reduceOnly) {
      if (wasReduceOnly) {
        const wasReduceOnlySizeEdited = reduceOnlySizeEditedRef.current;
        reduceOnlySizeEditedRef.current = false;
        const previousNormalSize = previousNormalSizeRef.current;
        previousNormalSizeRef.current = null;
        const previousNormalSizeWasEmpty =
          previousNormalSize &&
          previousNormalSize.sizeValue.trim() === "" &&
          previousNormalSize.marginPercent <= 0;
        const shouldUseEditedReduceOnlySize =
          wasReduceOnlySizeEdited &&
          previousNormalSizeWasEmpty &&
          sizeValue.trim() !== "";

        if (previousNormalSize && !shouldUseEditedReduceOnlySize) {
          if (
            previousNormalSize.sizeValue !== sizeValue ||
            previousNormalSize.marginPercent !== marginPercent
          ) {
            setSizeFromInput(
              previousNormalSize.sizeValue,
              previousNormalSize.marginPercent,
            );
          }
          return;
        }

        const nextPercent = sizeValue
          ? deriveMarginPercentFromInput(sizeValue)
          : 0;
        if (nextPercent !== marginPercent) {
          setSizeFromInput(sizeValue, nextPercent);
        }
      }
      return;
    }

    if (!wasReduceOnly) {
      previousNormalSizeRef.current = { marginPercent, sizeValue };
      reduceOnlySizeEditedRef.current = false;
    }

    if (!hasReduceOnlyMax) {
      if (sizeValue || marginPercent !== 0) {
        setSizeFromInput("", 0);
      }
      return;
    }

    if (sizeSource === "input" && sizeValue && marginPercent <= 0) {
      const pct = calculateReduceOnlyPercentFromSize({
        inputValue: sizeValue,
        sizeUnit,
        selectedOrderPrice: parseFloat(selectedOrderPrice),
        maxQuantity: reduceOnlyMaxQuantity,
      });
      const value = pct >= 100 ? deriveReduceOnlyValue(100) : sizeValue;
      if (value !== sizeValue || pct !== marginPercent) {
        setSizeFromInput(value, pct);
        return;
      }
    }

    const nextPercent = wasReduceOnly
      ? Math.min(Math.max(marginPercent, 0), 100)
      : 100;
    const nextValue = deriveReduceOnlyValue(nextPercent);
    if (nextValue !== sizeValue || nextPercent !== marginPercent) {
      setSizeFromInput(nextValue, nextPercent);
    }
  }, [
    deriveReduceOnlyValue,
    deriveMarginPercentFromInput,
    hasReduceOnlyMax,
    marginPercent,
    reduceOnly,
    reduceOnlyMaxQuantity,
    setSizeFromInput,
    selectedOrderPrice,
    sizeValue,
    sizeSource,
    sizeUnit,
  ]);

  const handleInputChange = useCallback(
    (rawValue: string) => {
      if (!rawValue || rawValue.trim() === "") {
        setSizeFromInput("", 0);
        return;
      }

      if (reduceOnly) {
        reduceOnlySizeEditedRef.current = true;
        const pct = calculateReduceOnlyPercentFromSize({
          inputValue: rawValue,
          sizeUnit,
          selectedOrderPrice: parseFloat(selectedOrderPrice),
          maxQuantity: reduceOnlyMaxQuantity,
        });
        const value = pct >= 100 ? deriveReduceOnlyValue(100) : rawValue;
        setSizeFromInput(value, pct);
        return;
      }

      const pct = deriveMarginPercentFromInput(rawValue);
      setSizeFromInput(rawValue, pct);
    },
    [
      deriveMarginPercentFromInput,
      deriveReduceOnlyValue,
      reduceOnly,
      reduceOnlyMaxQuantity,
      selectedOrderPrice,
      setSizeFromInput,
      sizeUnit,
    ],
  );

  const handlePercentChange = useCallback(
    (pct: number) => {
      if (reduceOnly) {
        reduceOnlySizeEditedRef.current = true;
        const nextPercent = Math.min(Math.max(pct, 0), 100);
        setSizeFromInput(deriveReduceOnlyValue(nextPercent), nextPercent);
        return;
      }

      const value = deriveValueFromMarginPercent(pct);
      setSizeFromSlider(value, pct);
    },
    [
      reduceOnly,
      deriveReduceOnlyValue,
      deriveValueFromMarginPercent,
      setSizeFromInput,
      setSizeFromSlider,
    ],
  );

  const handleUnitChange = useCallback(
    (unit: "asset" | "usd") => {
      setSizeUnit(unit);
      if (reduceOnly) {
        const nextPercent = Math.min(Math.max(marginPercent, 0), 100);
        setSizeFromInput(deriveReduceOnlyValue(nextPercent, unit), nextPercent);
        return;
      }

      const value = deriveValueFromMarginPercent(marginPercent, unit);
      setSizeFromInput(value, marginPercent);
    },
    [
      marginPercent,
      setSizeUnit,
      setSizeFromInput,
      reduceOnly,
      deriveReduceOnlyValue,
      deriveValueFromMarginPercent,
    ],
  );

  return (
    <SizeInput
      decimalScale={precision}
      value={sizeValue}
      percent={marginPercent}
      onPercentChange={handlePercentChange}
      onInputChange={handleInputChange}
      baseAsset={baseAsset}
      sizeUnit={sizeUnit}
      onSizeUnitChange={handleUnitChange}
      counterpartPrice={selectedOrderPrice}
      className="mb-2"
    />
  );
}

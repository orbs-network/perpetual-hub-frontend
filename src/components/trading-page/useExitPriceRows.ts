import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BN from "bignumber.js";
import {
  metricToPrice,
  parseFiniteDecimal,
  priceToMetric,
  type ExitGainLossUnit,
} from "@/utils/tpsl";

type ExitValueSource = "price" | "metric";

type ExitChangeHandler = (price: string, enabled: boolean) => void;

interface ExitPriceLegParams {
  entryPrice: BN;
  quantity: BN;
  isLong: boolean;
  isProfit: boolean;
  pricePrecision: number;
  leverage: number;
  initialPrice: string;
  showExpectedValue: boolean;
  onChange?: ExitChangeHandler;
}

export interface ExitPriceLegState {
  price: string;
  metric: string;
  unit: ExitGainLossUnit;
  source: ExitValueSource;
  expectedUsdc: string;
  onPriceChange: (value: string) => void;
  onMetricChange: (value: string) => void;
  onUnitChange: (unit: ExitGainLossUnit) => void;
}

interface UseExitPriceRowsParams {
  entryPrice: BN;
  quantity: BN;
  isLong: boolean;
  pricePrecision: number;
  leverage: number;
  initialTpPrice: string;
  initialSlPrice: string;
  showExpectedValues: boolean;
  onTpChange?: ExitChangeHandler;
  onSlChange?: ExitChangeHandler;
}

interface UseExitPriceRowsResult {
  takeProfit: ExitPriceLegState;
  stopLoss: ExitPriceLegState;
}

function hasPositivePrice(value: string) {
  const n = parseFiniteDecimal(value);
  return !!n && n.gt(0);
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function useExitPriceLeg({
  entryPrice,
  quantity,
  isLong,
  isProfit,
  pricePrecision,
  leverage,
  initialPrice,
  showExpectedValue,
  onChange,
}: ExitPriceLegParams): ExitPriceLegState {
  const defaultMetric = useMemo(
    () =>
      initialPrice
        ? priceToMetric(
            initialPrice,
            entryPrice,
            quantity,
            "%",
            isLong,
            isProfit,
            leverage,
          )
        : "",
    [entryPrice, initialPrice, isLong, isProfit, leverage, quantity],
  );

  const [price, setPrice] = useState(initialPrice);
  const [metric, setMetric] = useState(defaultMetric);
  const [unit, setUnit] = useState<ExitGainLossUnit>("%");
  const [source, setSource] = useState<ExitValueSource>("price");
  const onChangeRef = useLatestRef(onChange);
  const lastChangeRef = useRef("");

  const emitChange = useCallback(
    (nextPrice: string, enabled: boolean) => {
      const key = `${nextPrice}:${enabled ? "1" : "0"}`;
      if (lastChangeRef.current === key) return;
      lastChangeRef.current = key;
      onChangeRef.current?.(nextPrice, enabled);
    },
    [onChangeRef],
  );

  const displayedPrice = useMemo(
    () =>
      source === "metric"
        ? metricToPrice(
            metric,
            entryPrice,
            quantity,
            unit,
            isLong,
            isProfit,
            pricePrecision,
            leverage,
          )
        : price,
    [
      entryPrice,
      isLong,
      isProfit,
      leverage,
      metric,
      price,
      pricePrecision,
      quantity,
      source,
      unit,
    ],
  );

  const displayedMetric = useMemo(
    () =>
      source === "price"
        ? priceToMetric(
            price,
            entryPrice,
            quantity,
            unit,
            isLong,
            isProfit,
            leverage,
          )
        : metric,
    [
      entryPrice,
      isLong,
      isProfit,
      leverage,
      metric,
      price,
      quantity,
      source,
      unit,
    ],
  );

  useEffect(() => {
    if (source !== "metric") return;
    emitChange(displayedPrice, displayedPrice !== "");
  }, [displayedPrice, emitChange, source]);

  const expectedUsdc = useMemo(
    () =>
      showExpectedValue
        ? priceToMetric(
            displayedPrice,
            entryPrice,
            quantity,
            "USDC",
            isLong,
            isProfit,
            leverage,
          )
        : "",
    [
      displayedPrice,
      entryPrice,
      isLong,
      isProfit,
      leverage,
      quantity,
      showExpectedValue,
    ],
  );

  const onPriceChange = (nextPrice: string) => {
    setSource("price");
    setPrice(nextPrice);
    setMetric(
      priceToMetric(
        nextPrice,
        entryPrice,
        quantity,
        unit,
        isLong,
        isProfit,
        leverage,
      ),
    );
    emitChange(nextPrice, hasPositivePrice(nextPrice));
  };

  const onMetricChange = (nextMetric: string) => {
    setSource("metric");
    setMetric(nextMetric);
    const nextPrice = metricToPrice(
      nextMetric,
      entryPrice,
      quantity,
      unit,
      isLong,
      isProfit,
      pricePrecision,
      leverage,
    );
    emitChange(nextPrice, nextPrice !== "");
  };

  const onUnitChange = (nextUnit: ExitGainLossUnit) => {
    setUnit(nextUnit);
    if (source !== "metric") return;
    setMetric("");
    emitChange("", false);
  };

  return {
    price: displayedPrice,
    metric: displayedMetric,
    unit,
    source,
    expectedUsdc,
    onPriceChange,
    onMetricChange,
    onUnitChange,
  };
}

export function useExitPriceRows({
  entryPrice,
  quantity,
  isLong,
  pricePrecision,
  leverage,
  initialTpPrice,
  initialSlPrice,
  showExpectedValues,
  onTpChange,
  onSlChange,
}: UseExitPriceRowsParams): UseExitPriceRowsResult {
  const entryPriceKey = entryPrice.toString();
  const quantityKey = quantity.toString();
  const calculationEntryPrice = useMemo(() => BN(entryPriceKey), [entryPriceKey]);
  const calculationQuantity = useMemo(() => BN(quantityKey), [quantityKey]);

  const takeProfit = useExitPriceLeg({
    entryPrice: calculationEntryPrice,
    quantity: calculationQuantity,
    isLong,
    isProfit: true,
    pricePrecision,
    leverage,
    initialPrice: initialTpPrice,
    showExpectedValue: showExpectedValues,
    onChange: onTpChange,
  });

  const stopLoss = useExitPriceLeg({
    entryPrice: calculationEntryPrice,
    quantity: calculationQuantity,
    isLong,
    isProfit: false,
    pricePrecision,
    leverage,
    initialPrice: initialSlPrice,
    showExpectedValue: showExpectedValues,
    onChange: onSlChange,
  });

  return { takeProfit, stopLoss };
}

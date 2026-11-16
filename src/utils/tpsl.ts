import BN from "bignumber.js";

export type ExitGainLossUnit = "%" | "USDC";

const INCOMPLETE_DECIMAL_INPUTS = new Set(["", ".", "-", "-.", "+", "+."]);

export function parseFiniteDecimal(value: string): BN | null {
  const normalizedValue = value.trim().replace(/,/g, "");
  if (INCOMPLETE_DECIMAL_INPUTS.has(normalizedValue)) return null;

  try {
    const amount = BN(normalizedValue);
    return amount.isFinite() ? amount : null;
  } catch {
    return null;
  }
}

function priceDiff(price: BN, entry: BN, isLong: boolean, isProfit: boolean): BN {
  return isProfit
    ? (isLong ? price.minus(entry) : entry.minus(price))
    : (isLong ? entry.minus(price) : price.minus(entry));
}

export function priceToMetric(
  priceStr: string,
  entryPrice: BN,
  quantity: BN,
  unit: ExitGainLossUnit,
  isLong: boolean,
  isProfit: boolean,
  leverage = 1,
): string {
  const price = parseFiniteDecimal(priceStr);
  if (!price || price.lte(0) || entryPrice.lte(0)) return "";

  const diff = priceDiff(price, entryPrice, isLong, isProfit);

  if (unit === "%") {
    return diff.div(entryPrice).times(100).times(leverage).toFixed(2);
  }

  if (!quantity.isFinite() || quantity.lte(0)) return "";
  return diff.times(quantity).toFixed(2);
}

export function metricToPrice(
  metricStr: string,
  entryPrice: BN,
  quantity: BN,
  unit: ExitGainLossUnit,
  isLong: boolean,
  isProfit: boolean,
  pricePrecision: number,
  leverage = 1,
): string {
  const metric = parseFiniteDecimal(metricStr);
  if (!metric || metric.isZero() || entryPrice.lte(0)) return "";

  let price: BN;
  if (unit === "%") {
    const factor = metric.div(100).div(leverage);
    price = isProfit
      ? (isLong ? entryPrice.times(BN(1).plus(factor)) : entryPrice.times(BN(1).minus(factor)))
      : (isLong ? entryPrice.times(BN(1).minus(factor)) : entryPrice.times(BN(1).plus(factor)));
  } else {
    if (!quantity.isFinite() || quantity.lte(0)) return "";
    const offset = metric.div(quantity);
    price = isProfit
      ? (isLong ? entryPrice.plus(offset) : entryPrice.minus(offset))
      : (isLong ? entryPrice.minus(offset) : entryPrice.plus(offset));
  }

  return price.gt(0) ? price.toFixed(pricePrecision) : "";
}

export function leverageFromPositionMargin(
  entryPrice: BN,
  quantity: BN,
  margin?: bigint,
): number | undefined {
  if (
    margin === undefined ||
    margin <= 0n ||
    entryPrice.lte(0) ||
    quantity.lte(0)
  ) {
    return undefined;
  }

  const marginValue = BN(margin.toString()).div(1_000_000);
  const notional = entryPrice.times(quantity);
  const leverage = notional.div(marginValue);

  if (!leverage.isFinite() || leverage.lte(0)) return undefined;
  return leverage.toNumber();
}

function positiveFiniteNumber(value?: number): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function resolveTpSlLeverage({
  entryPrice,
  quantity,
  initialMargin,
  allocatedMargin,
  positionLeverage,
  resolvedLeverage,
}: {
  entryPrice: BN;
  quantity: BN;
  initialMargin?: bigint;
  allocatedMargin?: bigint;
  positionLeverage?: number;
  resolvedLeverage?: number;
}): number {
  return (
    leverageFromPositionMargin(entryPrice, quantity, initialMargin) ??
    positiveFiniteNumber(positionLeverage) ??
    positiveFiniteNumber(resolvedLeverage) ??
    leverageFromPositionMargin(entryPrice, quantity, allocatedMargin) ??
    1
  );
}

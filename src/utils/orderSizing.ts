import type { SizeUnit } from '@/stores/orderFormStore';
import BN from 'bignumber.js';
import {
  fromScaledPrice,
  fromScaledQuantity,
  toScaledQuantity,
  toScaledQuantityWithStep,
} from './formatting';
import type { SystemConfig } from '@/api/tee';
import { calculatePendingOrderInitialMargin } from '@/lib/margin';
import type { Order, OrderSide, Position, PriceData } from '@/types';

const BPS_SCALE = BN(10_000);
const DOMAIN_PRICE_SCALE = BN('1000000000000000000');

type OrderSizingOrderType = 'MARKET' | 'LIMIT';
type OrderSizingSide = 'BUY' | 'SELL';

export interface OrderSizingMMBracket {
  maxNotional: string | number;
  mmrBps: number;
}

export interface OrderSizingAccountState {
  symbol?: string;
  positions?: Position[];
  pendingOrders?: Order[];
  prices?: Record<string, PriceData>;
  leveragePreferences?: Record<string, number>;
  teeConfig?: SystemConfig;
}

export interface OrderCostSizingInput extends OrderSizingAccountState {
  feeRateBps?: number;
  orderType?: OrderSizingOrderType;
  side?: OrderSizingSide;
  markPrice?: string | number;
  mmBrackets?: OrderSizingMMBracket[];
  stepSize?: string | number;
}

export interface MarginPercentFromSizeInput extends OrderCostSizingInput {
  inputValue: string | number;
  sizeUnit: SizeUnit;
  selectedOrderPrice: number;
  leverage: number;
  availableBalance: number;
  sizingAvailableBalance?: string | number;
  useStandaloneReserveBudget?: boolean;
  quantityPrecision?: number;
}

function positiveBN(value: string | number | BN | undefined) {
  if (value === undefined || value === '') return BN(0);
  const parsed = BN(value);
  return parsed.isFinite() && parsed.gt(0) ? parsed : BN(0);
}

function validationReservePrice(
  selectedOrderPrice: string | number | BN,
  options: OrderCostSizingInput,
) {
  const selected = positiveBN(selectedOrderPrice);
  if ((options.orderType ?? 'MARKET') !== 'LIMIT') return selected;

  const mark = positiveBN(options.markPrice);
  return mark.isZero() ? selected : mark;
}

function lookupMarketImpactBps(notional: BN, brackets?: OrderSizingMMBracket[]) {
  if (!brackets?.length || !notional.isFinite() || notional.lte(0)) return BN(0);

  for (const bracket of brackets) {
    const maxNotional = positiveBN(bracket.maxNotional);
    if (maxNotional.isZero() || notional.lte(maxNotional)) {
      return positiveBN(bracket.mmrBps);
    }
  }

  return BN(0);
}

function openLossRate(
  notional: BN,
  selectedOrderPrice: string | number | BN,
  options: OrderCostSizingInput,
) {
  const orderType = options.orderType ?? 'MARKET';
  const side = options.side ?? 'BUY';

  if (orderType === 'MARKET') {
    return lookupMarketImpactBps(notional, options.mmBrackets).div(BPS_SCALE);
  }

  const price = positiveBN(selectedOrderPrice);
  const mark = positiveBN(options.markPrice);
  if (price.isZero() || mark.isZero()) return BN(0);

  const gap = side === 'SELL' ? mark.minus(price) : price.minus(mark);
  return gap.gt(0) ? gap.div(price) : BN(0);
}

function displayPriceToDomainPrice(price: BN): bigint {
  if (!price.isFinite() || price.lte(0)) return 0n;
  return BigInt(
    price
      .multipliedBy(DOMAIN_PRICE_SCALE)
      .decimalPlaces(0, BN.ROUND_DOWN)
      .toFixed(0),
  );
}

function toScaledSizingQuantity(
  quantity: BN,
  quantityPrecision: number,
  stepSize?: string | number,
): bigint {
  if (!quantity.isFinite() || quantity.lte(0)) return 0n;
  const floored = quantity.decimalPlaces(
    Math.max(quantityPrecision, 0),
    BN.ROUND_DOWN,
  );
  if (floored.lte(0)) return 0n;
  return toScaledQuantityWithStep(floored.toFixed(), stepSize, quantityPrecision);
}

function withSizingPriceFallback(
  prices: Record<string, PriceData>,
  symbol: string,
  selectedOrderPrice: string | number,
  markPrice?: string | number,
): Record<string, PriceData> {
  const existing = prices[symbol];
  if ((existing?.markPrice && existing.markPrice > 0) || (existing?.price && existing.price > 0)) {
    return prices;
  }

  const fallback = positiveBN(markPrice).isZero()
    ? positiveBN(selectedOrderPrice)
    : positiveBN(markPrice);
  if (fallback.isZero()) return prices;

  return {
    ...prices,
    [symbol]: {
      symbol,
      price: fallback.toNumber(),
      markPrice: fallback.toNumber(),
      priceChangePercent: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
      lastUpdated: 0,
    },
  };
}

export function calculateEstimatedOrderReserve(
  notionalValue: string | number | BN,
  selectedOrderPrice: string | number | BN,
  leverage: number,
  options: OrderCostSizingInput = {},
) {
  const notional = positiveBN(notionalValue);
  const price = positiveBN(selectedOrderPrice);
  const lev = positiveBN(leverage);
  if (notional.isZero() || price.isZero() || lev.isZero()) return BN(0);

  const orderType = options.orderType ?? 'MARKET';
  const feeRate = positiveBN(options.feeRateBps ?? 0).div(BPS_SCALE);
  const impactRate =
    orderType === 'MARKET'
      ? lookupMarketImpactBps(notional, options.mmBrackets).div(BPS_SCALE)
      : BN(0);
  const impactAdjustedNotional = notional.multipliedBy(BN(1).plus(impactRate));
  const exposureIM = impactAdjustedNotional.div(lev);
  const loss = notional.multipliedBy(
    openLossRate(notional, selectedOrderPrice, options),
  );
  const fee = impactAdjustedNotional.multipliedBy(feeRate);

  return exposureIM.plus(loss).plus(fee);
}

function hasAccountOrderIMInputs(options: OrderCostSizingInput): boolean {
  return Boolean(
    options.symbol ||
      options.positions ||
      options.pendingOrders ||
      options.prices ||
      options.leveragePreferences ||
      options.teeConfig,
  );
}

function calculateOrderIMDelta(
  quantity: BN,
  selectedOrderPrice: string | number,
  leverage: number,
  quantityPrecision: number,
  options: OrderCostSizingInput,
): BN | null {
  const symbol = options.symbol;
  if (
    !symbol ||
    !options.teeConfig ||
    !options.prices ||
    options.feeRateBps === undefined ||
    leverage <= 0
  ) {
    return null;
  }

  const price = validationReservePrice(selectedOrderPrice, options);
  const scaledQuantity = toScaledSizingQuantity(
    quantity,
    quantityPrecision,
    options.stepSize,
  );
  if (price.isZero() || scaledQuantity <= 0n) return BN(0);

  const syntheticOrder: Order = {
    orderId: "__sizing_preview__",
    symbol,
    orderType: options.orderType ?? "MARKET",
    side: options.side ?? "BUY",
    quantity: scaledQuantity,
    price: displayPriceToDomainPrice(price),
    stopPrice: 0n,
    reduceOnly: false,
    closePosition: false,
    timeInForce: "GTC",
    timestamp: 0,
    status: "NEW",
  };
  const prices = withSizingPriceFallback(
    options.prices,
    symbol,
    selectedOrderPrice,
    options.markPrice,
  );
  const leveragePreferences = {
    ...(options.leveragePreferences ?? {}),
    [symbol]: leverage,
  };
  const positions = options.positions ?? [];
  const pendingOrders = options.pendingOrders ?? [];
  const feeRateBps = options.feeRateBps;
  const currentOrderIM = calculatePendingOrderInitialMargin(
    positions,
    pendingOrders,
    prices,
    leveragePreferences,
    options.teeConfig,
    feeRateBps,
  );
  const nextOrderIM = calculatePendingOrderInitialMargin(
    positions,
    [...pendingOrders, syntheticOrder],
    prices,
    leveragePreferences,
    options.teeConfig,
    feeRateBps,
  );
  const delta = nextOrderIM > currentOrderIM ? nextOrderIM - currentOrderIM : 0n;
  return BN(fromScaledPrice(delta));
}

function calculateExistingOrderIMForSizing(
  selectedOrderPrice: string | number,
  leverage: number,
  options: OrderCostSizingInput,
): BN | null {
  const symbol = options.symbol;
  if (
    !symbol ||
    !options.teeConfig ||
    !options.prices ||
    options.feeRateBps === undefined ||
    leverage <= 0
  ) {
    return null;
  }

  const prices = withSizingPriceFallback(
    options.prices,
    symbol,
    selectedOrderPrice,
    options.markPrice,
  );
  const leveragePreferences = {
    ...(options.leveragePreferences ?? {}),
    [symbol]: leverage,
  };
  const currentOrderIM = calculatePendingOrderInitialMargin(
    options.positions ?? [],
    options.pendingOrders ?? [],
    prices,
    leveragePreferences,
    options.teeConfig,
    options.feeRateBps,
  );

  return BN(fromScaledPrice(currentOrderIM));
}

function calculateOrderIMDeltaForQuantity(
  quantity: BN,
  selectedOrderPrice: string | number,
  leverage: number,
  quantityPrecision: number,
  options: OrderCostSizingInput,
): BN {
  const orderIMDelta = calculateOrderIMDelta(
    quantity,
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    options,
  );
  if (orderIMDelta) return orderIMDelta;

  if (hasAccountOrderIMInputs(options)) return BN(NaN);

  const reservePrice = validationReservePrice(selectedOrderPrice, options);
  const notional = quantity.multipliedBy(reservePrice);
  return calculateEstimatedOrderReserve(
    notional,
    reservePrice,
    leverage,
    options,
  );
}

function calculateStandaloneReserveForQuantity(
  quantity: BN,
  selectedOrderPrice: string | number,
  leverage: number,
  options: OrderCostSizingInput,
): BN {
  const reservePrice = validationReservePrice(selectedOrderPrice, options);
  const notional = quantity.multipliedBy(reservePrice);
  return calculateEstimatedOrderReserve(
    notional,
    reservePrice,
    leverage,
    options,
  );
}

function calculateBudgetUsageForQuantity(
  quantity: BN,
  selectedOrderPrice: string | number,
  leverage: number,
  quantityPrecision: number,
  options: OrderCostSizingInput,
  useStandaloneReserveBudget = false,
): BN {
  if (useStandaloneReserveBudget) {
    return calculateStandaloneReserveForQuantity(
      quantity,
      selectedOrderPrice,
      leverage,
      options,
    );
  }

  return calculateOrderIMDeltaForQuantity(
    quantity,
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    options,
  );
}

function floorQuantityToStep(
  quantity: BN,
  quantityPrecision: number,
  stepSize?: string | number,
) {
  const scaledQuantity = toScaledQuantityWithStep(
    quantity.decimalPlaces(quantityPrecision, BN.ROUND_DOWN).toFixed(),
    stepSize,
    quantityPrecision,
  );
  return BN(fromScaledQuantity(scaledQuantity));
}

function floorStepForUsd(
  targetUsd: BN,
  price: BN,
  quantityPrecision: number,
  stepSize: string | number | undefined,
): bigint {
  const rawQty = targetUsd.div(price);
  return toScaledQuantityWithStep(
    rawQty.decimalPlaces(quantityPrecision, BN.ROUND_DOWN).toFixed(),
    stepSize,
    quantityPrecision,
  );
}

function quantityStep(quantityPrecision: number, stepSize?: string | number) {
  const configuredStep = positiveBN(stepSize);
  if (configuredStep.gt(0)) return configuredStep;
  return BN(10).pow(-Math.max(quantityPrecision, 0));
}

function reserveRateForImpact(
  impactRate: BN,
  selectedOrderPrice: string | number | BN,
  leverage: number,
  options: OrderCostSizingInput,
) {
  const lev = positiveBN(leverage);
  if (lev.isZero()) return BN(NaN);

  const feeRate = positiveBN(options.feeRateBps ?? 0).div(BPS_SCALE);
  const impactMultiplier = BN(1).plus(impactRate);
  const exposureRate = impactMultiplier.div(lev);
  const lossRate =
    (options.orderType ?? 'MARKET') === 'MARKET'
      ? impactRate
      : openLossRate(BN(1), selectedOrderPrice, options);
  const feeReserveRate = impactMultiplier.multipliedBy(feeRate);

  return exposureRate.plus(lossRate).plus(feeReserveRate);
}

function estimateQuantityForBudget(
  budget: BN,
  selectedOrderPrice: string | number,
  leverage: number,
  options: OrderCostSizingInput,
  quantityPrecision: number,
) {
  if (!budget.isFinite() || budget.lte(0) || leverage <= 0) return BN(0);

  const price = positiveBN(selectedOrderPrice);
  if (price.isZero()) return BN(0);

  const orderType = options.orderType ?? 'MARKET';
  const candidates =
    orderType === 'MARKET' && options.mmBrackets?.length
      ? options.mmBrackets.map((bracket) => ({
          impactRate: positiveBN(bracket.mmrBps).div(BPS_SCALE),
          maxNotional: positiveBN(bracket.maxNotional),
        }))
      : [{ impactRate: BN(0), maxNotional: BN(0) }];

  let bestQuantity = BN(0);
  const reservePrice = validationReservePrice(selectedOrderPrice, options);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.impactRate.toFixed()}-${candidate.maxNotional.toFixed()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const reserveRate = reserveRateForImpact(
      candidate.impactRate,
      reservePrice,
      leverage,
      options,
    );
    if (!reserveRate.isFinite() || reserveRate.lte(0)) continue;

    let notional = budget.div(reserveRate);
    if (candidate.maxNotional.gt(0)) {
      notional = BN.min(notional, candidate.maxNotional);
    }
    const quantity = floorQuantityToStep(
      notional.div(reservePrice),
      quantityPrecision,
      options.stepSize,
    );
    if (quantity.gt(bestQuantity)) {
      bestQuantity = quantity;
    }
  }

  return bestQuantity;
}

function fitQuantityToBudget(
  quantity: BN,
  budget: BN,
  selectedOrderPrice: string | number,
  leverage: number,
  options: OrderCostSizingInput,
  quantityPrecision: number,
  requireStrictlyBelowBudget = false,
  useStandaloneReserveBudget = false,
) {
  const fitted = floorQuantityToStep(quantity, quantityPrecision, options.stepSize);
  if (!fitted.isFinite() || fitted.lte(0)) return BN(0);

  const budgetUsage = calculateBudgetUsageForQuantity(
    fitted,
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    options,
    useStandaloneReserveBudget,
  );
  const fitsBudget = requireStrictlyBelowBudget
    ? budgetUsage.lt(budget)
    : budgetUsage.lte(budget);
  if (fitsBudget) return fitted;
  if (!budgetUsage.isFinite() || budgetUsage.lte(0)) return BN(0);

  const minStep = quantityStep(quantityPrecision, options.stepSize);
  const scaledDown = fitted
    .multipliedBy(budget)
    .div(budgetUsage)
    .multipliedBy('0.999');
  const next = floorQuantityToStep(
    scaledDown.lt(fitted) ? scaledDown : fitted.minus(minStep),
    quantityPrecision,
    options.stepSize,
  );

  if (!next.isFinite() || next.lte(0)) return BN(0);

  const nextBudgetUsage = calculateBudgetUsageForQuantity(
    next,
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    options,
    useStandaloneReserveBudget,
  );
  const nextFitsBudget = requireStrictlyBelowBudget
    ? nextBudgetUsage.lt(budget)
    : nextBudgetUsage.lte(budget);

  return nextFitsBudget ? next : BN(0);
}

function trimTrailingZeros(value: string) {
  if (!value.includes('.')) return value;
  return value.replace(/0+$/, '').replace(/\.$/, '');
}

function formatSizeValue(value: BN, decimals: number) {
  if (!value.isFinite() || value.lte(0)) return '';
  return trimTrailingZeros(
    value.decimalPlaces(decimals, BN.ROUND_DOWN).toFixed(decimals),
  );
}

// Convert a user-entered size into the exact margin-percent representation
// used by the rest of the order form. This must preserve fractional percent
// values; rounding here can collapse valid small orders to 0%.
export function calculateMarginPercentFromSize({
  inputValue,
  sizeUnit,
  selectedOrderPrice,
  leverage,
  availableBalance,
  sizingAvailableBalance,
  useStandaloneReserveBudget = false,
  feeRateBps,
  orderType,
  side,
  markPrice,
  mmBrackets,
  stepSize,
  quantityPrecision = 8,
  ...accountState
}: MarginPercentFromSizeInput): number {
  if (
    BN(inputValue).lte(0) ||
    BN(selectedOrderPrice).lte(0) ||
    leverage <= 0 ||
    BN(sizingAvailableBalance ?? availableBalance).lte(0)
  ) {
    return 0;
  }

  const costOptions = { feeRateBps, orderType, side, markPrice, mmBrackets, stepSize, ...accountState };
  const sizingAvail = positiveBN(sizingAvailableBalance ?? availableBalance);
  let qty: BN;
  if (sizeUnit === 'usd') {
    const scaled = floorStepForUsd(
      BN(inputValue), BN(selectedOrderPrice), quantityPrecision,
      stepSize,
    );
    qty = BN(fromScaledQuantity(scaled));
  } else {
    qty = BN(inputValue);
  }
  const budgetUsage = calculateBudgetUsageForQuantity(
    qty,
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    costOptions,
    useStandaloneReserveBudget,
  );
  const pct = budgetUsage.div(sizingAvail).multipliedBy(100);

  if (!pct.isFinite() || pct.lte(0)) {
    return 0;
  }

  return pct.toNumber();
}

export interface StepAlignedOrderSizeInput extends OrderCostSizingInput {
  availableBalance: string | number;
  sizingAvailableBalance?: string | number;
  useStandaloneReserveBudget?: boolean;
  marginPercent: number;
  selectedOrderPrice: string | number;
  leverage: number;
  quantityPrecision: number;
}

export interface StepAlignedOrderSize {
  allocatedMargin: string;
  requiredMargin: string;
  estimatedOrderReserve: string;
  quantity: string;
  scaledQuantity: bigint;
  notionalValue: string;
  hasEnough: boolean;
  hasValidQuantity: boolean;
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(Math.max(percent, 0), 100);
}

function trimDisplayValue(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

function formatDisplayValue(value: BN, decimals: number): string {
  if (!value.isFinite() || value.lte(0)) return "";
  return trimDisplayValue(value.toFixed(Math.max(decimals, 0), BN.ROUND_DOWN));
}

function absQuantity(quantity: bigint): bigint {
  return quantity >= 0n ? quantity : -quantity;
}

export function getReduceOnlyMaxQuantity(
  positions: Position[],
  symbol: string,
  side: OrderSide,
): bigint {
  const position = positions.find((item) => item.symbol === symbol);
  if (!position || position.quantity === 0n) return 0n;
  if (position.quantity > 0n && side === "SELL") return position.quantity;
  if (position.quantity < 0n && side === "BUY") {
    return absQuantity(position.quantity);
  }
  return 0n;
}

export function calculateReduceOnlyPercentFromSize({
  inputValue,
  sizeUnit,
  selectedOrderPrice,
  maxQuantity,
}: {
  inputValue: string | number;
  sizeUnit: SizeUnit;
  selectedOrderPrice: number;
  maxQuantity: bigint;
}): number {
  const input = BN(inputValue);
  const maxQty = BN(fromScaledQuantity(maxQuantity));
  const price = BN(selectedOrderPrice);
  if (
    input.lte(0) ||
    maxQty.lte(0) ||
    (sizeUnit === "usd" && price.lte(0))
  ) {
    return 0;
  }

  const maxValue = sizeUnit === "usd" ? maxQty.multipliedBy(price) : maxQty;
  if (!maxValue.isFinite() || maxValue.lte(0)) return 0;
  return BN.min(input.div(maxValue).multipliedBy(100), 100).toNumber();
}

export function calculateReduceOnlyOrderSize({
  maxQuantity,
  marginPercent,
  selectedOrderPrice,
  quantityPrecision,
}: {
  maxQuantity: bigint;
  marginPercent: number;
  selectedOrderPrice: string | number;
  quantityPrecision: number;
}): StepAlignedOrderSize {
  const pct = clampPercent(marginPercent);
  const price = BN(selectedOrderPrice);

  if (maxQuantity <= 0n || pct <= 0 || !price.isFinite() || price.lte(0)) {
    return {
      allocatedMargin: "0",
      requiredMargin: "0",
      estimatedOrderReserve: "0",
      quantity: "0",
      scaledQuantity: 0n,
      notionalValue: "0",
      hasEnough: true,
      hasValidQuantity: false,
    };
  }

  const rawScaledQuantity =
    pct >= 100
      ? maxQuantity
      : BigInt(
          BN(maxQuantity.toString())
            .multipliedBy(pct)
            .div(100)
            .decimalPlaces(0, BN.ROUND_DOWN)
            .toFixed(0),
        );
  const scaledQuantity =
    pct >= 100
      ? maxQuantity
      : toScaledQuantity(fromScaledQuantity(rawScaledQuantity), quantityPrecision);
  const quantity = fromScaledQuantity(scaledQuantity);
  const notionalValue = BN(quantity).multipliedBy(price);

  return {
    allocatedMargin: "0",
    requiredMargin: "0",
    estimatedOrderReserve: "0",
    quantity,
    scaledQuantity,
    notionalValue: notionalValue.isFinite() ? notionalValue.toFixed() : "0",
    hasEnough: true,
    hasValidQuantity: scaledQuantity > 0n,
  };
}

export function deriveReduceOnlySizeValue({
  marginPercent,
  maxQuantity,
  selectedOrderPrice,
  sizeUnit,
  quantityPrecision,
}: {
  marginPercent: number;
  maxQuantity: bigint;
  selectedOrderPrice: string | number;
  sizeUnit: SizeUnit;
  quantityPrecision: number;
}): string {
  const size = calculateReduceOnlyOrderSize({
    maxQuantity,
    marginPercent,
    selectedOrderPrice,
    quantityPrecision,
  });
  if (!size.hasValidQuantity) return "";

  const qty = BN(size.quantity);
  if (sizeUnit === "usd") {
    const price = BN(selectedOrderPrice);
    const usdValue = qty.multipliedBy(price);
    return usdValue.gte(1)
      ? formatDisplayValue(usdValue, 2)
      : formatDisplayValue(usdValue, 6);
  }

  return formatDisplayValue(qty, Math.max(quantityPrecision, 8));
}

// The order form displays and submits the same executable quantity. Quantities
// are floored to the market step size because Binance and TEE reject off-grid
// asset amounts.
export function calculateStepAlignedOrderSize({
  availableBalance,
  sizingAvailableBalance,
  useStandaloneReserveBudget = false,
  marginPercent,
  selectedOrderPrice,
  leverage,
  quantityPrecision,
  feeRateBps,
  orderType,
  side,
  markPrice,
  mmBrackets,
  stepSize,
  ...accountState
}: StepAlignedOrderSizeInput): StepAlignedOrderSize {
  const avail = BN(availableBalance);
  const sizingAvail = positiveBN(sizingAvailableBalance ?? availableBalance);
  const price = BN(selectedOrderPrice);
  const clampedPercent = clampPercent(marginPercent);
  const selectedAvailableBalance = sizingAvail
    .multipliedBy(clampedPercent)
    .div(100);

  if (
    !sizingAvail.isFinite() ||
    !price.isFinite() ||
    !selectedAvailableBalance.isFinite() ||
    sizingAvail.lte(0) ||
    price.lte(0) ||
    leverage <= 0 ||
    clampedPercent <= 0
  ) {
    return {
      allocatedMargin: selectedAvailableBalance.isFinite()
        ? selectedAvailableBalance.toFixed()
        : '0',
      requiredMargin: '0',
      estimatedOrderReserve: '0',
      quantity: '0',
      scaledQuantity: 0n,
      notionalValue: '0',
      hasEnough: selectedAvailableBalance.lte(avail),
      hasValidQuantity: false,
    };
  }

  const costOptions = {
    feeRateBps,
    orderType,
    side,
    markPrice,
    mmBrackets,
    stepSize,
    ...accountState,
  };
  const existingOrderIM = calculateExistingOrderIMForSizing(
    selectedOrderPrice,
    leverage,
    costOptions,
  );
  const maxEstimateBudget =
    existingOrderIM?.isFinite() && existingOrderIM.gt(0)
      ? sizingAvail.plus(existingOrderIM)
      : sizingAvail;
  const estimatedMaxQuantity = estimateQuantityForBudget(
    maxEstimateBudget,
    selectedOrderPrice,
    leverage,
    costOptions,
    quantityPrecision,
  );
  const maxQuantity = fitQuantityToBudget(
    estimatedMaxQuantity,
    sizingAvail,
    selectedOrderPrice,
    leverage,
    costOptions,
    quantityPrecision,
    true,
    useStandaloneReserveBudget,
  ).decimalPlaces(quantityPrecision, BN.ROUND_DOWN);
  if (!maxQuantity.isFinite()) {
    return {
      allocatedMargin: selectedAvailableBalance.toFixed(),
      requiredMargin: '0',
      estimatedOrderReserve: '0',
      quantity: '0',
      scaledQuantity: 0n,
      notionalValue: '0',
      hasEnough: selectedAvailableBalance.lte(avail),
      hasValidQuantity: false,
    };
  }
  let rawQuantity: BN;
  if (clampedPercent >= 100) {
    rawQuantity = maxQuantity;
  } else {
    // Estimate quantity directly for the partial budget instead of scaling
    // maxQuantity — the IM function isn't linear so maxQty*pct is inaccurate.
    const partialBudget =
      existingOrderIM?.isFinite() && existingOrderIM.gt(0)
        ? selectedAvailableBalance.plus(existingOrderIM)
        : selectedAvailableBalance;
    const estimatedPartialQuantity = estimateQuantityForBudget(
      partialBudget,
      selectedOrderPrice,
      leverage,
      costOptions,
      quantityPrecision,
    );
    rawQuantity = fitQuantityToBudget(
      estimatedPartialQuantity,
      selectedAvailableBalance,
      selectedOrderPrice,
      leverage,
      costOptions,
      quantityPrecision,
      false,
      useStandaloneReserveBudget,
    ).decimalPlaces(quantityPrecision, BN.ROUND_DOWN);
  }
  const scaledQuantity = toScaledQuantityWithStep(
    rawQuantity.toFixed(),
    stepSize,
    quantityPrecision,
  );
  const quantity = fromScaledQuantity(scaledQuantity);
  const notionalValue = BN(quantity).multipliedBy(price);
  const requiredMargin = notionalValue.div(leverage);
  const budgetUsage = calculateBudgetUsageForQuantity(
    BN(quantity),
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    costOptions,
    useStandaloneReserveBudget,
  );

  return {
    allocatedMargin: selectedAvailableBalance.toFixed(),
    requiredMargin: requiredMargin.toFixed(),
    estimatedOrderReserve: budgetUsage.toFixed(),
    quantity,
    scaledQuantity,
    notionalValue: notionalValue.toFixed(),
    hasEnough: marginPercent <= 100 && budgetUsage.lt(sizingAvail),
    hasValidQuantity: rawQuantity.isFinite() && scaledQuantity > 0n,
  };
}

export interface OrderSizeFromInputParams extends OrderCostSizingInput {
  inputValue: string;
  sizeUnit: SizeUnit;
  availableBalance: string | number;
  sizingAvailableBalance?: string | number;
  useStandaloneReserveBudget?: boolean;
  selectedOrderPrice: string | number;
  leverage: number;
  quantityPrecision: number;
}

/**
 * Compute order size directly from a user-typed value (asset qty or USD),
 * bypassing the lossy marginPercent round-trip.
 *
 * For USD input, floors to the largest step-aligned quantity whose notional
 * does not exceed the typed amount.
 */
export function calculateOrderSizeFromInput({
  inputValue,
  sizeUnit,
  availableBalance,
  sizingAvailableBalance,
  useStandaloneReserveBudget = false,
  selectedOrderPrice,
  leverage,
  quantityPrecision,
  stepSize,
  ...costOptions
}: OrderSizeFromInputParams): StepAlignedOrderSize {
  const sizingAvail = positiveBN(sizingAvailableBalance ?? availableBalance);
  const price = BN(selectedOrderPrice);
  const input = BN(inputValue);

  if (
    !sizingAvail.isFinite() || sizingAvail.lte(0) ||
    !price.isFinite() || price.lte(0) ||
    !input.isFinite() || input.lte(0) ||
    leverage <= 0
  ) {
    return {
      allocatedMargin: '0',
      requiredMargin: '0',
      estimatedOrderReserve: '0',
      quantity: '0',
      scaledQuantity: 0n,
      notionalValue: '0',
      hasEnough: true,
      hasValidQuantity: false,
    };
  }

  let scaledQuantity: bigint;
  if (sizeUnit === 'usd') {
    scaledQuantity = floorStepForUsd(
      input, price, quantityPrecision, stepSize,
    );
  } else {
    scaledQuantity = toScaledQuantityWithStep(
      input.decimalPlaces(quantityPrecision, BN.ROUND_DOWN).toFixed(),
      stepSize,
      quantityPrecision,
    );
  }

  const quantity = fromScaledQuantity(scaledQuantity);
  const notionalValue = BN(quantity).multipliedBy(price);
  const requiredMargin = notionalValue.div(leverage);
  const budgetUsage = calculateBudgetUsageForQuantity(
    BN(quantity),
    selectedOrderPrice,
    leverage,
    quantityPrecision,
    { stepSize, ...costOptions },
    useStandaloneReserveBudget,
  );

  return {
    allocatedMargin: budgetUsage.toFixed(),
    requiredMargin: requiredMargin.toFixed(),
    estimatedOrderReserve: budgetUsage.toFixed(),
    quantity,
    scaledQuantity,
    notionalValue: notionalValue.toFixed(),
    hasEnough: budgetUsage.lt(sizingAvail),
    hasValidQuantity: scaledQuantity > 0n,
  };
}

export interface SizeValueFromMarginPercentInput extends StepAlignedOrderSizeInput {
  sizeUnit: SizeUnit;
}

export function deriveSizeValueFromMarginPercent({
  sizeUnit,
  ...input
}: SizeValueFromMarginPercentInput): string {
  const size = calculateStepAlignedOrderSize(input);
  if (!size.hasValidQuantity) return '';

  if (sizeUnit === 'usd') {
    const usdValue = BN(size.notionalValue);
    return formatSizeValue(usdValue, usdValue.gte(1) ? 2 : 6);
  }

  return formatSizeValue(
    BN(size.quantity),
    Math.min(Math.max(input.quantityPrecision, 0), 8),
  );
}

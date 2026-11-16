import type { SystemConfig } from "@/api/tee";
import { PRICE_SCALE, QUANTITY_SCALE } from "@/config/constants";
import type {
  Order,
  OrderSide,
  Position,
  PriceData,
  RiskConfigResponse,
} from "@/types";
import { safeUpperCase } from "@/lib/utils";
import { toDomainPrice } from "@/utils/formatting";
import BN from "bignumber.js";

export const DEFAULT_POSITION_LEVERAGE = 20;
export const DEFAULT_TRADING_FEE_RATE_BPS = 10;
const BPS_SCALE = 10_000n;
const ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR = 1_000_000_000_000n; // 1e18 -> 1e6

function absBigInt(value: bigint) {
  return value >= 0n ? value : -value;
}

function maxBigInt(value: bigint, floor: bigint) {
  return value > floor ? value : floor;
}

function domainPriceFromMark(markPrice?: number): bigint | undefined {
  if (!markPrice || markPrice <= 0) return undefined;
  return toDomainPrice(markPrice);
}

function resolveScaledMarkPrice(
  position: Position,
  markPrice?: number,
): bigint | undefined {
  // Prefer live Binance mark price. Fall back to the latest backend mark price
  // so display math still works while the websocket is warming up.
  return domainPriceFromMark(markPrice) ?? position.currentPrice;
}

function getPriceData(
  prices: Record<string, PriceData>,
  symbol: string,
): PriceData | undefined {
  const direct = prices[symbol];
  if (direct) return direct;

  const withUsdt = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
  const suffixed = prices[withUsdt];
  if (suffixed) return suffixed;

  const base = symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
  return prices[base];
}

function sameMarketSymbol(left: string, right: string) {
  const normalize = (symbol: string) => {
    const upper = safeUpperCase(symbol);
    return upper.endsWith("USDT") ? upper.slice(0, -4) : upper;
  };
  return normalize(left) === normalize(right);
}

export function resolvePositionPrice(
  prices: Record<string, PriceData>,
  symbol: string,
): number | undefined {
  const priceData = getPriceData(prices, symbol);
  return priceData?.markPrice ?? priceData?.price;
}

export function resolvePositionLeverage(
  symbol: string,
  leveragePreferences?: Record<string, number>,
  leverageOverride?: number,
  teeConfig?: SystemConfig,
) {
  const base = symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
  const symbolConfig =
    teeConfig?.symbolConfigs[symbol] ?? teeConfig?.symbolConfigs[base];
  // Order of truth for display IM: explicit row override, user preference,
  // TEE risk-config default leverage, then a final hardcoded safety fallback.
  const leverage =
    leverageOverride ??
    leveragePreferences?.[symbol] ??
    leveragePreferences?.[base] ??
    symbolConfig?.defaultLeverage ??
    DEFAULT_POSITION_LEVERAGE;

  return leverage > 0 ? leverage : DEFAULT_POSITION_LEVERAGE;
}

export function calculatePositionNotional(
  position: Position,
  markPrice?: number,
) {
  // Notional is always AmountScale: qty(1e8) * price(1e6) / qtyScale(1e8).
  const quantity = absBigInt(position.quantity);
  const price = resolveScaledMarkPrice(position, markPrice) ?? position.entryPrice;

  return (
    (quantity * price) /
    (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR)
  );
}

export function calculatePositionInitialMargin(
  position: Position,
  leverage: number,
  markPrice?: number,
) {
  // Initial margin is the "used margin" contribution for an open position.
  if (leverage <= 0) return 0n;
  return calculatePositionNotional(position, markPrice) / BigInt(leverage);
}

export function calculateTotalPositionInitialMargin(
  positions: Position[],
  prices: Record<string, PriceData>,
  leveragePreferences?: Record<string, number>,
  teeConfig?: SystemConfig,
) {
  return positions.reduce((total, position) => {
    const markPrice = resolvePositionPrice(prices, position.symbol);
    const leverage = resolvePositionLeverage(
      position.symbol,
      leveragePreferences,
      undefined,
      teeConfig,
    );
    return total + calculatePositionInitialMargin(position, leverage, markPrice);
  }, 0n);
}

export function calculateSideAwareAvailableBalance({
  availableBalance,
  positions,
  symbol,
  side,
  prices,
  leveragePreferences,
  teeConfig,
  leverageOverride,
}: {
  availableBalance: bigint;
  positions: Position[];
  symbol: string;
  side: OrderSide;
  prices: Record<string, PriceData>;
  leveragePreferences?: Record<string, number>;
  teeConfig?: SystemConfig;
  leverageOverride?: number;
}) {
  const baseAvailable = maxBigInt(availableBalance, 0n);
  const position = positions.find(
    (item) => sameMarketSymbol(item.symbol, symbol) && item.quantity !== 0n,
  );

  if (!position) return baseAvailable;

  const isOppositeSide =
    (position.quantity > 0n && side === "SELL") ||
    (position.quantity < 0n && side === "BUY");
  if (!isOppositeSide) return baseAvailable;

  const leverage = resolvePositionLeverage(
    position.symbol,
    leveragePreferences,
    leverageOverride,
    teeConfig,
  );
  const markPrice = resolvePositionPrice(prices, position.symbol);
  const positionInitialMargin = calculatePositionInitialMargin(
    position,
    leverage,
    markPrice,
  );

  return baseAvailable + positionInitialMargin * 2n;
}

export function resolveFeeRateBps(
  teeConfig?: { feeTiers?: Array<{ tierLevel: number; totalFeeRateBps?: number }> },
  feeTier = 0,
) {
  const tier = teeConfig?.feeTiers?.find((t) => t.tierLevel === feeTier);
  return tier?.totalFeeRateBps;
}

function isActivePendingOrder(order: Order) {
  return order.status === "NEW" || order.status === "PARTIALLY_FILLED";
}

function shouldReservePendingOrder(order: Order) {
  // Backend display calculations skip reduce-only TP/SL because they can only
  // reduce an existing position and should not consume opening margin.
  return isActivePendingOrder(order) && !order.reduceOnly && order.quantity > 0n;
}

function applyBps(value: bigint, bps: number) {
  return (value * BigInt(bps)) / BPS_SCALE;
}

function displayAmountToAmountScale(value?: string) {
  if (!value) return 0n;
  try {
    return BigInt(
      BN(value)
        .multipliedBy(PRICE_SCALE.toString())
        .decimalPlaces(0, BN.ROUND_DOWN)
        .toFixed(0),
    );
  } catch {
    return 0n;
  }
}

function lookupMarginalMMRBps(
  notional: bigint,
  symbol: string,
  riskConfig?: RiskConfigResponse,
  teeConfig?: SystemConfig,
) {
  const base = symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
  if (notional <= 0n) return 0;

  const riskBrackets =
    riskConfig?.symbols[symbol]?.mmBrackets ??
    riskConfig?.symbols[base]?.mmBrackets;
  for (const bracket of riskBrackets ?? []) {
    const maxNotional = bracket.maxNotional
      ? BigInt(bracket.maxNotional)
      : 0n;
    if (maxNotional === 0n || notional <= maxNotional) {
      return bracket.mmrBps;
    }
  }

  const teeBrackets =
    teeConfig?.symbolConfigs[symbol]?.mmBrackets ??
    teeConfig?.symbolConfigs[base]?.mmBrackets;
  for (const bracket of teeBrackets ?? []) {
    const maxNotional = displayAmountToAmountScale(bracket.maxNotional);
    if (maxNotional === 0n || notional <= maxNotional) {
      return bracket.mmrBps;
    }
  }

  return 0;
}

function resolvePendingOrderBasePrice(
  order: Order,
  prices: Record<string, PriceData>,
) {
  if (order.price > 0n) return order.price;

  // Match backend display behavior: when a pending order has no explicit limit
  // price, use the live mark price as its base display price.
  const markPrice = resolvePositionPrice(prices, order.symbol);
  return domainPriceFromMark(markPrice);
}

function applyMarketOrderImpact(
  order: Order,
  basePrice: bigint,
  riskConfig?: RiskConfigResponse,
  direction: "openLoss" | "worstCaseIM" = "worstCaseIM",
  teeConfig?: SystemConfig,
) {
  if (order.orderType !== "MARKET") return basePrice;

  const orderNotional =
    (order.quantity * basePrice) /
    (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR);
  const impactBps = lookupMarginalMMRBps(
    orderNotional,
    order.symbol,
    riskConfig,
    teeConfig,
  );
  if (impactBps <= 0) return basePrice;

  if (direction === "openLoss" && order.side === "SELL") {
    return (basePrice * (BPS_SCALE - BigInt(impactBps))) / BPS_SCALE;
  }
  return (basePrice * (BPS_SCALE + BigInt(impactBps))) / BPS_SCALE;
}

export function calculatePendingOrderOpenLoss(
  orders: Order[],
  prices: Record<string, PriceData>,
  riskConfig?: RiskConfigResponse,
  teeConfig?: SystemConfig,
) {
  return orders.reduce((total, order) => {
    if (!shouldReservePendingOrder(order)) return total;

    const markPrice = domainPriceFromMark(
      resolvePositionPrice(prices, order.symbol),
    );
    const basePrice = resolvePendingOrderBasePrice(order, prices);
    if (!markPrice || !basePrice) return total;

    // Shared-risk formula: BUY loses if order price is above mark; SELL loses
    // if order price is below mark. Positive gap only.
    const orderPrice = applyMarketOrderImpact(
      order,
      basePrice,
      riskConfig,
      "openLoss",
      teeConfig,
    );
    const priceGap =
      order.side === "SELL" ? markPrice - orderPrice : orderPrice - markPrice;
    if (priceGap <= 0n) return total;

    return (
      total +
      (order.quantity * priceGap) /
        (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR)
    );
  }, 0n);
}

export function calculatePendingOrderInitialMargin(
  positions: Position[],
  orders: Order[],
  prices: Record<string, PriceData>,
  leveragePreferences?: Record<string, number>,
  teeConfig?: SystemConfig,
  feeRateBps = DEFAULT_TRADING_FEE_RATE_BPS,
  riskConfig?: RiskConfigResponse,
) {
  type SymbolOrders = {
    bidOrderValue: bigint;
    askOrderValue: bigint;
  };

  const symbolOrders = new Map<string, SymbolOrders>();
  let totalPendingFees = 0n;

  for (const order of orders) {
    if (!shouldReservePendingOrder(order)) continue;

    const basePrice = resolvePendingOrderBasePrice(order, prices);
    if (!basePrice) continue;

    // Keep domain precision through market impact; convert the notional to
    // AmountScale only after multiplying by quantity.
    const orderPrice = applyMarketOrderImpact(
      order,
      basePrice,
      riskConfig,
      "worstCaseIM",
      teeConfig,
    );
    const orderValue =
      (order.quantity * orderPrice) /
      (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR);
    const existing = symbolOrders.get(order.symbol) ?? {
      bidOrderValue: 0n,
      askOrderValue: 0n,
    };
    if (order.side === "BUY") {
      existing.bidOrderValue += orderValue;
    } else {
      existing.askOrderValue += orderValue;
    }
    symbolOrders.set(order.symbol, existing);
    totalPendingFees += applyBps(orderValue, feeRateBps);
  }

  if (symbolOrders.size === 0) return 0n;

  const openLoss = calculatePendingOrderOpenLoss(
    orders,
    prices,
    riskConfig,
    teeConfig,
  );
  let totalExposureIM = 0n;

  for (const [symbol, orderData] of symbolOrders) {
    const markPrice = domainPriceFromMark(resolvePositionPrice(prices, symbol));
    if (!markPrice) continue;

    const leverage = resolvePositionLeverage(
      symbol,
      leveragePreferences,
      undefined,
      teeConfig,
    );
    let positionNotional = 0n;
    let positionIM = 0n;
    const position = positions.find((p) => p.symbol === symbol);
    if (position && position.quantity !== 0n) {
      positionNotional =
        (position.quantity * markPrice) /
        (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR);
      positionIM = absBigInt(positionNotional) / BigInt(leverage);
    }

    // Worst-case exposure compares the long-side and short-side outcomes for
    // the symbol after active pending orders. Only the extra exposure above
    // current position IM becomes Order IM.
    const buyScenario = absBigInt(positionNotional + orderData.bidOrderValue);
    const sellScenario = absBigInt(
      positionNotional - orderData.askOrderValue,
    );
    const worstCase = buyScenario > sellScenario ? buyScenario : sellScenario;
    const worstCaseIM = worstCase / BigInt(leverage);
    const exposureIM = worstCaseIM - positionIM;
    if (exposureIM > 0n) {
      totalExposureIM += exposureIM;
    }
  }

  return totalExposureIM + openLoss + totalPendingFees;
}

export function calculateTotalInitialMargin(
  positions: Position[],
  orders: Order[],
  prices: Record<string, PriceData>,
  leveragePreferences?: Record<string, number>,
  teeConfig?: SystemConfig,
  feeRateBps = DEFAULT_TRADING_FEE_RATE_BPS,
  riskConfig?: RiskConfigResponse,
) {
  const positionIM = calculateTotalPositionInitialMargin(
    positions,
    prices,
    leveragePreferences,
    teeConfig,
  );
  const orderIM = calculatePendingOrderInitialMargin(
    positions,
    orders,
    prices,
    leveragePreferences,
    teeConfig,
    feeRateBps,
    riskConfig,
  );
  return positionIM + orderIM;
}

export function calculatePositionUnrealizedPnL(
  position: Position,
  markPrice?: number,
) {
  // Long PnL moves with mark-entry; short PnL moves with entry-mark.
  const scaledMarkPrice = resolveScaledMarkPrice(position, markPrice);
  if (!scaledMarkPrice) return 0n;

  const absQuantity = absBigInt(position.quantity);
  const priceDiff =
    position.quantity >= 0n
      ? scaledMarkPrice - position.entryPrice
      : position.entryPrice - scaledMarkPrice;

  return (
    (priceDiff * absQuantity) /
    (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR)
  );
}

export function calculatePositionNetUnrealizedPnL(
  position: Position,
  markPrice: number | undefined,
  feeRateBps: number,
) {
  const grossPnL = calculatePositionUnrealizedPnL(position, markPrice);
  if (feeRateBps <= 0) return grossPnL;

  const openingNotional =
    (position.entryPrice * absBigInt(position.quantity)) /
    (QUANTITY_SCALE * ORDER_PRICE_TO_AMOUNT_PRICE_DIVISOR);
  const openingFee =
    (openingNotional * BigInt(Math.trunc(feeRateBps))) / BPS_SCALE;

  return grossPnL - openingFee;
}

export function calculateTotalUnrealizedPnL(
  positions: Position[],
  prices: Record<string, PriceData>,
) {
  return positions.reduce((total, position) => {
    const markPrice = resolvePositionPrice(prices, position.symbol);
    return total + calculatePositionUnrealizedPnL(position, markPrice);
  }, 0n);
}

export function calculateTotalNetUnrealizedPnL(
  positions: Position[],
  prices: Record<string, PriceData>,
  feeRateBps: number,
) {
  return positions.reduce((total, position) => {
    const markPrice = resolvePositionPrice(prices, position.symbol);
    return total + calculatePositionNetUnrealizedPnL(position, markPrice, feeRateBps);
  }, 0n);
}

export function calculatePositionMaintenanceMargin(
  position: Position,
  markPrice?: number,
) {
  if (!position.lockedMMR || position.lockedMMR <= 0) {
    // Old API responses may not include lockedMMR. In that case the latest
    // backend maintenance margin is a stale fallback, not a live calculation.
    return position.maintenanceMargin ?? 0n;
  }

  // TEE formula: maintenance margin = notional(mark) * lockedMMR / 10000.
  // lockedMMR is fixed when the position opens; notional changes with price.
  const notional = calculatePositionNotional(position, markPrice);
  return (notional * BigInt(position.lockedMMR)) / BPS_SCALE;
}

export function calculateTotalMaintenanceMargin(
  positions: Position[],
  prices: Record<string, PriceData>,
) {
  return positions.reduce((total, position) => {
    const markPrice = resolvePositionPrice(prices, position.symbol);
    return total + calculatePositionMaintenanceMargin(position, markPrice);
  }, 0n);
}

export function calculateMarginBalance(balance: bigint, unrealizedPnL: bigint) {
  return balance + unrealizedPnL;
}

export function calculateAvailableBalance(
  balance: bigint,
  unrealizedPnL: bigint,
  initialMargin: bigint,
) {
  // TEE formula: AB = max(0, balance + min(UPNL, 0) - totalInitialMargin).
  // Positive UPNL does not increase available balance until realized.
  const pnlContribution = unrealizedPnL < 0n ? unrealizedPnL : 0n;
  return maxBigInt(balance + pnlContribution - initialMargin, 0n);
}

export function calculateMarginRatio(
  maintenanceMargin: bigint,
  marginBalance: bigint,
) {
  // Binance-style risk ratio: MM / margin balance. Near 100% means liquidation.
  if (marginBalance <= 0n) {
    return maintenanceMargin > 0n ? Number.POSITIVE_INFINITY : 0;
  }
  return (Number(maintenanceMargin) * 100) / Number(marginBalance);
}

import {
  DEFAULT_TRADE_SYMBOL,
  QUANTITY_SCALE,
  PRICE_SCALE,
  DOMAIN_PRICE_SCALE,
} from "@/config/constants";
import type {
  AccountSummary,
  GetUserResponse,
  Order,
  OrderResponse,
  PendingWithdrawal,
  PendingWithdrawalResponse,
  Position,
  PositionResponse,
} from "@/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MarketInfo } from "@/api/markets";
import { formatNumber, toDomainPrice } from "@/utils/formatting";
import { safeUpperCase } from "@/lib/string";

export { safeUpperCase } from "@/lib/string";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_QUOTE_ASSET = "USDT";
const KNOWN_QUOTE_SUFFIXES = ["USDT", "USDC"] as const;

function normalizeSymbolValue(symbol: string | undefined) {
  return safeUpperCase((symbol ?? "").trim().replace(/['"]/g, ""));
}



export function getDisplaySymbol(symbol: string): string {
  return normalizeSymbolValue(symbol).replace(/(?:USDT|USDC)$/, "");
}



export const getSymbolWithoutQuoteAsset = (symbol: string): string => {
  const displaySymbol = getDisplaySymbol(symbol);
  const quoteAsset = symbol.replace(displaySymbol, "");
  return `${displaySymbol}-${quoteAsset}`;
}



export const compareSymbols = (symbol1?: string, symbol2?: string) => {
  return getDisplaySymbol(symbol1 ?? "") === getDisplaySymbol(symbol2 ?? "");
}

export const getMarketFromMarketsList = (markets?: MarketInfo[], symbol?: string) => {
  return markets?.find(
    (market) => compareSymbols(market.symbol, symbol),
  );
};

export function routeSlugToSymbol(slug: string | undefined) {
  const normalized = normalizeSymbolValue(slug || DEFAULT_TRADE_SYMBOL);
  if (KNOWN_QUOTE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return normalized;
  }

  return `${normalized}${DEFAULT_QUOTE_ASSET}`;
}

export const normalizeSymbol = normalizeSymbolValue;

// Calculate PnL for a position given the current market price
export function calculatePositionPnL(
  position: Position,
  markPrice: number,
  feeRateBps = 0,
  leverage = 1,
) {
  const isLong = position.quantity > 0n;
  const absQuantity =
    position.quantity > 0n ? position.quantity : -position.quantity;

  const scaledMarkPrice = toDomainPrice(markPrice);
  const priceToAmountDivisor = DOMAIN_PRICE_SCALE / PRICE_SCALE;
  const notionalAtEntry =
    (position.entryPrice * absQuantity) /
    (QUANTITY_SCALE * priceToAmountDivisor);

  let pnl: bigint;
  if (isLong) {
    pnl =
      ((scaledMarkPrice - position.entryPrice) * absQuantity) /
      (QUANTITY_SCALE * priceToAmountDivisor);
  } else {
    pnl =
      ((position.entryPrice - scaledMarkPrice) * absQuantity) /
      (QUANTITY_SCALE * priceToAmountDivisor);
  }
  if (feeRateBps > 0) {
    pnl -= (notionalAtEntry * BigInt(Math.trunc(feeRateBps))) / 10_000n;
  }

  const isPositive = pnl >= 0n;
  const absPnl = pnl >= 0n ? pnl : -pnl;

  const pnlNumber = Number(absPnl) / 1_000_000;

  // Calculate ROE percentage: pnl / initial margin at entry * 100.
  const leverageInt = Math.trunc(leverage);
  const roeBasis =
    leverageInt > 0 ? notionalAtEntry / BigInt(leverageInt) : notionalAtEntry;
  let pctStr = "";
  if (roeBasis > 0n) {
    const pctValue = (Number(pnl) * 100) / Number(roeBasis);
    pctStr = ` (${pctValue >= 0 ? "+" : ""}${pctValue.toFixed(2)}%)`;
  }

  const formatted = `${isPositive ? "+" : "-"}${formatNumber(pnlNumber, { decimalScale: 2, prefix: "$" })}`;

  return { value: pnl, formatted, isPositive, pctStr };
}

export function parseAccountSummary(data: GetUserResponse): AccountSummary {
  const balance = BigInt(data.user.balance); // 1e6 (USDC scale)
  const marginUsed = BigInt(data.marginUsed); // 1e6
  const unrealizedPnL = BigInt(data.unrealizedPnl); // 1e6 (backend already scales correctly)
  const maintenanceMargin = data.maintenanceMargin
    ? BigInt(data.maintenanceMargin)
    : undefined;
  const marginBalance = data.marginBalance
    ? BigInt(data.marginBalance)
    : undefined;

  // Backend computes availableBalance = balance + unrealizedPnL - marginUsed (all 1e6)
  const availableBalance = BigInt(data.availableBalance);

  return {
    balance,
    availableBalance,
    marginUsed,
    maintenanceMargin,
    marginBalance,
    unrealizedPnL,
    pendingWithdrawals: (data.pendingWithdrawals ?? []).map(
      parsePendingWithdrawalResponse,
    ),
  };
}

export function parsePendingWithdrawalResponse(
  res: PendingWithdrawalResponse,
): PendingWithdrawal {
  return {
    withdrawalId: res.withdrawalId,
    recipient: res.recipient,
    amount: BigInt(res.amount),
    requestedAt: res.requestedAt,
    availableAt: res.availableAt,
  };
}

export function parseOrderResponse(res: OrderResponse): Order {
  return {
    orderId: res.orderId,
    symbol: res.symbol,
    orderType: res.orderType,
    side: res.side,
    quantity: BigInt(res.quantity),
    price: BigInt(res.price || "0"),
    stopPrice: BigInt(res.stopPrice || "0"),
    reduceOnly: res.reduceOnly,
    closePosition: res.closePosition,
    timeInForce: res.timeInForce,
    timestamp: res.timestamp,
    status: res.status,
    executionStatus: res.executionStatus,
    parentOrderId: res.parentOrderId,
    bracketGroupId: res.bracketGroupId,
    attachedRole: res.attachedRole,
  };
}

// Position prices keep the backend/TEE domain scale (1e18). Monetary amounts
// such as balance, margin and PnL remain at the USDC scale (1e6).
export function parsePositionResponse(res: PositionResponse): Position {
  const entryPrice = BigInt(res.entryPrice || "0");
  const currentPrice = res.markPrice
    ? BigInt(res.markPrice)
    : undefined;
  const liquidationPrice = res.liquidationPrice
    ? BigInt(res.liquidationPrice)
    : undefined;
  const maintenanceMargin = res.maintenanceMargin
    ? BigInt(res.maintenanceMargin)
    : undefined;
  const initialMargin = res.initialMargin
    ? BigInt(res.initialMargin)
    : undefined;

  return {
    symbol: res.symbol,
    quantity: BigInt(res.quantity),
    entryPrice,
    liquidationPrice,
    maintenanceMargin,
    initialMargin,
    lockedMMR: res.lockedMMR,
    accumulatedFunding: BigInt(res.accumulatedFunding || "0"),
    openTimestamp: res.openTimestamp,
    allocatedMargin: res.allocatedMargin
      ? BigInt(res.allocatedMargin)
      : undefined,
    leverage: res.leverage || undefined,
    currentPrice,
  };
}

function getErrorMessageParts(error: unknown) {
  if (!(error instanceof Error)) {
    return [String(error)];
  }

  const messageParts = [
    error.message,
    (error as { shortMessage?: string }).shortMessage,
    (error as { details?: string }).details,
  ].filter(Boolean);

  return messageParts;
}

export function isWalletAuthorizationError(error: unknown) {
  const normalizedMessage = getErrorMessageParts(error).join(" ").toLowerCase();
  return (
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("unauthorizedprovidererror")
  );
}

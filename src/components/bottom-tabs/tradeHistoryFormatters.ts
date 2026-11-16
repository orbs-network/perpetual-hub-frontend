import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { QUANTITY_SCALE } from "@/config/constants";
import { safeUpperCase } from "@/lib/utils";
import type { TradeItem } from "@/types";
import {
  amountScaleToDisplayNumber,
  domainPriceToBigInt,
  formatNumber,
  formatTimestamp,
  formatUSD,
} from "@/utils/formatting";

export function parseTradeScaled(value: string | undefined) {
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

export function formatTradeTime(timestamp: number) {
  return formatTimestamp(timestamp);
}

export function getTradeDirection(trade: TradeItem) {
  const side = safeUpperCase(trade.side);
  const isBuy = side === "BUY";
  const isSell = side === "SELL";
  if (trade.isClose) {
    return {
      label: isBuy ? "Close Short" : isSell ? "Close Long" : "Close",
      className: isBuy ? "text-up" : isSell ? "text-down" : "text-content",
    };
  }

  return {
    label: isBuy ? "Open Long" : isSell ? "Open Short" : "-",
    className: isBuy ? "text-up" : isSell ? "text-down" : "text-content",
  };
}

export function formatScaledUsdc(value: bigint | undefined) {
  if (value === undefined) return "-";
  return `${formatUSD(amountScaleToDisplayNumber(value))} ${getCollateralSymbol()}`;
}

export function getTradeClosedPnl(trade: TradeItem) {
  const realizedPnl = parseTradeScaled(trade.realizedPnl);
  const fee = parseTradeScaled(trade.fee);
  if (trade.isClose) {
    if (realizedPnl === undefined || fee === undefined) return realizedPnl;
    return realizedPnl - fee;
  }

  if (realizedPnl !== undefined && realizedPnl !== 0n) {
    return realizedPnl;
  }

  return fee === undefined ? realizedPnl : -fee;
}

export function formatTradeClosedPnl(trade: TradeItem) {
  return formatScaledUsdc(getTradeClosedPnl(trade));
}

export function getTradeValue(trade: TradeItem) {
  const quantity = parseTradeScaled(trade.quantity);
  const price = domainPriceToBigInt(trade.price);
  if (!quantity || price <= 0n) return undefined;
  return (quantity * price) / (QUANTITY_SCALE * 1_000_000_000_000n);
}

export function formatTradeValue(trade: TradeItem) {
  return formatScaledUsdc(getTradeValue(trade));
}

export function formatTradePrice(trade: TradeItem) {
  const price = domainPriceToBigInt(trade.price);
  if (price <= 0n) return "-";
  return formatNumber(price, { scaled: "domainPrice", decimalScale: 8 });
}

export function formatTradeQuantity(trade: TradeItem) {
  const quantity = parseTradeScaled(trade.quantity);
  if (!quantity) return "-";
  return formatNumber(quantity, { scaled: "quantity", decimalScale: 8 });
}

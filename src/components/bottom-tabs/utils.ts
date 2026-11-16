import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { PRICE_SCALE, QUANTITY_SCALE, USDC_DECIMALS } from "@/config/constants";
import { safeUpperCase } from "@/lib/utils";
import type { Order } from "@/types";
import {
  amountScaleToDisplayNumber,
  domainPriceToBigInt,
  formatNumber,
  formatUSD,
} from "@/utils/formatting";

// --- Badge color helpers ---


export const TABLE_HEADER_ROW_CLASS =
  "sticky top-0 z-10 h-[30px] border-b border-edge/60 bg-surface/95 backdrop-blur hover:!bg-surface/95 [&_th]:text-[12px] [&_th]:text-content-secondary";

export function getOrderValue(order: Order) {
  const price = domainPriceToBigInt(order.price);
  if (price <= 0n) return 0n;
  return (order.quantity * price) / (QUANTITY_SCALE * 1_000_000_000_000n);
}

export function getTriggerConditionDirection(
  order: Pick<Order, "orderType" | "side">,
): "above" | "below" {
  const isBuy = order.side === "BUY";
  const type = safeUpperCase(order.orderType);

  if (type.startsWith("TAKE_PROFIT")) {
    return isBuy ? "below" : "above";
  }

  return isBuy ? "above" : "below";
}

export function formatUsdcAmount(value: bigint | undefined) {
  if (value === undefined) return "--";
  return `${formatUSD(amountScaleToDisplayNumber(value))} ${getCollateralSymbol()}`;
}

function formatAmountScaleWithFullPrecision(
  value: bigint,
  minimumFractionDigits = 0,
) {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = abs / PRICE_SCALE;
  const fraction = abs % PRICE_SCALE;
  const wholeText = whole.toLocaleString("en-US");
  let fractionText = fraction
    .toString()
    .padStart(USDC_DECIMALS, "0")
    .replace(/0+$/, "");
  if (minimumFractionDigits > 0) {
    fractionText = fractionText.padEnd(minimumFractionDigits, "0");
  }

  return `${sign}${wholeText}${fractionText ? `.${fractionText}` : ""}`;
}

export function formatFundingPaymentAmount(value: bigint | undefined) {
  if (value === undefined) return "--";
  if (value >= PRICE_SCALE / 100n || value <= -(PRICE_SCALE / 100n)) {
    return formatUsdcAmount(value);
  }
  return `${formatAmountScaleWithFullPrecision(value, 4)} ${getCollateralSymbol()}`;
}

export function getTransactionTypeBadgeClass(type: string) {
  return getOperationTypeBadgeClass(type);
}

export function getOperationTypeBadgeClass(type: string) {
  const upper = safeUpperCase(type);
  if (upper.includes("LIQUIDAT")) return "bg-down/20 text-down";
  if (upper.includes("DEPOSIT")) return "bg-up/20 text-up";
  if (upper.includes("WITHDRAW")) return "bg-warning/20 text-warning";
  return "bg-accent-primary/20 text-accent-primary";
}

export function getTransactionStatusBadgeClass(status: string) {
  const upper = safeUpperCase(status);
  if (upper === "CONFIRMED" || upper === "SUCCESS" || upper === "COMPLETED")
    return "bg-up/20 text-up";
  if (upper === "PENDING" || upper === "SUBMITTED")
    return "bg-warning/20 text-warning";
  if (upper === "FAILED" || upper === "REJECTED")
    return "bg-down/20 text-down";
  return "bg-badge-bg text-content-muted";
}

const FRIENDLY_TYPE_LABELS: Record<string, string> = {
  MARKET: "Market",
  LIMIT: "Limit",
  STOP: "Stop Limit",
  STOP_MARKET: "Stop Market",
  STOP_LOSS: "Stop Loss",
  STOP_LOSS_LIMIT: "Stop Loss Limit",
  TAKE_PROFIT: "Take Profit Limit",
  TAKE_PROFIT_MARKET: "Take Profit Market",
  TAKE_PROFIT_LIMIT: "Take Profit Limit",
  CREATE_ORDER: "Create Order",
  PLACE_ORDER: "Place Order",
  UPDATE_ORDER: "Update Order",
  EDIT_ORDER: "Edit Order",
  CANCEL_ORDER: "Cancel Order",
  FILL_ORDER: "Fill Order",
  CLOSE_POSITION: "Close Position",
  LIQUIDATE: "Liquidation",
  LIQUIDATION: "Liquidation",
  FUNDING: "Funding",
  FUNDING_RATE: "Funding",
  DEPOSIT: "Deposit",
  WITHDRAW: "Withdraw",
  WITHDRAWAL: "Withdrawal",
  ADD_MARGIN: "Add Margin",
  REMOVE_MARGIN: "Remove Margin",
  SET_LEVERAGE: "Set Leverage",
};

function formatFriendlyEnumLabel(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "-";

  const key = safeUpperCase(raw);
  const knownLabel = FRIENDLY_TYPE_LABELS[key];
  if (knownLabel) return knownLabel;

  return raw
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatOrderTypeLabel(type: string | null | undefined) {
  return formatFriendlyEnumLabel(type);
}

export function formatOperationTypeLabel(type: string | null | undefined) {
  return formatFriendlyEnumLabel(type);
}

export function isFundingOperation(type: string | null | undefined) {
  const upper = safeUpperCase(type?.trim());
  return upper === "FUNDING" || upper === "FUNDING_RATE";
}

export function getFundingDirectionFromAmount(
  amount: string | number | bigint | null | undefined,
) {
  if (amount === null || amount === undefined || amount === "") return null;
  try {
    const value = BigInt(String(amount).trim());
    if (value > 0n) return "PAY";
    if (value < 0n) return "RECEIVE";
    return null;
  } catch {
    const value = Number(amount);
    if (value > 0) return "PAY";
    if (value < 0) return "RECEIVE";
    return null;
  }
}

export function absoluteRawAmount(
  amount: string | number | bigint | null | undefined,
) {
  if (amount === null || amount === undefined || amount === "") return "";
  try {
    const value = BigInt(String(amount).trim());
    return (value < 0n ? -value : value).toString();
  } catch {
    const raw = String(amount).trim();
    return raw.startsWith("-") ? raw.slice(1) : raw;
  }
}

export function getOrderHistorySideBadge(
  side: string | null | undefined,
  operationType: string | null | undefined,
  amount: string | number | bigint | null | undefined,
) {
  const rawSide = safeUpperCase(side?.trim());

  if (isFundingOperation(operationType)) {
    const direction =
      getFundingDirectionFromAmount(amount) ??
      (rawSide === "PAY" || rawSide === "RECEIVE" ? rawSide : null);

    if (direction === "PAY") {
      return { label: "Pay", className: "text-down" };
    }
    if (direction === "RECEIVE") {
      return { label: "Receive", className: "bg-up/20 text-up" };
    }
    return { label: "-", className: "bg-raised text-content-muted" };
  }

  if (rawSide === "BUY") {
    return { label: "Buy", className: "bg-up/20 text-up" };
  }
  if (rawSide === "SELL") {
    return { label: "Sell", className: "bg-down/20 text-down" };
  }
  return { label: rawSide || "-", className: "bg-raised text-content-muted" };
}


// --- Formatting helpers ---

export function formatUsd(value: number, decimals = 2) {
  return `${formatNumber(value, { decimalScale: decimals})}`;
}

export function formatScaled(raw: bigint | undefined, scale = 1_000_000, decimals = 2) {
  if (!raw) return "-";
  const value = Number(raw) / scale;
  return formatUsd(value, decimals);
}

export function getFundingDisplayAmount(accumulatedFunding: bigint) {
  return -accumulatedFunding;
}

export function formatFunding(accumulatedFunding: bigint) {
  const displayAmount = getFundingDisplayAmount(accumulatedFunding);
  const value = Number(displayAmount) / 1_000_000;
  const hasFunding = displayAmount !== 0n;
  return {
    value,
    hasFunding,
    formatted: hasFunding
      ? `${value > 0 ? "+" : "-"}$${formatUsd(Math.abs(value))}`
      : "$0.00",
    colorClass: !hasFunding
      ? "text-content-secondary"
      : value > 0
        ? "text-up"
        : "text-down",
  };
}

export function computeOrderDistance(currentPrice: number, triggerPrice: number) {
  if (!currentPrice || !triggerPrice) return null;
  const distance = ((currentPrice - triggerPrice) / currentPrice) * 100;
  const absDistance = Math.abs(distance);
  const colorClass =
    absDistance < 1
      ? "text-warning"
      : absDistance < 5
        ? "text-content-secondary"
        : "text-content-muted";
  return { distance, colorClass };
}

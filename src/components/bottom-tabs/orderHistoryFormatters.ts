import { QUANTITY_SCALE } from "@/config/constants";
import { safeUpperCase } from "@/lib/utils";
import type { OrderHistoryItem } from "@/types";
import {
  domainPriceToBigInt,
  formatTimestamp,
} from "@/utils/formatting";
import {
  absoluteRawAmount,
  formatOperationTypeLabel,
  getOrderHistorySideBadge,
  isFundingOperation,
} from "./utils";

export function parseHistoryScaled(value: string | undefined) {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function formatHistoryTime(timestamp: number) {
  return formatTimestamp(timestamp);
}

interface OrderHistoryMetadata {
  sourceOrderType?: string;
  orderType?: string;
  stopPrice?: string;
  orderStatus?: string;
  reduceOnly?: boolean;
  closePosition?: boolean;
}

function parseOrderHistoryMetadata(order: OrderHistoryItem) {
  if (!order.extraData) {
    return null;
  }
  try {
    const parsed = JSON.parse(order.extraData) as OrderHistoryMetadata;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getEffectiveHistoryOperation(order: OrderHistoryItem) {
  const operation = safeUpperCase(order.operationType);
  const metadata = parseOrderHistoryMetadata(order);

  if (
    operation === "FILL_ORDER" ||
    operation === "CREATE_LIMIT_ORDER" ||
    operation === "CREATE_STOP_ORDER" ||
    operation === "CANCEL_ORDER"
  ) {
    const sourceOrderType = metadata?.sourceOrderType || metadata?.orderType;
    return safeUpperCase(sourceOrderType) || operation;
  }

  return operation;
}

export function getHistoryType(order: OrderHistoryItem) {
  const operation = getEffectiveHistoryOperation(order);
  if (isFundingOperation(operation)) return "Funding";
  if (operation === "LIQUIDATION") return "Liquidation";
  // Check operation type before price: filled market orders carry a non-zero
  // fill price, so testing price first would misclassify them as "Limit".
  if (
    operation === "OPEN_POSITION" ||
    operation === "CLOSE_POSITION" ||
    operation === "FILL_ORDER"
  ) {
    return "Market";
  }
  if (operation === "TAKE_PROFIT_LIMIT") return "Take Profit Limit";
  if (operation === "STOP_LOSS_LIMIT") return "Stop Loss Limit";
  if (operation === "TAKE_PROFIT" || operation === "TAKE_PROFIT_MARKET") return "Take Profit";
  if (operation === "STOP" || operation === "STOP_MARKET" || operation === "STOP_LOSS") return "Stop Loss";
  if (operation === "CREATE_LIMIT_ORDER") return "Limit";
  if (operation === "CREATE_STOP_ORDER") return "Stop";
  if (operation === "CANCEL_ORDER") return "Cancel Order";
  if (order.price && parseHistoryScaled(order.price) > 0n) return "Limit";
  return formatOperationTypeLabel(operation);
}

export function getHistoryDirection(order: OrderHistoryItem) {
  const operation = getEffectiveHistoryOperation(order);
  const sideBadge = getOrderHistorySideBadge(
    order.side,
    operation,
    order.amount,
  );
  const side = safeUpperCase(order.side);
  const metadata = parseOrderHistoryMetadata(order);
  const isClose =
    operation === "CLOSE_POSITION" ||
    operation === "LIQUIDATION" ||
    Boolean(metadata?.reduceOnly || metadata?.closePosition) ||
    operation.includes("CLOSE") ||
    operation.includes("TAKE_PROFIT") ||
    operation.includes("STOP");

  if (sideBadge.label === "Pay" || sideBadge.label === "Receive") {
    return {
      label: sideBadge.label,
      className: sideBadge.label === "Pay" ? "text-down" : "text-up",
    };
  }
  if (side === "BUY") {
    return {
      label: isClose ? "Close Short" : "Buy Long",
      className: "text-up",
    };
  }
  if (side === "SELL") {
    return {
      label: isClose ? "Close Long" : "Short",
      className: "text-down",
    };
  }
  return { label: "--", className: "text-content" };
}

export function isFilledStatus(status: string | undefined) {
  const upper = safeUpperCase(status);
  return upper === "SUCCESS" || upper === "FILLED" || upper === "CONFIRMED";
}

export function formatStatus(status: string | undefined) {
  const upper = safeUpperCase(status);
  if (!upper) return "--";
  if (upper === "SUCCESS" || upper === "FILLED" || upper === "CONFIRMED")
    return "Filled";
  if (upper === "NEW" || upper === "PENDING" || upper === "PENDING_ACTIVATION")
    return "Open";
  if (upper === "CANCELED" || upper === "CANCELLED") return "Canceled";
  if (upper === "REJECTED") return "Rejected";
  return status ?? "--";
}

export function getHistoryStatus(order: OrderHistoryItem) {
  const operation = safeUpperCase(order.operationType);
  const metadata = parseOrderHistoryMetadata(order);
  if (operation === "CANCEL_ORDER" && safeUpperCase(order.status) === "SUCCESS") {
    return "Canceled";
  }
  if (
    (operation === "CREATE_LIMIT_ORDER" || operation === "CREATE_STOP_ORDER") &&
    safeUpperCase(order.status) === "SUCCESS"
  ) {
    return formatStatus(metadata?.orderStatus || "NEW");
  }
  return formatStatus(order.status);
}

export function getOrderHistoryValue(order: OrderHistoryItem) {
  if (isFundingOperation(order.operationType)) {
    return parseHistoryScaled(absoluteRawAmount(order.amount));
  }

  const quantity = parseHistoryScaled(order.quantity);
  const price = domainPriceToBigInt(order.price);

  if (price <= 0n || quantity <= 0n) return undefined;
  return (quantity * price) / (QUANTITY_SCALE * 1_000_000_000_000n);
}

export function getHistoryTriggerCondition(order: OrderHistoryItem) {
  const metadata = parseOrderHistoryMetadata(order);
  const stopPrice = parseHistoryScaled(metadata?.stopPrice);
  if (stopPrice <= 0n) return null;
  return stopPrice;
}

export function getHistoryTriggerDirection(order: OrderHistoryItem) {
  if (getHistoryTriggerCondition(order) === null) return null;
  const operation = getEffectiveHistoryOperation(order);
  const isBuy = safeUpperCase(order.side) === "BUY";
  if (operation.startsWith("TAKE_PROFIT")) {
    return isBuy ? "below" : "above";
  }
  return isBuy ? "above" : "below";
}

export function getHistoryTpSlLabel(order: OrderHistoryItem) {
  const operation = getEffectiveHistoryOperation(order);
  if (!operation) return "--";
  if (operation.includes("TAKE_PROFIT")) return "TP";
  if (operation.includes("STOP")) return "SL";
  return "--";
}

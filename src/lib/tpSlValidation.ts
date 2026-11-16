import type { OrderSide } from "@/types";

export type TpSlValidationKind = "TP" | "SL";

export function getInvalidAttachedTpSlTriggerPriceMessage({
  kind,
  side,
  triggerPrice,
  entryPrice,
  t,
}: {
  kind: TpSlValidationKind;
  side: OrderSide;
  triggerPrice: number;
  entryPrice: number;
  t: (value: string) => string;
}) {
  if (
    !Number.isFinite(triggerPrice) ||
    !Number.isFinite(entryPrice) ||
    triggerPrice <= 0 ||
    entryPrice <= 0
  ) {
    return null;
  }

  const isLongEntry = side === "BUY";
  const isValid =
    kind === "TP"
      ? isLongEntry
        ? triggerPrice > entryPrice
        : triggerPrice < entryPrice
      : isLongEntry
        ? triggerPrice < entryPrice
        : triggerPrice > entryPrice;

  if (isValid) return null;
  if (kind === "TP") {
    return t(
      isLongEntry
        ? "TP price must be higher than entry price."
        : "TP price must be lower than entry price.",
    );
  }
  return t(
    isLongEntry
      ? "SL price must be lower than entry price."
      : "SL price must be higher than entry price.",
  );
}

export function getInvalidTpSlTriggerPriceMessage({
  kind,
  positionQuantity,
  triggerPrice,
  currentPrice,
  t,
}: {
  kind: TpSlValidationKind;
  positionQuantity: bigint;
  triggerPrice: number;
  currentPrice: number;
  t: (value: string) => string;
}) {
  if (
    !Number.isFinite(triggerPrice) ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    positionQuantity === 0n
  ) {
    return null;
  }

  const isLongPosition = positionQuantity > 0n;
  if (kind === "SL") {
    const isValid = isLongPosition
      ? triggerPrice < currentPrice
      : triggerPrice > currentPrice;
    if (isValid) return null;
    return t(
      isLongPosition
        ? "SL price must be lower than current price. To close position immediately, use the position table or order form."
        : "SL price must be higher than current price. To close position immediately, use the position table or order form.",
    );
  }

  const isValid = isLongPosition
    ? triggerPrice > currentPrice
    : triggerPrice < currentPrice;
  if (isValid) return null;
  return t(
    isLongPosition
      ? "TP price must be higher than current price. To close position immediately, use the position table or order form."
      : "TP price must be lower than current price. To close position immediately, use the position table or order form.",
  );
}

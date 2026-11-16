import BN from "bignumber.js";
import type { OrderSide, RiskPreviewResponse } from "@/types";

const PRICE_SCALE_18 = 1_000_000_000_000_000_000n;
const NOTIONAL_DIV = 100_000_000_000_000_000_000n; // qty(1e8) * price(1e18) / amount(1e6)
const BPS = 10_000n;

export interface LiquidationEstimate {
  entry: string;
  entryScaled: string;
  liquidationPrice: string;
  liquidationPriceScaled: string;
  distancePct: number;
  isAboveEntry: boolean;
}

interface LiquidationPreviewInput {
  preview: RiskPreviewResponse;
  side: OrderSide;
  orderQuantity: bigint;
  orderPrice: string | number;
}

function absBigInt(value: bigint) {
  return value >= 0n ? value : -value;
}

function sameSign(a: bigint, b: bigint) {
  return (a > 0n && b > 0n) || (a < 0n && b < 0n);
}

function toScaledTeePrice(value: string | number) {
  return BigInt(
    BN(value).multipliedBy(PRICE_SCALE_18.toString()).decimalPlaces(0, BN.ROUND_DOWN).toFixed(0),
  );
}

function formatScaledTeePrice(value: bigint) {
  return BN(value.toString()).div(PRICE_SCALE_18.toString()).toFixed();
}

function notional(qty: bigint, price: bigint) {
  return (absBigInt(qty) * price) / NOTIONAL_DIV;
}

function applyBps(value: bigint, bps: number) {
  return (value * BigInt(bps)) / BPS;
}

function goBigIntDiv(numerator: bigint, denominator: bigint) {
  // Go's big.Int.Div is Euclidean. JS BigInt division truncates toward zero,
  // so negative intermediate values need adjustment to stay byte-for-byte
  // aligned with shared/risk.LiquidationPrice.
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder < 0n) {
    return denominator > 0n ? quotient - 1n : quotient + 1n;
  }
  return quotient;
}

function findMmrBps(projectedAggregateNotional: bigint, preview: RiskPreviewResponse) {
  // TEE locks the new slice MMR from current aggregate notional + order notional.
  // The backend preview sends the current aggregate and bracket table so the
  // browser can do this lookup locally while the slider moves.
  if (projectedAggregateNotional <= 0n) return null;
  for (const bracket of preview.mmBrackets ?? []) {
    const maxNotional = BigInt(bracket.maxNotional || "0");
    if (maxNotional <= 0n || projectedAggregateNotional <= maxNotional) {
      return bracket.mmrBps;
    }
  }
  return null;
}

function blendLockedMmr(existingQty: bigint, existingMmr: number, addedQty: bigint, addedMmr: number) {
  if (existingMmr === 0) return addedMmr;
  if (addedMmr === 0) return existingMmr;

  const existingAbs = absBigInt(existingQty);
  const addedAbs = absBigInt(addedQty);
  // Same as shared/risk.BlendLockedMMR:
  // ceil((|oldQty| * oldMMR + |newQty| * newMMR) / (|oldQty| + |newQty|)).
  // Rounding up avoids under-collecting MM after adding to an existing position.
  const numerator = existingAbs * BigInt(existingMmr) + addedAbs * BigInt(addedMmr);
  const denominator = existingAbs + addedAbs;
  const quotient = numerator / denominator;
  return Number(numerator % denominator === 0n ? quotient : quotient + 1n);
}

function weightedEntryPrice(existingQty: bigint, existingEntry: bigint, addedQty: bigint, addedEntry: bigint) {
  const existingAbs = absBigInt(existingQty);
  const addedAbs = absBigInt(addedQty);
  // TEE stores one merged one-way position, so the preview must use the same
  // quantity-weighted entry price before applying the liquidation formula.
  return (existingAbs * existingEntry + addedAbs * addedEntry) / (existingAbs + addedAbs);
}

// Mirrors shared/risk.LiquidationPrice for a post-open preview position.
// Keep the same signed numerator/denominator shape as Go instead of using
// algebraically equivalent long/short shortcuts; fixed-point integer division
// truncates toward zero, so formula shape can otherwise drift by one wei.
export function calculateLiquidationEstimateFromPreview({
  preview,
  side,
  orderQuantity,
  orderPrice,
}: LiquidationPreviewInput): LiquidationEstimate | null {
  const orderQtyAbs = absBigInt(orderQuantity);
  if (orderQtyAbs === 0n) return null;

  const orderEntry = toScaledTeePrice(orderPrice);
  if (orderEntry <= 0n) return null;

  const orderSignedQty = side === "BUY" ? orderQtyAbs : -orderQtyAbs;
  // New order notional is in AmountScale (1e6): qty(1e8) * price(1e18) / 1e20.
  const orderNotional = notional(orderQtyAbs, orderEntry);
  if (orderNotional <= 0n) return null;

  const projectedAggregate = BigInt(preview.aggregateNotional || "0") + orderNotional;
  const newSliceMmrBps = findMmrBps(projectedAggregate, preview);
  if (newSliceMmrBps === null) return null;

  let targetQty = orderSignedQty;
  let targetEntry = orderEntry;
  let targetMmrBps = newSliceMmrBps;

  if (preview.existingPosition) {
    const existingQty = BigInt(preview.existingPosition.quantity || "0");
    if (existingQty !== 0n) {
      // The product is one-way per symbol. Opposite-side opens are rejected by
      // TEE, so the preview returns N/A instead of estimating a close/reverse.
      if (!sameSign(existingQty, orderSignedQty)) {
        return null;
      }
      targetQty = existingQty + orderSignedQty;
      targetEntry = weightedEntryPrice(
        existingQty,
        BigInt(preview.existingPosition.entryPrice || "0"),
        orderSignedQty,
        orderEntry,
      );
      targetMmrBps = blendLockedMmr(
        existingQty,
        preview.existingPosition.lockedMMR,
        orderSignedQty,
        newSliceMmrBps,
      );
    }
  }

  const targetAbsQty = absBigInt(targetQty);
  if (targetAbsQty === 0n || targetMmrBps <= 0 || BigInt(targetMmrBps) >= BPS) return null;

  // OPEN_POSITION charges the trading fee before the new position affects risk.
  // Use post-fee wallet balance so high-leverage estimates do not overstate
  // remaining collateral.
  const openingFee = applyBps(orderNotional, preview.feeRateBps);
  const walletAfterFee = BigInt(preview.walletBalance || "0") - openingFee;

  // This is the cross-margin "other positions" part of shared/risk:
  // base = WB_after_fee - MM_others + UPNL_others.
  // Backend samples MM_others/UPNL_others because they require the user's other
  // positions and oracle marks; the browser combines them with live order input.
  const base =
    walletAfterFee -
    BigInt(preview.maintenanceMarginOthers || "0") +
    BigInt(preview.upnlOthers || "0");

  // Exact shared/risk.LiquidationPrice shape:
  // numerator = base * NotionalDiv - side * |targetQty| * targetEntry
  // denominator = |targetQty| * (lockedMMR - side * 10000)
  // liq = numerator * 10000 / denominator
  // side is +1 for long, -1 for short.
  const targetMmr = BigInt(targetMmrBps);
  const sideMultiplier = targetQty > 0n ? 1n : -1n;
  const denomFactor = targetMmr - sideMultiplier * BPS;
  if (denomFactor === 0n) {
    return null;
  }

  let targetTerm = targetAbsQty * targetEntry;
  if (targetQty < 0n) {
    targetTerm = -targetTerm;
  }
  const numerator = base * NOTIONAL_DIV - targetTerm;
  const denominator = targetAbsQty * denomFactor;
  if (denominator === 0n) return null;

  const rawLiquidationPrice = goBigIntDiv(numerator * BPS, denominator);
  const liquidationPrice = rawLiquidationPrice > 0n ? rawLiquidationPrice : 0n;

  const entry = formatScaledTeePrice(targetEntry);
  const liq = formatScaledTeePrice(liquidationPrice);
  const distancePct = BN(entry).minus(liq).abs().div(entry).multipliedBy(100).toNumber();

  return {
    entry,
    entryScaled: targetEntry.toString(),
    liquidationPrice: liq,
    liquidationPriceScaled: liquidationPrice.toString(),
    distancePct,
    isAboveEntry: targetQty < 0n,
  };
}

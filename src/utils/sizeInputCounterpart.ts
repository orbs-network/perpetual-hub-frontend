import BN from "bignumber.js";
import { formatNumber, formatUSD } from "@/utils/formatting";

export function getSizeInputSecondaryValue({
  baseAsset,
  precision,
  price,
  sizeUnit,
  sizeValue,
}: {
  baseAsset: string;
  precision: number;
  price: number | string;
  sizeUnit: "asset" | "usd";
  sizeValue: string;
}) {
  const size = BN(sizeValue || 0);
  const selectedPrice = BN(price || 0);
  if (
    !size.isFinite() ||
    !selectedPrice.isFinite() ||
    size.lte(0) ||
    selectedPrice.lte(0)
  ) {
    return undefined;
  }

  if (sizeUnit === "asset") {
    return `≈$${formatUSD(size.multipliedBy(selectedPrice).toFixed())}`;
  }

  return `≈${formatNumber(size.dividedBy(selectedPrice).toFixed(), {
    decimalScale: precision,
  })} ${baseAsset}`;
}

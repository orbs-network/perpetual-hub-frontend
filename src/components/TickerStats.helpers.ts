import { formatNumber } from "@/utils/formatting";

export function getChangeSummary({
  price,
  priceChangePercent,
}: {
  price?: number;
  priceChangePercent?: number;
}) {
  if (
    price === undefined ||
    priceChangePercent === undefined ||
    !Number.isFinite(price) ||
    !Number.isFinite(priceChangePercent)
  ) {
    return null;
  }

  const isPositive = priceChangePercent >= 0;
  const denominator = 100 + priceChangePercent;
  const change =
    denominator === 0 ? 0 : (price * priceChangePercent) / denominator;
  const absChange = Math.abs(change);
  const decimalScale = absChange >= 100 ? 0 : absChange >= 1 ? 2 : 4;
  const sign = isPositive ? "+" : "-";
  const absoluteChange = formatNumber(absChange, { decimalScale });
  const percentChange = Math.abs(priceChangePercent).toFixed(2);

  return {
    isPositive,
    className: isPositive ? "text-up" : "text-down",
    label: `${sign}${absoluteChange} / ${sign}${percentChange}%`,
  };
}

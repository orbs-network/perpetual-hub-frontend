import { getPriceDisplayDecimals } from "@/utils/formatting";

export function formatPrice(price: number): string {
  const decimals = getPriceDisplayDecimals(price);
  return price.toFixed(decimals);
}

export function formatSize(size: number, compact?: boolean): string {
  if (compact) {
    if (size >= 1000) return size.toFixed(0);
    return size.toFixed(3);
  }
  if (size >= 1000) return size.toFixed(1);
  if (size >= 1) return size.toFixed(3);
  return size.toFixed(5);
}

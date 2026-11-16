import { getPartnerDocumentTitle } from "@/config/partners";
import { getDisplaySymbol } from "@/lib/utils";
import { formatNumber } from "@/utils/formatting";

function normalizeTitlePricePrecision(pricePrecision: number): number {
  if (!Number.isInteger(pricePrecision) || pricePrecision < 0) return 2;
  return Math.min(pricePrecision, 8);
}

export function getTradePageDocumentTitle({
  price,
  pricePrecision = 2,
  symbol,
}: {
  price?: number | null;
  pricePrecision?: number;
  symbol: string;
}): string {
  const displaySymbol = getDisplaySymbol(symbol);
  const marketTitle = displaySymbol || getPartnerDocumentTitle();
  if (price && Number.isFinite(price) && price > 0) {
    return `$${formatNumber(price, {
      decimalScale: normalizeTitlePricePrecision(pricePrecision),
    })} | ${marketTitle}`;
  }

  return marketTitle;
}

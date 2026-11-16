import { formatPrice } from './format';
import { useTranslation } from "@/hooks/useSafeTranslation";

export function CenterRow({
  bestAsk,
  bestBid,
  compact,
}: {
  bestAsk: number;
  bestBid: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  // Skip render when crossed (bestAsk <= bestBid). Binance's WS depth stream can produce
  // a momentarily crossed book between partial updates; surfacing a negative spread is noise.
  const hasValidSpread = bestAsk > 0 && bestBid > 0 && bestAsk > bestBid;
  const spread = hasValidSpread ? bestAsk - bestBid : 0;
  const spreadPercent = hasValidSpread ? (spread / bestAsk) * 100 : 0;

  if (compact) {
    return (
      <div className="flex flex-shrink-0 items-center justify-center gap-1 border-y border-edge/30 bg-surface/30 px-1 py-1 text-[10px] text-content-muted">
        <span>{t("Spread")}</span>
        <span className="text-content">{hasValidSpread ? formatPrice(spread) : '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1 border-y border-edge/30 bg-surface/30 px-3 flex-shrink-0 text-[11px] text-content-muted">
      <span>{t("Spread")}</span>
      <span className="text-content">{hasValidSpread ? formatPrice(spread) : '—'}</span>
      <span>{hasValidSpread ? `${spreadPercent.toFixed(3)}%` : '—'}</span>
    </div>
  );
}

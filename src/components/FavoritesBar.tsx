import { memo, useRef, useState, useEffect, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useFavoritesStore } from "../stores/favoritesStore";
import { formatDisplayPrice, formatNumber } from "../utils/formatting";
import { useMarket } from "@/hooks/useMarkets";
import { usePrice } from "@/hooks/useBinancePrices";
import Surface from "./ui/surface";
import { useSelectTradeSymbol } from "@/hooks/useSelectTradeSymbol";

type DisplayMode = "pct" | "price";

const FavoriteChip = memo(function FavoriteChip({ symbol, mode }: { symbol: string; mode: DisplayMode }) {
  const selectTradeSymbol = useSelectTradeSymbol();
  const market = useMarket(symbol);
  const baseAsset = market?.baseAsset ?? "";
  const quoteAsset = market?.quoteAsset ?? "";
  const priceData = usePrice(symbol);
  const { priceChangePercent, price } = priceData ?? {};
  const displayBaseAsset = symbol.endsWith("USDT")
    ? symbol.slice(0, -4)
    : baseAsset || symbol;
  const displayQuoteAsset = symbol.endsWith("USDT")
    ? "USDT"
    : quoteAsset || "";
  const symbolLabel = displayQuoteAsset
    ? `${displayBaseAsset}-${displayQuoteAsset}`
    : displayBaseAsset;

  const isPositive = priceChangePercent && priceChangePercent >= 0;

  const priceChangePercentF = formatNumber(priceChangePercent, { decimalScale: 2, suffix: "%" });

  return (
    <button
      onClick={() => selectTradeSymbol(symbol)}
      className="flex items-center gap-1.5 px-3 py-1 whitespace-nowrap text-[13px] hover:bg-hover/50 rounded transition-colors shrink-0"
    >
      <span className="text-content font-medium">{symbolLabel}</span>
      {price && (
        <span className={` text-[11px] ${isPositive ? "text-up" : "text-down"}`}>
          {mode === "price"
            ? `$${formatDisplayPrice(price)}`
            : `${isPositive ? "+" : ""}${priceChangePercentF}`}
        </span>
      )}
    </button>
  );
});

export function FavoritesBar() {
  const { favorites } = useFavoritesStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("pct");

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);

    // Prevent macOS swipe-back gesture on horizontal overscroll
    const preventOverscroll = (e: WheelEvent) => {
      const atLeft = el.scrollLeft <= 0;
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((atLeft && e.deltaX < 0) || (atRight && e.deltaX > 0)) {
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", preventOverscroll, { passive: false });

    return () => {
      el.removeEventListener("scroll", checkScroll);
      el.removeEventListener("wheel", preventOverscroll);
      observer.disconnect();
    };
  }, [checkScroll, favorites]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
  }, []);

  return (
    <Surface className="relative flex items-center h-9 overflow-hidden">
      {/* Fixed left: star + toggle + left arrow */}
      <div className="shrink-0 h-full px-2 flex items-center gap-1.5 z-10">
        <Star size={14} className="text-warning fill-warning" />
        {favorites.length > 0 && (
          <div className="flex items-center bg-raised rounded overflow-hidden">
            <button
              onClick={() => setDisplayMode("price")}
              className={`px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                displayMode === "price" ? "bg-active text-content" : "text-content-muted hover:text-content-secondary"
              }`}
            >
              $
            </button>
            <button
              onClick={() => setDisplayMode("pct")}
              className={`px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                displayMode === "pct" ? "bg-active text-content" : "text-content-muted hover:text-content-secondary"
              }`}
            >
              %
            </button>
          </div>
        )}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="p-0.5 text-content-muted hover:text-content transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Scrollable chips */}
      <div
        ref={scrollRef}
        className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0 pr-[10px] overscroll-x-contain"
      >
        {favorites.map((symbol) => (
          <FavoriteChip key={symbol} symbol={symbol} mode={displayMode} />
        ))}
      </div>


      {/* Right arrow - absolute, hidden when scrolled to end */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 z-10 flex h-full items-center bg-surface px-1.5 shadow-card"
        >
          <ChevronRight size={16} className="text-content-muted" />
        </button>
      )}
    </Surface>
  );
}

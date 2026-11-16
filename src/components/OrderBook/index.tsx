import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useOrderFormStore } from '@/stores/orderFormStore';
import { useTradeSymbol } from '@/hooks/useSelectTradeSymbol';
import { LevelRow, ROW_MIN_HEIGHT_PX, ROW_GAP_PX } from './LevelRow';
import { CenterRow } from './CenterRow';
import { OrderBookSkeleton } from './Skeleton';
import { DenomDropdown } from './DenomDropdown';
import { GroupingDropdown, type GroupingOptionIndex } from './GroupingDropdown';
import {
  denominateSize,
  type Denom,
} from './denominate';
import { useSelectedOrderBook } from '@/hooks/useOrderBook';
import { buildGroupingTicks, groupLevels } from '@/utils/book';
import type { OrderBookLevel } from '@/types';
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  calculateCompactVisibleLevels,
  COMPACT_VISIBLE_LEVELS,
  ORDER_BOOK_CHROME_HEIGHT,
  ORDER_BOOK_MOBILE_SIDE_BY_SIDE_CHROME_HEIGHT,
} from './compactLayout';
import { ORDER_BOOK_DEPTH_FILL_CLASS } from './depthFill';

function resolveGroupingIndex(
  groupingTicks: number[],
  groupingIndex: GroupingOptionIndex,
) {
  const selectedTick = groupingTicks[groupingIndex];
  if (Number.isFinite(selectedTick) && selectedTick > 0) {
    return groupingIndex;
  }

  const firstGroupedIndex = groupingTicks.findIndex((tick) => (
    Number.isFinite(tick) && tick > 0
  ));
  if (firstGroupedIndex >= 0) {
    return firstGroupedIndex;
  }

  return Math.max(0, groupingTicks.length - 1);
}

function formatMobileTotal(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1000) return value.toFixed(1);
  return value.toFixed(5);
}

function decimalPlaces(value: number): number {
  const valueText = value.toString().toLowerCase();
  const exponentMatch = valueText.match(/^(\d+(?:\.(\d+))?)e-(\d+)$/);
  if (exponentMatch) {
    return Number(exponentMatch[3]) + (exponentMatch[2]?.length ?? 0);
  }
  return valueText.split('.')[1]?.length ?? 0;
}

function formatMobilePrice(price: number, groupingTick: number): string {
  const decimals = groupingTick >= 1
    ? 0
    : groupingTick > 0
      ? Math.min(decimalPlaces(groupingTick), 8)
      : price >= 100
        ? 2
        : 4;
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompactSize(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
}

function CompactOrderBookSkeleton({ levels }: { levels: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col bg-surface px-1">
      <div className="grid h-6 grid-cols-[0.92fr_1fr] items-center text-[10px] text-content-muted">
        <span>{t("Price")}</span>
        <span className="text-right">{t("Size")}</span>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-y-1 overflow-hidden pb-1">
        {Array.from({ length: levels }, (_, index) => (
          <div key={`ca-${index}`} className="h-[26px] animate-pulse bg-order-book-ask-depth/10" />
        ))}
        <div className="h-9 animate-pulse bg-surface/60" />
        {Array.from({ length: levels }, (_, index) => (
          <div key={`cb-${index}`} className="h-[26px] animate-pulse bg-order-book-bid-depth/10" />
        ))}
        <div className="h-6 animate-pulse bg-surface/60" />
      </div>
    </div>
  );
}

function MobileOrderBookSkeleton({ levels }: { levels: number }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 px-1 pb-1">
      {Array.from({ length: levels }, (_, index) => (
        <div key={index} className="grid h-[22px] grid-cols-2 gap-0.5">
          <div className="animate-pulse bg-order-book-bid-depth/10" />
          <div className="animate-pulse bg-order-book-ask-depth/10" />
        </div>
      ))}
    </div>
  );
}

function CompactLevelRow({
  level,
  maxTotal,
  side,
  onPriceClick,
  displaySize,
  groupingTick,
}: {
  level: OrderBookLevel;
  maxTotal: number;
  side: 'bid' | 'ask';
  onPriceClick?: (price: number, size?: number) => void;
  displaySize: number;
  groupingTick: number;
}) {
  const isBid = side === 'bid';
  const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
  const depthColor = isBid ? 'bg-order-book-bid-depth/20' : 'bg-order-book-ask-depth/20';
  const priceColor = isBid ? 'text-up' : 'text-down';

  return (
    <button
      type="button"
      onClick={() => onPriceClick?.(level.price, level.size)}
      data-compact-order-book-row="true"
      className="relative grid h-[26px] grid-cols-[0.92fr_1fr] items-center overflow-hidden px-1 text-[11px] tabular-nums"
    >
      <span
        className={`${ORDER_BOOK_DEPTH_FILL_CLASS} ${depthColor}`}
        style={{ width: `${depthPercent}%` }}
      />
      <span className={`relative truncate text-left font-medium ${priceColor}`}>
        {formatMobilePrice(level.price, groupingTick)}
      </span>
      <span className="relative truncate text-right font-semibold text-content">
        {formatCompactSize(displaySize)}
      </span>
    </button>
  );
}

function CompactOrderBook({
  asks,
  bids,
  bestAsk,
  bestBid,
  maxAskTotal,
  maxBidTotal,
  onPriceClick,
  sizeHeader,
  groupingTick,
  groupingIndex,
  groupingTicks,
  onGroupingChange,
  denom,
}: {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  bestAsk: number;
  bestBid: number;
  maxAskTotal: number;
  maxBidTotal: number;
  onPriceClick?: (price: number, size?: number) => void;
  sizeHeader: string;
  groupingTick: number;
  groupingIndex: GroupingOptionIndex;
  groupingTicks: number[];
  onGroupingChange: (index: GroupingOptionIndex) => void;
  denom: Denom;
}) {
  const { t } = useTranslation();
  const displayPrice = bestAsk || bestBid;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface px-1">
      <div className="grid h-6 shrink-0 grid-cols-[0.92fr_1fr] items-center px-1 text-[10px] text-content-muted">
        <span>{t("Price")}</span>
        <span className="text-right">{sizeHeader}</span>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-y-1 overflow-hidden pb-1">
        {asks.map((level) => (
          <CompactLevelRow
            key={`ca-${level.price}`}
            level={level}
            maxTotal={maxAskTotal}
            side="ask"
            onPriceClick={onPriceClick}
            displaySize={denominateSize(level.size, level.price, denom)}
            groupingTick={groupingTick}
          />
        ))}
        <button
          type="button"
          onClick={() => displayPrice && onPriceClick?.(displayPrice)}
          className="flex h-9 items-center px-1 text-left text-[15px] font-semibold text-down tabular-nums"
        >
          {displayPrice ? `$${formatMobilePrice(displayPrice, groupingTick)}` : '-'}
        </button>
        {bids.map((level) => (
          <CompactLevelRow
            key={`cb-${level.price}`}
            level={level}
            maxTotal={maxBidTotal}
            side="bid"
            onPriceClick={onPriceClick}
            displaySize={denominateSize(level.size, level.price, denom)}
            groupingTick={groupingTick}
          />
        ))}
        <div className="flex h-6 items-center px-1">
          <GroupingDropdown
            value={groupingIndex}
            options={groupingTicks}
            onChange={onGroupingChange}
            triggerClassName="px-0 text-content [&_svg]:rotate-180"
          />
        </div>
      </div>
    </div>
  );
}

function MobileDepthHalf({
  level,
  maxTotal,
  side,
  onPriceClick,
  displayTotal,
  groupingTick,
}: {
  level?: OrderBookLevel;
  maxTotal: number;
  side: 'bid' | 'ask';
  onPriceClick?: (price: number, size?: number) => void;
  displayTotal?: number;
  groupingTick: number;
}) {
  const isBid = side === 'bid';
  const depthPercent = level && maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
  const depthColor = isBid ? 'bg-order-book-bid-depth/20' : 'bg-order-book-ask-depth/20';
  const priceColor = isBid ? 'text-up' : 'text-down';
  const totalValue = level ? (displayTotal ?? level.total) : undefined;

  return (
    <button
      type="button"
      onClick={() => level && onPriceClick?.(level.price, level.size)}
      disabled={!level}
      className={`relative grid h-[22px] min-w-0 items-center overflow-hidden text-[11px] tabular-nums ${
        isBid ? 'grid-cols-[1fr_0.76fr] pr-1' : 'grid-cols-[0.76fr_1fr] pl-1'
      }`}
    >
      {level && (
        <span
          className={`${ORDER_BOOK_DEPTH_FILL_CLASS} ${depthColor}`}
          style={{ width: `${depthPercent}%` }}
        />
      )}
      {isBid ? (
        <>
          <span className="relative truncate text-left text-content">
            {totalValue === undefined ? '' : formatMobileTotal(totalValue)}
          </span>
          <span className={`relative text-right font-medium ${priceColor}`}>
            {level ? formatMobilePrice(level.price, groupingTick) : ''}
          </span>
        </>
      ) : (
        <>
          <span className={`relative text-left font-medium ${priceColor}`}>
            {level ? formatMobilePrice(level.price, groupingTick) : ''}
          </span>
          <span className="relative truncate text-right text-content">
            {totalValue === undefined ? '' : formatMobileTotal(totalValue)}
          </span>
        </>
      )}
    </button>
  );
}

function MobileSideBySideOrderBook({
  bids,
  asks,
  maxBidTotal,
  maxAskTotal,
  onPriceClick,
  visibleLevels,
  totalHeader,
  groupingTick,
  denom,
}: {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  maxBidTotal: number;
  maxAskTotal: number;
  onPriceClick?: (price: number, size?: number) => void;
  visibleLevels: number;
  totalHeader: string;
  groupingTick: number;
  denom: Denom;
}) {
  const { t } = useTranslation();
  const rowCount = Math.max(visibleLevels, bids.length, asks.length);

  return (
    <>
      <div className="grid h-8 grid-cols-2 gap-0.5 border-b border-edge px-1 text-[10px] text-content-muted">
        <div className="grid grid-cols-[1fr_0.76fr] items-center pr-1">
          <span className="text-left">{totalHeader}</span>
          <span className="text-right">{t("Price")}</span>
        </div>
        <div className="grid grid-cols-[0.76fr_1fr] items-center border-l border-edge/70 pl-1">
          <span className="text-left">{t("Price")}</span>
          <span className="text-right">{totalHeader}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden px-1 pb-1">
        {Array.from({ length: rowCount }, (_, index) => {
          const bid = bids[index];
          const ask = asks[index];
          return (
            <div key={index} className="grid grid-cols-2 gap-0.5">
              <MobileDepthHalf
                level={bid}
                maxTotal={maxBidTotal}
                side="bid"
                onPriceClick={onPriceClick}
                displayTotal={bid ? denominateSize(bid.total, bid.price, denom) : undefined}
                groupingTick={groupingTick}
              />
              <MobileDepthHalf
                level={ask}
                maxTotal={maxAskTotal}
                side="ask"
                onPriceClick={onPriceClick}
                displayTotal={ask ? denominateSize(ask.total, ask.price, denom) : undefined}
                groupingTick={groupingTick}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

export function OrderBook({
  compact,
  mobileSideBySide,
}: {
  compact?: boolean;
  mobileSideBySide?: boolean;
} = {}) {
  const { t } = useTranslation();
  const { data, status } = useSelectedOrderBook();
  const onOrderBookPrice = useOrderFormStore((s) => s.onOrderBookPrice);
  const { market } = useTradeSymbol();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleLevels, setVisibleLevels] = useState(
    compact ? COMPACT_VISIBLE_LEVELS : mobileSideBySide ? 11 : 7,
  );
  const [denom, setDenom] = useState<Denom>('BASE');
  const [groupingIndex, setGroupingIndex] = useState<GroupingOptionIndex>(
    compact || mobileSideBySide ? 3 : 1,
  );
  const handlePriceClick = useCallback(
    (price: number, size?: number) => onOrderBookPrice(price, size),
    [onOrderBookPrice],
  );

  const baseLabel = market?.baseAsset ?? "";
  const quoteLabel = market?.quoteAsset ?? "";
  const sizeUnitLabel = denom === 'QUOTE' ? quoteLabel : baseLabel;
  const minimumGroupingTick = useMemo(() => {
    const precision = market?.pricePrecision;
    if (typeof precision !== 'number' || !Number.isInteger(precision) || precision < 0) {
      return 0.1;
    }
    return 10 ** -precision;
  }, [market?.pricePrecision]);
  const bestAsk = data?.asks?.[0]?.price ?? 0;
  const bestBid = data?.bids?.[0]?.price ?? 0;
  const referencePrice =
    data?.midPrice && data.midPrice > 0
      ? data.midPrice
      : bestAsk > 0 && bestBid > 0
        ? (bestAsk + bestBid) / 2
        : bestAsk || bestBid || undefined;
  const groupingTicks = useMemo(
    () => buildGroupingTicks(minimumGroupingTick, referencePrice),
    [minimumGroupingTick, referencePrice],
  );
  const resolvedGroupingIndex = resolveGroupingIndex(groupingTicks, groupingIndex);
  const groupingTick = groupingTicks[resolvedGroupingIndex] ?? groupingTicks[1] ?? 0;
  const effectiveVisibleLevels = visibleLevels;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0].contentRect.height;
      if (compact) {
        setVisibleLevels(calculateCompactVisibleLevels(height));
        return;
      }
      const availableHeight = mobileSideBySide
        ? height - ORDER_BOOK_MOBILE_SIDE_BY_SIDE_CHROME_HEIGHT
        : (height - ORDER_BOOK_CHROME_HEIGHT) / 2;
      // N rows + (N-1) gaps must fit: N*(row + gap) - gap <= perSide
      const levels = Math.max(
        5,
        Math.floor((availableHeight + ROW_GAP_PX) / (ROW_MIN_HEIGHT_PX + ROW_GAP_PX)),
      );
      setVisibleLevels(levels);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact, mobileSideBySide]);

  const groupedAsks = useMemo(() => {
    const asks = data?.asks ?? [];
    return groupingTick > 0 ? groupLevels(asks, groupingTick, 'ask') : asks;
  }, [data?.asks, groupingTick]);

  const groupedBids = useMemo(() => {
    const bids = data?.bids ?? [];
    return groupingTick > 0 ? groupLevels(bids, groupingTick, 'bid') : bids;
  }, [data?.bids, groupingTick]);

  const visibleAsks = useMemo(
    () =>
      mobileSideBySide
        ? groupedAsks.slice(0, effectiveVisibleLevels)
        : groupedAsks.slice(0, effectiveVisibleLevels).reverse(),
    [groupedAsks, mobileSideBySide, effectiveVisibleLevels],
  );

  const visibleBids = useMemo(
    () => groupedBids.slice(0, effectiveVisibleLevels),
    [groupedBids, effectiveVisibleLevels],
  );

  const maxAskTotal = useMemo(() => visibleAsks.reduce((max, level) => Math.max(max, level.total), 0), [visibleAsks]);
  const maxBidTotal = useMemo(() => visibleBids.reduce((max, level) => Math.max(max, level.total), 0), [visibleBids]);

  const sizeHeader = sizeUnitLabel
    ? `${t("Size")} (${sizeUnitLabel})`
    : t("Size");
  const totalHeader = sizeUnitLabel
    ? `${t("Total")} (${sizeUnitLabel})`
    : t("Total");

  return (
    <div ref={containerRef} data-testid="order-book" className="flex flex-col h-full">
      {!compact && (
        <div className="flex h-[32px] items-center gap-2 border-b border-edge px-2">
          <div className="flex min-w-0 flex-1 items-center" data-orderbook-slot="left">
            {mobileSideBySide && (
              <GroupingDropdown
                value={resolvedGroupingIndex}
                options={groupingTicks}
                onChange={setGroupingIndex}
              />
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2" data-orderbook-slot="right">
            {status === 'pending' && (
              <span className="text-[10px] text-content-muted">
                {t("Loading...")}
              </span>
            )}
            {!mobileSideBySide && (
              <GroupingDropdown
                value={resolvedGroupingIndex}
                options={groupingTicks}
                onChange={setGroupingIndex}
              />
            )}
            <DenomDropdown
              value={denom}
              baseLabel={baseLabel}
              quoteLabel={quoteLabel}
              onChange={setDenom}
            />
          </div>
        </div>
      )}

      {compact ? (
        !data ? (
          <CompactOrderBookSkeleton levels={effectiveVisibleLevels} />
        ) : (
          <CompactOrderBook
            asks={visibleAsks}
            bids={visibleBids}
            bestAsk={bestAsk}
            bestBid={bestBid}
            maxAskTotal={maxAskTotal}
            maxBidTotal={maxBidTotal}
            onPriceClick={handlePriceClick}
            sizeHeader={sizeHeader}
            groupingTick={groupingTick}
            groupingIndex={resolvedGroupingIndex}
            groupingTicks={groupingTicks}
            onGroupingChange={setGroupingIndex}
            denom={denom}
          />
        )
      ) : mobileSideBySide ? (
        !data ? (
          <>
            <div className="grid h-8 grid-cols-2 gap-0.5 border-b border-edge px-1 text-[10px] text-content-muted">
              <div className="grid grid-cols-[1fr_0.76fr] items-center pr-1">
                <span>{totalHeader}</span>
                <span className="text-right">{t("Price")}</span>
              </div>
              <div className="grid grid-cols-[0.76fr_1fr] items-center border-l border-edge/70 pl-1">
                <span>{t("Price")}</span>
                <span className="text-right">{totalHeader}</span>
              </div>
            </div>
            <MobileOrderBookSkeleton levels={effectiveVisibleLevels} />
          </>
        ) : (
          <MobileSideBySideOrderBook
            bids={visibleBids}
            asks={visibleAsks}
            maxBidTotal={maxBidTotal}
            maxAskTotal={maxAskTotal}
            onPriceClick={handlePriceClick}
            visibleLevels={effectiveVisibleLevels}
            totalHeader={totalHeader}
            groupingTick={groupingTick}
            denom={denom}
          />
        )
      ) : (
        <>
          <div className={`flex h-[18px] items-center text-[10px] text-content-muted ${compact ? 'px-1' : 'px-2'}`}>
            <span className="flex-1 text-left">{t("Price")}</span>
            <span className="flex-1 text-right">{sizeHeader}</span>
            {!compact && <span className="flex-1 text-right">{totalHeader}</span>}
          </div>

          {!data ? (
            <OrderBookSkeleton levels={effectiveVisibleLevels} compact={compact} />
          ) : (
            <>
              <div className="flex flex-1 flex-col justify-end gap-0.5 overflow-hidden">
                {visibleAsks.map((level) => (
                  <LevelRow
                    key={`a-${level.price}`}
                    level={level}
                    maxTotal={maxAskTotal}
                    side="ask"
                    onPriceClick={handlePriceClick}
                    compact={compact}
                    displaySize={denominateSize(level.size, level.price, denom)}
                    // Cumulative total at the level's own price: visually close to
                    // summing quote value and avoids a second cumulative track.
                    displayTotal={denominateSize(level.total, level.price, denom)}
                  />
                ))}
              </div>

              <CenterRow bestAsk={bestAsk} bestBid={bestBid} compact={compact} />

              <div className="flex flex-1 flex-col justify-start gap-0.5 overflow-hidden">
                {visibleBids.map((level) => (
                  <LevelRow
                    key={`b-${level.price}`}
                    level={level}
                    maxTotal={maxBidTotal}
                    side="bid"
                    onPriceClick={handlePriceClick}
                    compact={compact}
                    displaySize={denominateSize(level.size, level.price, denom)}
                    displayTotal={denominateSize(level.total, level.price, denom)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

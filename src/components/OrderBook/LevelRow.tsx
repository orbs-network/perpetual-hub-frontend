import { memo } from 'react';
import type { OrderBookLevel } from '@/types';
import { formatPrice, formatSize } from './format';
import { ORDER_BOOK_DEPTH_FILL_CLASS } from './depthFill';

export const ROW_MIN_HEIGHT_PX = 23;
export const ROW_GAP_PX = 2;

export const LevelRow = memo(function LevelRow({
  level,
  maxTotal,
  side,
  onPriceClick,
  compact,
  displaySize,
  displayTotal,
}: {
  level: OrderBookLevel;
  maxTotal: number;
  side: 'ask' | 'bid';
  onPriceClick?: (price: number, size?: number) => void;
  compact?: boolean;
  displaySize?: number;
  displayTotal?: number;
}) {
  const depthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
  const priceColor = side === 'ask' ? 'text-down' : 'text-up';
  const depthColor = side === 'ask' ? 'bg-order-book-ask-depth/10' : 'bg-order-book-bid-depth/10';
  const sizeValue = displaySize ?? level.size;
  const totalValue = displayTotal ?? level.total;

  return (
    <div
      onClick={() => onPriceClick?.(level.price, level.size)}
      className={`relative flex items-center flex-1 min-h-[23px] cursor-pointer ${compact ? 'px-1 text-[11px]' : 'px-2 text-[12px]'}`}
    >
      <div
        className={`${ORDER_BOOK_DEPTH_FILL_CLASS} ${depthColor}`}
        style={{ width: `${depthPercent}%` }}
      />
      <span className={`relative flex-1 text-left ${priceColor}`}>
        <span className="hover:font-semibold">{formatPrice(level.price)}</span>
      </span>
      <span className="relative flex flex-1 justify-end text-content-secondary">
        <span className="hover:font-semibold">{formatSize(sizeValue, compact)}</span>
      </span>
      {!compact && (
        <span className="relative flex flex-1 justify-end text-content-muted">
          <span className="hover:font-semibold">{formatSize(totalValue)}</span>
        </span>
      )}
    </div>
  );
});

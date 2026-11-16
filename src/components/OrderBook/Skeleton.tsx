import { Skeleton } from '@/components/ui/skeleton';
import { ROW_MIN_HEIGHT_PX } from './LevelRow';

const SKELETON_WIDTHS = [
  { price: '52%', size: '40%', total: '35%' },
  { price: '45%', size: '55%', total: '48%' },
  { price: '58%', size: '35%', total: '42%' },
  { price: '42%', size: '50%', total: '30%' },
  { price: '55%', size: '45%', total: '52%' },
  { price: '48%', size: '38%', total: '45%' },
  { price: '50%', size: '52%', total: '38%' },
];

function SkeletonRow({ compact, side, index }: { compact?: boolean; side: 'ask' | 'bid'; index: number }) {
  const w = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <div className={`flex items-center gap-2 ${compact ? 'px-1' : 'px-2'}`} style={{ height: ROW_MIN_HEIGHT_PX }}>
      <div className="flex-1">
        <Skeleton
          className={`h-[10px] ${side === 'ask' ? 'bg-order-book-ask-depth/15' : 'bg-order-book-bid-depth/15'}`}
          style={{ width: w.price }}
        />
      </div>
      <div className="flex-1 flex justify-end">
        <Skeleton className="h-[10px]" style={{ width: w.size }} />
      </div>
      {!compact && (
        <div className="flex-1 flex justify-end">
          <Skeleton className="h-[10px]" style={{ width: w.total }} />
        </div>
      )}
    </div>
  );
}

export function OrderBookSkeleton({ levels, compact }: { levels: number; compact?: boolean }) {
  return (
    <>
      <div className="flex-1 flex flex-col justify-end gap-0.5 overflow-hidden">
        {Array.from({ length: levels }, (_, i) => (
          <SkeletonRow key={`sa${i}`} compact={compact} side="ask" index={i} />
        ))}
      </div>
      <div className="flex items-center justify-center py-1 border-y border-edge/30 bg-surface/30 px-2 flex-shrink-0">
        <Skeleton className="h-[14px] w-20" />
      </div>
      <div className="flex-1 flex flex-col justify-start gap-0.5 overflow-hidden">
        {Array.from({ length: levels }, (_, i) => (
          <SkeletonRow key={`sb${i}`} compact={compact} side="bid" index={i} />
        ))}
      </div>
    </>
  );
}

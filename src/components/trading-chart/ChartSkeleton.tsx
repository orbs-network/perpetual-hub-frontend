import { Skeleton } from "@/components/ui/skeleton";
const CANDLE_HEIGHTS = [
  34, 58, 42, 96, 52, 66, 45, 72, 40, 88, 54, 62, 38, 76, 48, 69,
];
const VOLUME_HEIGHTS = [
  22, 34, 18, 48, 26, 36, 20, 58, 30, 44, 24, 64, 28, 38, 20, 46,
];

export function ChartSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="trading-chart-skeleton"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-surface"
    >
      <div className="absolute inset-x-0 top-0 bottom-0">
        <div className="absolute inset-0 opacity-80">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="absolute left-0 right-16 border-t border-dashed border-edge-subtle"
              key={`chart-skeleton-h-${index}`}
              style={{ top: `${12 + index * 14}%` }}
            />
          ))}
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              className="absolute bottom-0 top-0 border-l border-dashed border-edge-subtle"
              key={`chart-skeleton-v-${index}`}
              style={{ left: `${8 + index * 14}%` }}
            />
          ))}
        </div>

        <div className="absolute left-4 right-20 top-7 bottom-[28%] flex items-end justify-between gap-2">
          {CANDLE_HEIGHTS.map((height, index) => (
            <div
              className="flex h-full flex-1 items-center justify-center"
              key={`chart-skeleton-candle-${index}`}
            >
              <Skeleton
                className={`w-full max-w-[16px] rounded-[2px] ${
                  index % 3 === 1 ? "bg-down/20" : "bg-up/20"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>

        <div className="absolute bottom-[8%] left-4 right-20 flex h-[18%] items-end justify-between gap-2">
          {VOLUME_HEIGHTS.map((height, index) => (
            <Skeleton
              className={`flex-1 rounded-[2px] ${index % 4 === 1 ? "bg-down/15" : "bg-up/15"}`}
              key={`chart-skeleton-volume-${index}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        <div className="absolute bottom-0 right-0 top-0 w-16 border-l border-edge-subtle px-2 py-4">
          <div className="flex h-full flex-col justify-between">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton
                className="h-2 w-10 bg-content-muted/15"
                key={`chart-skeleton-price-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

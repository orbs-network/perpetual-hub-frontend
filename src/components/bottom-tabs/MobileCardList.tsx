import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface MobileCardListProps<T> {
  data: T[];
  itemContent: (index: number, item: T) => React.ReactNode;
  computeItemKey?: (index: number, item: T) => React.Key;
  header?: React.ReactNode;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onEndReached?: () => void;
}

export function MobileCardList<T>({
  data,
  itemContent,
  computeItemKey,
  header,
  hasMore = false,
  isLoadingMore = false,
  onEndReached,
}: MobileCardListProps<T>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoadingMore || !onEndReached) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onEndReached();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [data.length, hasMore, isLoadingMore, onEndReached]);

  return (
    <div className="border-t border-edge/60 bg-surface px-3 py-2">
      {header ? <div className="flex justify-end pb-1">{header}</div> : null}
      {data.map((item, index) => (
        <div key={computeItemKey?.(index, item) ?? index} className="py-1">
          {itemContent(index, item)}
        </div>
      ))}
      {isLoadingMore && (
        <div className="space-y-2 py-1">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-16 w-full rounded-lg border border-edge bg-base"
            />
          ))}
        </div>
      )}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="h-px w-full"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

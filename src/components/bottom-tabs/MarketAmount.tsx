import { Skeleton } from "@/components/ui/skeleton";
import {
  useFormatSymbolAmount,
  useIsSymbolMarketLoading,
} from "@/hooks/useFormatting";
import { cn } from "@/lib/utils";

interface MarketAmountProps {
  amount?: number | string | bigint;
  symbol?: string;
  scaled?: "quantity" | "price" | "domainPrice";
  prefix?: string;
  suffix?: React.ReactNode;
  className?: string;
  skeletonClassName?: string;
}

export function MarketAmount({
  amount,
  symbol,
  scaled,
  prefix = "",
  suffix,
  className,
  skeletonClassName,
}: MarketAmountProps) {
  const formatAmount = useFormatSymbolAmount();
  const isMarketLoading = useIsSymbolMarketLoading(symbol);

  return (
    <span className={cn("relative inline-block", className)}>
      <span className={isMarketLoading ? "invisible" : undefined}>
        {prefix}
        {formatAmount(amount, symbol, scaled)}
        {suffix}
      </span>
      {isMarketLoading && (
        <Skeleton
          className={cn(
            "absolute left-0 top-1/2 h-3 w-full -translate-y-1/2",
            skeletonClassName,
          )}
        />
      )}
    </span>
  );
}

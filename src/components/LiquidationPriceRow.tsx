import { formatNumber } from "@/utils/formatting";
import { TooltipLabel } from "./ui/tooltip-label";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useSafeTranslation";

const TOOLTIP = "The estimated price at which your position will be liquidated if the market moves against you.";

export function LiquidationPriceRow({
  liquidationPrice,
  labelClassName,
  valueClassName,
  className,
}: {
  liquidationPrice?: string | number | null;
  labelClassName?: string;
  valueClassName?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const price = Number(liquidationPrice);
  const decimalScale = price > 0 && price < 1 ? 4 : 2;
  return (
    <div className={`flex items-start justify-between gap-3 ${labelClassName ?? ""} ${className ?? ""}`}>
      <TooltipLabel tooltip={TOOLTIP} className="min-w-0 text-content-secondary">
        {t("Est. Liquidation Price")}
      </TooltipLabel>
      <span className={cn(`min-w-0 text-right  tabular-nums text-content ${valueClassName ?? ""}`)}>
        {liquidationPrice ? formatNumber(liquidationPrice, { decimalScale, prefix: "$" }) : t("N/A")}
      </span>
    </div>
  );
}

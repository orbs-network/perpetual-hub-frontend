import { cn } from "@/lib/utils";
import { TooltipLabel } from "./ui/tooltip-label";
import type { ReactNode } from "react";
import { SkeletonContainer } from "./ui/skeleton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslation } from "@/hooks/useSafeTranslation";

interface DataRowProps {
  label: string;
  children: ReactNode;
  tooltip?: string;
  valueClassName?: string;
  className?: string;
  isLoading?: boolean;
}

export function DataRow({
  label,
  children,
  tooltip,
  valueClassName = "text-content",
  className = "",
  isLoading = false,
}: DataRowProps) {
  const { t } = useTranslation();
  const displayLabel = t(label);

  return (
    <div
      className={cn(
        `flex items-start justify-between gap-2 text-[12px] ${className}`,
      )}
    >
      {tooltip ? (
        <TooltipLabel tooltip={tooltip} className="min-w-0 text-content-secondary">
          {displayLabel}
        </TooltipLabel>
      ) : (
        <span className="min-w-0 text-content-secondary cursor-default">
          {displayLabel}
        </span>
      )}
      <span
        className={`min-w-0 text-right  tabular-nums ${valueClassName}`}
      >
        <SkeletonContainer isLoading={isLoading} className="min-w-[60px]">{children}</SkeletonContainer>
      </span>
    </div>
  );
}

export const DataRowContainer = ({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  return (
    <div className={cn(`flex flex-col gap-${isMobile ? "1" : "2"} pt-0.5`, className)}>
      {label && (
        <span className="text-[13px] text-content font-medium">
          {t(label)}
        </span>
      )}
      {children}
    </div>
  );
};

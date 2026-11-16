import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { cn } from "@/lib/utils";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import { ColumnHead } from "./ColumnHead";
import type { SortDirection, SortState } from "./useSortableRows";

interface SortableColumnHeadProps<Column extends string> {
  column: Column;
  label: string;
  sort: SortState<Column>;
  defaultDirection: SortDirection;
  nextDirection: SortDirection;
  onSort: (column: Column) => void;
  className?: string;
  tooltip?: string;
  sortLabel?: string;
  iconSize?: number;
}

export function SortableColumnHead<Column extends string>({
  column,
  label,
  sort,
  defaultDirection,
  nextDirection,
  onSort,
  className,
  tooltip,
  sortLabel = label.toLowerCase(),
  iconSize = 14,
}: SortableColumnHeadProps<Column>) {
  const { t } = useTranslation();
  const isActive = sort.column === column;
  const displayDirection = isActive ? sort.direction : defaultDirection;
  const displayLabel = t(label);
  const labelContent = tooltip ? (
    <TooltipLabel tooltip={tooltip} className="cursor-pointer">
      {displayLabel}
    </TooltipLabel>
  ) : (
    displayLabel
  );

  return (
    <ColumnHead
      className={className}
      label={
        <button
          type="button"
          onClick={() => onSort(column)}
          className={cn(
            "group inline-flex h-[30px] items-center gap-1 text-left text-[12px] text-content-secondary focus-visible:outline-none",
          )}
          aria-label={`${t("Sort")} ${t(sortLabel)} ${t(nextDirection === "desc" ? "descending" : "ascending")}`}
        >
          {labelContent}
          <ChevronDown
            size={iconSize}
            strokeWidth={1.8}
            className={cn(
              "transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100",
              isActive ? "opacity-100" : "opacity-0",
              displayDirection === "asc" && "rotate-180",
            )}
          />
        </button>
      }
    />
  );
}

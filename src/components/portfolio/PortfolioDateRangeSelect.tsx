import {
  InlineSelect,
  type InlineSelectOption,
} from "@/components/ui/inline-select";
import type { PortfolioDateRange } from "@/lib/portfolioDateRanges";

export const ACCOUNT_VALUE_DATE_RANGE_OPTIONS = [
  { value: "24H", label: "24H" },
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
  { value: "All", label: "All" },
] as const satisfies readonly InlineSelectOption<PortfolioDateRange>[];

export const PERPS_DATE_RANGE_OPTIONS = [
  { value: "24H", label: "24H" },
  { value: "14D", label: "14D" },
  { value: "30D", label: "30D" },
  { value: "All", label: "All" },
] as const satisfies readonly InlineSelectOption<PortfolioDateRange>[];

export function PortfolioDateRangeSelect({
  ariaLabel,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  onValueChange: (value: PortfolioDateRange) => void;
  options: readonly InlineSelectOption<PortfolioDateRange>[];
  value: PortfolioDateRange;
}) {
  return (
    <InlineSelect
      ariaLabel={ariaLabel}
      contentClassName="min-w-[76px]"
      itemClassName="text-[11px] font-medium"
      onValueChange={onValueChange}
      options={options}
      triggerClassName="h-7 min-w-[68px] justify-between rounded border border-edge bg-hover/60 px-2 py-0 text-[11px] font-semibold text-content-secondary hover:border-edge hover:bg-hover hover:text-content focus:border-edge data-[state=open]:border-edge data-[state=open]:bg-hover [&_svg]:h-3 [&_svg]:w-3"
      value={value}
    />
  );
}

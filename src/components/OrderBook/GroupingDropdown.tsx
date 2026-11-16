import { useMemo } from 'react';
import { InlineSelect } from '@/components/ui/inline-select';
import { cn } from '@/lib/utils';
import { useTranslation } from "@/hooks/useSafeTranslation";

export type GroupingOptionIndex = number;

function formatTick(tick: number): string {
  if (!Number.isFinite(tick) || tick <= 0) return '-';
  const normalized = Number(tick.toFixed(8));
  const fixed = normalized >= 1 ? normalized.toFixed(2) : normalized.toFixed(8);
  return fixed.replace(/\.?0+$/, '');
}

export function GroupingDropdown({
  value,
  options,
  onChange,
  triggerClassName,
}: {
  value: GroupingOptionIndex;
  options: number[];
  onChange: (index: GroupingOptionIndex) => void;
  triggerClassName?: string;
}) {
  const { t } = useTranslation();
  const selectableOptions = useMemo(
    () => options
      .map((tick, index) => ({ tick, index }))
      .filter(({ tick }) => Number.isFinite(tick) && tick > 0),
    [options],
  );
  const selectedValue = selectableOptions.some(({ index }) => index === value)
    ? value
    : selectableOptions[0]?.index ?? value;
  const inlineOptions = useMemo(
    () => selectableOptions.map(({ tick, index }) => ({
      value: String(index),
      label: formatTick(tick),
    })),
    [selectableOptions],
  );

  return (
    <InlineSelect
      value={String(selectedValue)}
      options={inlineOptions}
      onValueChange={(v) => onChange(Number(v))}
      triggerClassName={cn(
        "h-6 min-w-0 border-none px-1.5 py-0 text-[11px] hover:bg-surface/40 focus:ring-0 [&_svg]:h-3 [&_svg]:w-3",
        triggerClassName,
      )}
      ariaLabel={t("Order book price grouping")}
    />
  );
}

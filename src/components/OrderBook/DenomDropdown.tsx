import { useMemo } from 'react';
import type { Denom } from './denominate';
import { InlineSelect, type InlineSelectOption } from '@/components/ui/inline-select';
import { useTranslation } from "@/hooks/useSafeTranslation";

export function DenomDropdown({
  value,
  baseLabel,
  quoteLabel,
  onChange,
}: {
  value: Denom;
  baseLabel: string;
  quoteLabel: string;
  onChange: (d: Denom) => void;
}) {
  const { t } = useTranslation();
  const showBase = baseLabel.length > 0;
  const showQuote = quoteLabel.length > 0;
  const options = useMemo<InlineSelectOption<Denom>[]>(
    () => [
      ...(showQuote ? [{ value: "QUOTE" as const, label: quoteLabel }] : []),
      ...(showBase ? [{ value: "BASE" as const, label: baseLabel }] : []),
    ],
    [baseLabel, quoteLabel, showBase, showQuote],
  );

  if (!showBase && !showQuote) return null;

  return (
    <InlineSelect
      value={value}
      options={options}
      onValueChange={onChange}
      triggerClassName="h-6 min-w-0 border-none px-1.5 py-0 text-[11px] hover:bg-surface/40 focus:ring-0 [&_svg]:h-3 [&_svg]:w-3"
      ariaLabel={t("Order book denomination")}
    />
  );
}

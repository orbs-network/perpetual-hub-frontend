import { formatNumber } from "@/utils/formatting";
import { useMemo } from "react";

type FormatNumberProps = {
  value?: string | number | bigint;
  decimalScale?: number;
  prefix?: string;
  suffix?: string;
  defaultValue?: string;
  scaled?: "quantity" | "price";
};

export const FormatNumber = ({
  value,
  decimalScale,
  prefix,
  suffix,
  defaultValue = "-",
  scaled,
}: FormatNumberProps) => {
  const formatted = useMemo(
    () => formatNumber(value, { decimalScale, prefix, suffix, scaled }),
    [value, decimalScale, prefix, suffix, scaled],
  );
  return <>{formatted || defaultValue}</>;
};

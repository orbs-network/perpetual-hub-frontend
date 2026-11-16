import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { TableHead } from "@/components/ui/table";
import { TooltipLabel } from "@/components/ui/tooltip-label";
import { cn } from "@/lib/utils";

interface ColumnHeadProps {
  label?: ReactNode;
  tooltip?: string;
  className?: string;
}

export function ColumnHead({ label, tooltip, className }: ColumnHeadProps) {
  const { t } = useTranslation();
  const headClassName = cn("text-content-secondary", className);
  const displayLabel = typeof label === "string" ? t(label) : label;

  if (!displayLabel) return <TableHead className={headClassName} />;

  if (!tooltip) {
    return <TableHead className={headClassName}>{displayLabel}</TableHead>;
  }

  return (
    <TableHead className={headClassName}>
      <TooltipLabel tooltip={tooltip}>{displayLabel}</TooltipLabel>
    </TableHead>
  );
}

import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileSummaryField {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}

function MobileField({
  field,
}: {
  field: MobileSummaryField;
}) {
  return (
    <div className={cn("min-w-0", field.className)}>
      <div className="text-[12px] leading-4 text-content-muted">
        {field.label}
      </div>
      <div
        className={cn(
          "mt-0.5 min-w-0 break-words text-[12px] font-semibold leading-[15px]",
          field.valueClassName ?? "text-content",
        )}
      >
        {field.value}
      </div>
    </div>
  );
}

export function MobileCardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-base">
      {children}
    </div>
  );
}

export function MobileCollapsedSummary({
  fields,
  onExpand,
  expandLabel,
}: {
  fields: [MobileSummaryField, MobileSummaryField, MobileSummaryField];
  onExpand: () => void;
  expandLabel: string;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onExpand();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={false}
      aria-label={expandLabel}
      onClick={onExpand}
      onKeyDown={handleKeyDown}
      className="grid min-h-[72px] cursor-pointer grid-cols-[minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.05fr)_28px] items-center gap-x-4 px-3 py-2.5 text-left"
    >
      {fields.map((field, index) => (
        <MobileField key={index} field={field} />
      ))}
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center text-content-secondary transition-colors"
      >
        <ChevronDown size={22} strokeWidth={1.8} />
      </span>
    </div>
  );
}

export function MobileExpandedGrid({
  fields,
}: {
  fields: MobileSummaryField[];
}) {
  return (
    <div className="grid grid-cols-3 gap-x-5 gap-y-3 px-3 pb-3 pt-3 text-left">
      {fields.map((field, index) => (
        <MobileField key={index} field={field} />
      ))}
    </div>
  );
}

export function MobileExpandedFooter({
  onCollapse,
  collapseLabel,
  children,
}: {
  onCollapse: () => void;
  collapseLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-3 flex min-h-8 items-center justify-between border-t border-edge/50 py-1.5">
      <div className="min-w-0">{children}</div>
      <button
        type="button"
        onClick={onCollapse}
        aria-label={collapseLabel}
        className="flex h-7 w-7 shrink-0 items-center justify-center text-content-secondary transition-colors hover:text-content"
      >
        <ChevronDown size={22} strokeWidth={1.8} className="rotate-180" />
      </button>
    </div>
  );
}

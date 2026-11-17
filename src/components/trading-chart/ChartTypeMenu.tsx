import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import type { ChartType } from "@/lib/chart/model";
import { CHART_CONTROL_CLASS, CHART_MENU_CLASS } from "./controlStyles";
import { CHART_TYPES } from "./toolbarOptions";

interface ChartTypeMenuProps {
  value: ChartType;
  onValueChange: (value: ChartType) => void;
  disabled: boolean;
  contentContainer?: HTMLElement;
}

function ChartTypeIcon({
  type,
  className,
}: {
  type: ChartType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {type === "bars" ? (
        <path d="M7 3v18M3 8h4m0 7h4M17 5v14m-4-8h4m0 5h4" />
      ) : type === "area" ? (
        <>
          <path d="m3 15 6-7 5 4 7-9" />
          <path d="m3 15 6-7 5 4 7-9v18H3Z" fill="currentColor" fillOpacity="0.12" stroke="none" />
          <path d="M3 19v2m3-5v5m3-8v8m3-6v6m3-6v6m3-10v10m3-14v14" opacity="0.5" />
        </>
      ) : (
        <>
          <path d="M7 2v4m0 12v4M17 4v5m0 7v4" />
          <rect
            x="4"
            y="6"
            width="6"
            height="12"
            fill={type === "candles" ? "currentColor" : "none"}
          />
          <rect x="14" y="9" width="6" height="7" />
          {type === "hollow-candles" ? (
            <path d="m5 8 3-1m-3 4 4-2m-4 5 4-2m-4 5 4-2" opacity="0.5" />
          ) : null}
        </>
      )}
    </svg>
  );
}

export function ChartTypeMenu({
  value,
  onValueChange,
  disabled,
  contentContainer,
}: ChartTypeMenuProps) {
  const { t } = useTranslation();
  const [openOwner, setOpenOwner] = useState<{
    container?: HTMLElement;
  } | null>(null);
  const open = openOwner !== null && openOwner.container === contentContainer && !disabled;
  const selected = CHART_TYPES.find((option) => option.value === value);

  return (
    <Popover.Root
      key={disabled ? "loading" : "ready"}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpenOwner(nextOpen ? { container: contentContainer } : null);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("Chart type")}
          className={`${CHART_CONTROL_CLASS} inline-flex items-center gap-1.5`}
        >
          <ChartTypeIcon type={value} className="h-[13px] w-[13px] shrink-0" />
          <span className="hidden sm:inline">{selected ? t(selected.label) : null}</span>
          <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={contentContainer}>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          aria-label={t("Chart type")}
          className={`${CHART_MENU_CLASS} w-52`}
          onCloseAutoFocus={() => {
            setOpenOwner((current) => current === openOwner ? null : current);
          }}
        >
          {CHART_TYPES.map((option) => (
            <Popover.Close key={option.value} asChild>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={option.value === value}
                onClick={() => onValueChange(option.value)}
                className="flex min-h-8 w-full items-center gap-2 rounded px-2 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChartTypeIcon type={option.value} className="h-[13px] w-[13px] shrink-0" />
                <span className="min-w-0 flex-1 break-words">{t(option.label)}</span>
                {option.value === value ? (
                  <Check size={12} className="shrink-0 text-accent-primary" aria-hidden="true" />
                ) : null}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

import type { ReactNode } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslation } from "@/hooks/useSafeTranslation";

interface TooltipLabelProps {
  ariaLabel?: string;
  children: ReactNode;
  tooltip: string;
  className?: string;
  showUnderline?: boolean;
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Text with a dotted bottom border that shows a tooltip on hover.
 * Use anywhere a label needs a hover explanation.
 */
export function TooltipLabel({
  ariaLabel,
  children,
  tooltip,
  className,
  showUnderline = true,
  side = "top",
}: TooltipLabelProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const triggerStyle = showUnderline
    ? {
        backgroundImage:
          "linear-gradient(to right, currentColor 2px, transparent 2px)",
        backgroundPosition: "bottom",
        backgroundRepeat: "repeat-x",
        backgroundSize: "4px 1px",
      }
    : undefined;

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label={ariaLabel ? t(ariaLabel) : undefined}
            type="button"
            className={cn(
              "w-fit cursor-pointer appearance-none border-0 bg-transparent p-0 text-left [font:inherit]",
              className,
            )}
            style={triggerStyle}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={side}
          sideOffset={6}
          className="max-w-[300px] overflow-hidden rounded border border-edge bg-tooltip-bg px-2.5 py-1.5 text-[12px] leading-snug text-content shadow-modal"
        >
          {t(tooltip)}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {ariaLabel ? (
            <button
              aria-label={t(ariaLabel)}
              className={cn(
                "w-fit cursor-help appearance-none border-0 bg-transparent p-0 [font:inherit]",
                className,
              )}
              style={triggerStyle}
              type="button"
            >
              {children}
            </button>
          ) : (
            <span
              className={cn("w-fit cursor-default", className)}
              style={triggerStyle}
            >
              {children}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side={side}>{t(tooltip)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

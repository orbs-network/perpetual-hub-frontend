import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function computeDotPositions(min: number, max: number, count = 5): number[] {
  if (max <= min) return [];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + step * i));
}

const THUMB_DOT_MASK_CLEARANCE_PERCENT = 2.5;

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    trackClassName?: string;
    rangeClassName?: string;
    thumbClassName?: string;
    showDots?: boolean;
    dotCount?: number;
  }
>(({ className, trackClassName, rangeClassName, thumbClassName, showDots, dotCount = 5, min = 0, max = 100, ...props }, ref) => {
  const dotPositions = showDots ? computeDotPositions(min as number, max as number, dotCount) : [];

  return (
    <div className="relative w-full px-[3px]">
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative h-[8px] w-full grow rounded-full bg-edge cursor-pointer",
            trackClassName
          )}
        >
          <SliderPrimitive.Range
            className={cn(
              "absolute h-full rounded-full bg-slider-active/40",
              rangeClassName
            )}
          />
          {showDots && dotPositions.map((pos) => {
            const value = Array.isArray(props.value) ? props.value[0] : 0;
            const range = (max as number) - (min as number);
            const pct = range > 0 ? ((pos - (min as number)) / range) * 100 : 0;
            const isActive = value >= pos;
            const valuePct = range > 0 ? ((value - (min as number)) / range) * 100 : 0;
            const isUnderThumb =
              Math.abs(valuePct - pct) <= THUMB_DOT_MASK_CLEARANCE_PERCENT;
            return (
              <div
                key={pos}
                data-slider-dot={pos}
                className={cn(
                  "absolute top-1/2 z-[1] h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full",
                  isUnderThumb
                    ? "opacity-0"
                    : isActive
                    ? "bg-slider-active"
                    : "bg-content-muted/40"
                )}
                style={{ left: `clamp(3px, ${pct}%, calc(100% - 3px))` }}
              />
            );
          })}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "relative z-[30] block h-[18px] w-[18px] rounded-full bg-surface border-2 border-slider-active shadow-[0_0_0_2px_rgb(var(--color-slider-active)_/_0.15)] transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
            thumbClassName
          )}
        />
      </SliderPrimitive.Root>
    </div>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

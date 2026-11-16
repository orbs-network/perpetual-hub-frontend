import { useIsMobile } from "@/hooks/useIsMobile";
import { useOrderFormStore } from "../../../stores/orderFormStore";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { cn } from "@/lib/utils";
import { partner } from "@/config/partners";

export function SideToggle() {
  const { side, setSide } = useOrderFormStore();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isBuy = side === "BUY";
  const tradeSideButtonRadiusClassName =
    partner.componentClassNames?.tradeSideButtonRadius;
  const inactiveClassName =
    "border-[var(--color-trade-side-inactive-border)] bg-[var(--color-trade-side-inactive-bg)]";
  const longActiveClassName =
    "border-[var(--color-trade-long-active-border)] bg-[var(--color-trade-long-active-bg)]";
  const shortActiveClassName =
    "border-[var(--color-trade-short-active-border)] bg-[var(--color-trade-short-active-bg)]";

  if (!tradeSideButtonRadiusClassName) {
    const segmentedButtonClassName = cn(
      "relative z-[1] h-full flex-1 font-semibold transition-colors duration-200",
      isMobile ? "text-[12px]" : "text-[13px]",
    );

    return (
      <div className="relative mt-2.5 flex h-8 w-full items-center overflow-hidden rounded border border-[var(--color-trade-side-inactive-border)] bg-[var(--color-trade-side-inactive-bg)]">
        <div
          aria-hidden="true"
          className={cn(
            "absolute -bottom-px -top-px w-1/2 rounded border transition-all duration-200 ease-out",
            isBuy
              ? cn("left-0", longActiveClassName)
              : cn("left-1/2", shortActiveClassName),
          )}
        />

        <button
          type="button"
          onClick={() => setSide("BUY")}
          aria-pressed={isBuy}
          className={cn(
            segmentedButtonClassName,
            "text-trade-side-long-text",
            !isBuy && inactiveClassName,
          )}
        >
          {t("Buy / Long")}
        </button>
        <button
          type="button"
          onClick={() => setSide("SELL")}
          aria-pressed={!isBuy}
          className={cn(
            segmentedButtonClassName,
            "text-trade-side-short-text",
            isBuy && inactiveClassName,
          )}
        >
          {t("Sell / Short")}
        </button>
      </div>
    );
  }

  const sideButtonClassName = cn(
    "h-full border font-semibold transition-colors duration-200",
    tradeSideButtonRadiusClassName,
    isMobile ? "text-[12px]" : "text-[13px]",
  );
  return (
    <div className="mt-2.5 grid h-[38px] w-full grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => setSide("BUY")}
        aria-pressed={isBuy}
        className={cn(
          sideButtonClassName,
          "text-trade-side-long-text",
          isBuy ? longActiveClassName : inactiveClassName,
        )}
      >
        {t("Buy / Long")}
      </button>
      <button
        type="button"
        onClick={() => setSide("SELL")}
        aria-pressed={!isBuy}
        className={cn(
          sideButtonClassName,
          "text-trade-side-short-text",
          isBuy ? inactiveClassName : shortActiveClassName,
        )}
      >
        {t("Sell / Short")}
      </button>
    </div>
  );
}

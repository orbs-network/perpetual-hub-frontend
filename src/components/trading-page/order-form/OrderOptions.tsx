import { useEffect, useState } from "react";
import BN from "bignumber.js";
import { Checkbox } from "../../ui/checkbox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../../ui/tooltip";
import { useOrderFormStore } from "../../../stores/orderFormStore";
import { useFormMarginInfo } from "@/hooks/order-form/useFormMarginInfo";
import { getTickSizeStep } from "@/utils/formatting";
import { ExitPriceRows } from "@/components/trading-page/ExitPriceRows";
import { cn } from "@/lib/utils";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { parseFiniteDecimal } from "@/utils/tpsl";
import { useAccountSymbolLeverage } from "@/hooks/useUserAccount";

function TpSlSection() {
  const { t } = useTranslation();
  const {
    side,
    attachedExitsResetKey,
    resetAttachedExits,
    setTakeProfitEnabled,
    setTakeProfitPrice,
    setTakeProfitLimitPrice,
    setStopLossEnabled,
    setStopLossPrice,
    setStopLossLimitPrice,
  } = useOrderFormStore();
  const { symbol, market } = useTradeSymbol();
  const { effectiveReduceOnly, marginInfo, selectedOrderPrice } =
    useFormMarginInfo();
  const { leverage } = useAccountSymbolLeverage(symbol);
  const pricePrecision = market?.pricePrecision ?? 2;
  const priceStep = getTickSizeStep(pricePrecision);
  const entryPrice = parseFiniteDecimal(selectedOrderPrice) ?? BN(0);
  const quantity = parseFiniteDecimal(marginInfo.derivedQuantity) ?? BN(0);

  const [tpSlEnabled, setTpSlEnabled] = useState(false);

  useEffect(() => {
    if (!effectiveReduceOnly) return;
    resetAttachedExits();
  }, [effectiveReduceOnly, resetAttachedExits]);

  const handleToggle = (enabled: boolean) => {
    if (effectiveReduceOnly && enabled) return;
    setTpSlEnabled(enabled);
    setTakeProfitLimitPrice("");
    setStopLossLimitPrice("");
    if (!enabled) {
      setTakeProfitEnabled(false);
      setTakeProfitPrice("");
      setStopLossEnabled(false);
      setStopLossPrice("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex items-center gap-1.5 text-[13px] w-fit",
          effectiveReduceOnly
            ? "text-content-muted cursor-not-allowed"
            : "text-content cursor-pointer",
        )}
      >
        <Checkbox
          checked={!effectiveReduceOnly && tpSlEnabled}
          disabled={effectiveReduceOnly}
          onCheckedChange={(value) => handleToggle(value === true)}
        />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{t("Take Profit / Stop Loss")}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {effectiveReduceOnly
                ? t("Attached TP/SL is only available on opening orders")
                : t(
                    "Attach TP/SL orders that trigger automatically when the price reaches your target. A market order is placed when the trigger price is hit.",
                  )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </label>

      {tpSlEnabled && !effectiveReduceOnly && (
        <ExitPriceRows
          pricePrecision={pricePrecision}
          priceStep={priceStep}
          entryPrice={entryPrice}
          quantity={quantity}
          isLong={side === "BUY"}
          leverage={leverage}
          resetKey={attachedExitsResetKey}
          onTpChange={(price, enabled) => {
            setTakeProfitPrice(price);
            setTakeProfitEnabled(enabled);
          }}
          onSlChange={(price, enabled) => {
            setStopLossPrice(price);
            setStopLossEnabled(enabled);
          }}
        />
      )}
    </div>
  );
}

export function OrderOptions() {
  const { t } = useTranslation();
  const { setReduceOnly } = useOrderFormStore();
  const { effectiveReduceOnly } = useFormMarginInfo();

  return (
    <div className={cn("flex flex-col gap-1")}>
      <label className="flex items-center gap-1.5 text-content cursor-pointer w-fit">
        <Checkbox
          checked={effectiveReduceOnly}
          onCheckedChange={(v) => setReduceOnly(v === true)}
        />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{t("Reduce Only")}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t(
                "The order size is capped to the current open position. If this side cannot reduce an open position, order submission is blocked.",
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </label>
      <TpSlSection />
    </div>
  );
}

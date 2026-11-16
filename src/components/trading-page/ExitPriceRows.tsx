import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { NumericInput } from "@/components/ui/numeric-input";
import { InlineSelect } from "@/components/ui/inline-select";
import { cn } from "@/lib/utils";
import {
  parseFiniteDecimal,
  type ExitGainLossUnit,
} from "@/utils/tpsl";
import BN from "bignumber.js";
import { useExitPriceRows } from "./useExitPriceRows";
import { useTranslation } from "@/hooks/useSafeTranslation";

export type { ExitGainLossUnit } from "@/utils/tpsl";

interface UnitSelectorProps {
  unit: ExitGainLossUnit;
  onUnitChange: (unit: ExitGainLossUnit) => void;
}

const EXIT_UNIT_OPTIONS = [
  { value: "%", label: "%" },
  { value: "USDC", label: "$" },
] as const;

function UnitSelector({ unit, onUnitChange }: UnitSelectorProps) {
  return (
    <InlineSelect
      value={unit}
      options={EXIT_UNIT_OPTIONS}
      onValueChange={onUnitChange}
      triggerClassName="gap-0.5"
      contentClassName="min-w-16"
      onTriggerClick={(e) => e.stopPropagation()}
    />
  );
}

interface ExitInputProps {
  label: string;
  value: string;
  decimalScale: number;
  step?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  endAdornment?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  labelColor?: string;
  allowNegative?: boolean;
  hideMobileLabelWhenFilled?: boolean;
  mobileCompactLabel?: string;
}

function ExpectedValuePreview({
  label,
  value,
  sign = "preserve",
}: {
  label: string;
  value: string;
  sign?: "preserve" | "positive" | "negative";
}) {
  const { t } = useTranslation();
  if (!value) return null;

  const amount = parseFiniteDecimal(value);
  if (!amount) return null;

  const displayAmount =
    sign === "positive"
      ? amount.abs()
      : sign === "negative"
        ? amount.abs().negated()
        : amount;

  return (
    <div className="text-right text-[12px] text-content-muted min-[380px]:col-span-2">
      {t(label)}: {displayAmount.toFixed(2)} {getCollateralSymbol()}
    </div>
  );
}

function ExitInput({
  label,
  value,
  decimalScale,
  step,
  placeholder = "",
  onChange,
  endAdornment,
  prefix,
  suffix,
  allowNegative,
  hideMobileLabelWhenFilled,
  mobileCompactLabel,
}: ExitInputProps) {
  const { t } = useTranslation();
  const shouldHideMobileLabel =
    hideMobileLabelWhenFilled && value.trim() !== "";
  const shouldUseCompactMobileLabel = Boolean(mobileCompactLabel);

  return (
    <NumericInput
      size="sm"
      value={value}
      onValueChange={(v, sourceInfo) => {
        if (sourceInfo.source !== "event") return;
        onChange(v.value);
      }}
      placeholder={placeholder}
      decimalScale={decimalScale}
      step={step}
      prefix={prefix}
      suffix={suffix}
      allowNegative={allowNegative}
      className="text-right flex-1 pl-2 !text-[12px]"
      wrapperClassName="h-[33px]"
      startContent={
        <span
          className={cn(
            "text-[12px]",
            shouldHideMobileLabel && "hidden md:inline",
          )}
        >
          {shouldUseCompactMobileLabel ? (
            <>
              <span className="md:hidden">
                {t(mobileCompactLabel ?? label)}
              </span>
              <span className="hidden md:inline">
                {t(label)}
              </span>
            </>
          ) : (
            t(label)
          )}
        </span>
      }
      endContent={
        endAdornment ? (
          <span className="flex items-center">
            {endAdornment}
          </span>
        ) : undefined
      }
    />
  );
}

// --- Stateful ExitPriceRows (manages its own TP/SL state) ---

export interface ExitPriceRowsProps {
  className?: string;
  showTakeProfit?: boolean;
  showStopLoss?: boolean;
  showExpectedValues?: boolean;
  pricePrecision: number;
  priceStep?: string;
  entryPrice: BN;
  quantity: BN;
  isLong: boolean;
  leverage: number;
  initialTpPrice?: string;
  initialSlPrice?: string;
  resetKey?: number;
  onTpChange?: (price: string, enabled: boolean) => void;
  onSlChange?: (price: string, enabled: boolean) => void;
}

export function ExitPriceRows({
  resetKey = 0,
  ...props
}: ExitPriceRowsProps) {
  return <ExitPriceRowsContent key={resetKey} {...props} />;
}

function ExitPriceRowsContent({
  className,
  showTakeProfit = true,
  showStopLoss = true,
  showExpectedValues = false,
  pricePrecision,
  priceStep,
  entryPrice,
  quantity,
  isLong,
  leverage,
  initialTpPrice = "",
  initialSlPrice = "",
  onTpChange,
  onSlChange,
}: Omit<ExitPriceRowsProps, "resetKey">) {
  const { takeProfit, stopLoss } = useExitPriceRows({
    entryPrice,
    quantity,
    isLong,
    pricePrecision,
    leverage,
    initialTpPrice,
    initialSlPrice,
    showExpectedValues,
    onTpChange,
    onSlChange,
  });
  const stopLossPrice = parseFiniteDecimal(stopLoss.price);
  const stopLossIsNonLoss = Boolean(
    stopLossPrice &&
      (isLong
        ? stopLossPrice.gte(entryPrice)
        : stopLossPrice.lte(entryPrice)),
  );
  const stopLossMetric = stopLossIsNonLoss
    ? stopLoss.metric.replace(/^-/, "")
    : stopLoss.metric;

  const handleStopLossMetricChange = (value: string) => {
    const amount = parseFiniteDecimal(value);
    if (!stopLossIsNonLoss || !amount || amount.lte(0)) {
      stopLoss.onMetricChange(value);
      return;
    }

    stopLoss.onMetricChange(`-${value.replace(/^\+/, "")}`);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showTakeProfit && (
        <div className="grid items-center gap-2 grid-cols-2">
          <ExitInput
            label="TP Price"
            value={takeProfit.price}
            decimalScale={pricePrecision}
            step={priceStep}
            onChange={takeProfit.onPriceChange}
            mobileCompactLabel={
              takeProfit.source === "metric" && takeProfit.price ? "TP" : undefined
            }
          />
          <ExitInput
            label="Gain"
            value={takeProfit.metric}
            decimalScale={2}
            allowNegative
            onChange={takeProfit.onMetricChange}
            hideMobileLabelWhenFilled
            endAdornment={
              <UnitSelector
                unit={takeProfit.unit}
                onUnitChange={takeProfit.onUnitChange}
              />
            }
          />
          {showExpectedValues && (
            <ExpectedValuePreview
              label="Expected profit"
              value={takeProfit.expectedUsdc}
            />
          )}
        </div>
      )}
      {showStopLoss && (
        <div className="grid grid-cols-2 items-center gap-2">
          <ExitInput
            label="SL Price"
            value={stopLoss.price}
            decimalScale={pricePrecision}
            step={priceStep}
            onChange={stopLoss.onPriceChange}
            mobileCompactLabel={
              stopLoss.source === "metric" && stopLoss.price ? "SL" : undefined
            }
          />
          <ExitInput
            label={stopLossIsNonLoss ? "Gain" : "Loss"}
            value={stopLossMetric}
            decimalScale={2}
            allowNegative
            onChange={handleStopLossMetricChange}
            hideMobileLabelWhenFilled
            endAdornment={
              <UnitSelector
                unit={stopLoss.unit}
                onUnitChange={stopLoss.onUnitChange}
              />
            }
          />
          {showExpectedValues && (
            <ExpectedValuePreview
              label={
                stopLossIsNonLoss ? "Expected profit" : "Expected loss"
              }
              value={stopLoss.expectedUsdc}
              sign={stopLossIsNonLoss ? "positive" : "negative"}
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- Limit price rows (stateless, controlled) ---

interface ExitLimitPriceRowsProps {
  className?: string;
  showTakeProfit?: boolean;
  showStopLoss?: boolean;
  pricePrecision: number;
  priceStep?: string;
  takeProfitLimitPrice: string;
  stopLossLimitPrice: string;
  onTakeProfitLimitPriceChange: (value: string) => void;
  onStopLossLimitPriceChange: (value: string) => void;
}

export function ExitLimitPriceRows({
  className,
  showTakeProfit = true,
  showStopLoss = true,
  pricePrecision,
  priceStep,
  takeProfitLimitPrice,
  stopLossLimitPrice,
  onTakeProfitLimitPriceChange,
  onStopLossLimitPriceChange,
}: ExitLimitPriceRowsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-2 w-full",
        showTakeProfit && showStopLoss && "min-[380px]:grid-cols-2",
        className,
      )}
    >
      {showTakeProfit && (
        <ExitInput
          label="TP Limit"
          value={takeProfitLimitPrice}
          decimalScale={pricePrecision}
          step={priceStep}
          placeholder="0.00"
          onChange={onTakeProfitLimitPriceChange}
          labelColor="text-accent-primary"
        />
      )}
      {showStopLoss && (
        <ExitInput
          label="SL Limit"
          value={stopLossLimitPrice}
          decimalScale={pricePrecision}
          step={priceStep}
          placeholder="0.00"
          onChange={onStopLossLimitPriceChange}
          labelColor="text-accent-primary"
        />
      )}
    </div>
  );
}

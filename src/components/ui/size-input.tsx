import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { NumericInput } from "./numeric-input";
import { Slider } from "./slider";
import { InlineSelect, type InlineSelectOption } from "./inline-select";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";
import { getSizeInputSecondaryValue } from "@/utils/sizeInputCounterpart";

export type SizeUnit = "asset" | "usd";

const buildSizeUnitOptions = (baseAsset: ReactNode, collateralSymbol: string): InlineSelectOption<SizeUnit>[] => [
  { value: "asset", label: baseAsset },
  { value: "usd", label: collateralSymbol },
];

type SizeInputRowProps = {
  decimalScale?: number;
  focused: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  isLarge: boolean;
  isSizeEntryDisabled: boolean;
  label: string;
  onInputChange: (value: string) => void;
  onSizeUnitChange: (unit: SizeUnit) => void;
  secondaryValue?: ReactNode;
  setFocused: (focused: boolean) => void;
  sizeUnit: SizeUnit;
  sizeUnitOptions: InlineSelectOption<SizeUnit>[];
  value: string;
};

function DefaultSizeInputRow({
  decimalScale,
  focused,
  inputRef,
  isLarge,
  isSizeEntryDisabled,
  label,
  onInputChange,
  onSizeUnitChange,
  setFocused,
  sizeUnit,
  sizeUnitOptions,
  value,
}: SizeInputRowProps) {
  return (
    <div
      className={`relative mb-2 flex items-center rounded-[6px] border bg-input-bg transition-colors ${
        isSizeEntryDisabled ? "cursor-not-allowed opacity-60" : "cursor-text"
      } ${
        focused ? "border-content-muted" : "border-edge"
      }`}
      onClick={() => {
        if (!isSizeEntryDisabled) inputRef.current?.focus();
      }}
    >
      <span className={`pointer-events-none select-none whitespace-nowrap text-content-secondary ${isLarge ? "pl-3 text-[12px]" : "pl-2.5 text-[12px]"}`}>
        {label}
      </span>
      <NumericInput
        key={sizeUnit}
        ref={inputRef}
        size={isLarge ? "default" : "sm"}
        placeholder="0.00"
        decimalScale={decimalScale}
        disabled={isSizeEntryDisabled}
        value={value}
        onValueChange={(values, sourceInfo) => {
          if (isSizeEntryDisabled) return;
          if (sourceInfo.source !== "event") return;
          onInputChange(values.value);
        }}
        onFocus={(e) => {
          if (isSizeEntryDisabled) return;
          setFocused(true);
          const el = e.currentTarget;
          requestAnimationFrame(() => {
            el.setSelectionRange(el.value.length, el.value.length);
          });
        }}
        onBlur={() => {
          setFocused(false);
        }}
        className={`min-w-0 flex-1 rounded-none border-0 bg-transparent pl-2 pr-0 text-right placeholder:text-content-secondary ${isLarge ? "!text-sm" : "!text-[13px]"}`}
      />
      <div className="w-[10px]" />
      <InlineSelect
        value={sizeUnit}
        options={sizeUnitOptions}
        onValueChange={onSizeUnitChange}
        disabled={isSizeEntryDisabled}
        triggerClassName="px-2 text-content [&_svg]:text-content-secondary"
        contentClassName="min-w-20"
        onTriggerClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function InlineSizeInputRow({
  decimalScale,
  focused,
  inputRef,
  isLarge,
  isSizeEntryDisabled,
  label,
  onInputChange,
  onSizeUnitChange,
  secondaryValue,
  setFocused,
  sizeUnit,
  sizeUnitOptions,
  value,
}: SizeInputRowProps) {
  const showSecondaryValue = Boolean(secondaryValue);

  return (
    <div
      className={`relative mb-2 flex items-center rounded-[6px] border bg-input-bg transition-colors ${
        isSizeEntryDisabled ? "cursor-not-allowed opacity-60" : "cursor-text"
      } ${
        focused ? "border-content-muted" : "border-edge"
      }`}
      onClick={() => {
        if (!isSizeEntryDisabled) inputRef.current?.focus();
      }}
    >
      <span className={`pointer-events-none select-none whitespace-nowrap text-content-secondary ${isLarge ? "pl-3 text-[12px]" : "pl-2.5 text-[12px]"}`}>
        {label}
      </span>
      <span aria-hidden="true" className="mx-2 h-3.5 w-px shrink-0 bg-edge" />
      <NumericInput
        key={sizeUnit}
        ref={inputRef}
        size={isLarge ? "default" : "sm"}
        placeholder="0.00"
        decimalScale={decimalScale}
        disabled={isSizeEntryDisabled}
        value={value}
        onValueChange={(values, sourceInfo) => {
          if (isSizeEntryDisabled) return;
          if (sourceInfo.source !== "event") return;
          onInputChange(values.value);
        }}
        onFocus={(e) => {
          if (isSizeEntryDisabled) return;
          setFocused(true);
          const el = e.currentTarget;
          requestAnimationFrame(() => {
            el.setSelectionRange(el.value.length, el.value.length);
          });
        }}
        onBlur={() => {
          setFocused(false);
        }}
        className={`min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-left placeholder:text-content-secondary ${isLarge ? "!text-sm" : "!text-[13px]"}`}
      />
      {showSecondaryValue && (
        <span className="pointer-events-none mr-2 shrink-0 whitespace-nowrap text-[13px] text-content-muted">
          {secondaryValue}
        </span>
      )}
      {showSecondaryValue ? (
        <span aria-hidden="true" className="mr-2 h-5 w-px shrink-0 bg-edge" />
      ) : (
        <div className="w-[10px]" />
      )}
      <InlineSelect
        value={sizeUnit}
        options={sizeUnitOptions}
        onValueChange={onSizeUnitChange}
        disabled={isSizeEntryDisabled}
        triggerClassName="px-2 text-content [&_svg]:text-content-secondary"
        contentClassName="min-w-20"
        onTriggerClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export interface SizeInputProps {
  /** Current display value in the active unit */
  value: string;
  /** Current slider/percent value (0-100) */
  percent: number;
  /** Called when the slider or percent input changes */
  onPercentChange: (pct: number) => void;
  /** Called when the user types a quantity/USD value */
  onInputChange: (value: string) => void;
  /** Base asset name (e.g. "ETH", "BTC") */
  baseAsset: string;
  /** Current size unit */
  sizeUnit: SizeUnit;
  /** Called when unit switches */
  onSizeUnitChange: (unit: SizeUnit) => void;
  /** "compact" for order form, "large" for modals */
  variant?: "compact" | "large";
  /** Optional className for the outer wrapper */
  className?: string;
  decimalScale?: number;
  hideInput?: boolean;
  counterpartPrice?: number | string;
}

export function SizeInput({
  value,
  percent,
  onPercentChange,
  onInputChange,
  baseAsset,
  sizeUnit,
  onSizeUnitChange,
  variant = "compact",
  className,
  decimalScale,
  hideInput,
  counterpartPrice,
}: SizeInputProps) {
  const { t } = useTranslation();
  const isLarge = variant === "large";
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const inlineLayout = partner.featureFlags?.orderSizeInlineCounterpart === true;
  const isSizeEntryDisabled =
    !Number.isFinite(decimalScale) ||
    decimalScale === undefined ||
    decimalScale < 0;
  const secondaryValue = useMemo(
    () => {
      if (
        !inlineLayout ||
        counterpartPrice === undefined ||
        decimalScale === undefined ||
        !Number.isFinite(decimalScale) ||
        decimalScale < 0
      ) {
        return undefined;
      }

      return getSizeInputSecondaryValue({
        baseAsset,
        precision: decimalScale,
        price: counterpartPrice,
        sizeUnit,
        sizeValue: value,
      });
    },
    [
      baseAsset,
      counterpartPrice,
      decimalScale,
      inlineLayout,
      sizeUnit,
      value,
    ],
  );
  const collateralSymbol = getCollateralSymbol();
  const sizeUnitOptions = useMemo(
    () => buildSizeUnitOptions(baseAsset, collateralSymbol),
    [baseAsset, collateralSymbol],
  );
  const SizeInputRow = inlineLayout ? InlineSizeInputRow : DefaultSizeInputRow;

  const handleUnitSwitch = (unit: SizeUnit) => {
    if (isSizeEntryDisabled) return;
    setFocused(false);
    onSizeUnitChange(unit);
  };

  return (
    <div className={cn("w-full", className)}>
      {!hideInput && (
        <SizeInputRow
          decimalScale={decimalScale}
          focused={focused}
          inputRef={inputRef}
          isLarge={isLarge}
          isSizeEntryDisabled={isSizeEntryDisabled}
          label={t("Size")}
          onInputChange={onInputChange}
          onSizeUnitChange={handleUnitSwitch}
          secondaryValue={secondaryValue}
          setFocused={setFocused}
          sizeUnit={sizeUnit}
          sizeUnitOptions={sizeUnitOptions}
          value={value}
        />
      )}
      <div className={`flex items-center gap-2`}>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[Math.min(percent, 100)]}
          onValueChange={([v]) => {
            if (isSizeEntryDisabled) return;
            onPercentChange(v);
          }}
          disabled={isSizeEntryDisabled}
          showDots
          className="flex-1"
        />
        <NumericInput
          size={isLarge ? "default" : "sm"}
          placeholder="0%"
          value={Math.min(percent, 100) || ""}
          disabled={isSizeEntryDisabled}
          onValueChange={(values, sourceInfo) => {
            if (isSizeEntryDisabled) return;
            if (sourceInfo.source !== "event") return;
            onPercentChange(values.floatValue ?? 0);
          }}
          decimalScale={0}
          min={0}
          max={100}
          step={1}
          suffix="%"
          className={`border border-edge rounded-[6px] px-1.5 text-center placeholder:text-content-secondary ${isLarge ? "w-[72px] h-[33px] !text-sm" : "w-[60px] h-[33px] !text-[13px]"}`}
        />
      </div>
    </div>
  );
}

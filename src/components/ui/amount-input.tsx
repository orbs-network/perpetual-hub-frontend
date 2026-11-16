import type { ReactNode } from "react";
import { NumericInput } from "./numeric-input";
import { Button } from "./button";

interface AmountInputProps {
  value: string;
  onValueChange: (value: string, source: "event" | "prop") => void;
  maxLabel: ReactNode;
  onMaxClick: () => void;
  disabled?: boolean;
  placeholder?: string;
  focusColor?: "blue" | "buy" | "sell";
}

export function AmountInput({
  value,
  onValueChange,
  maxLabel,
  onMaxClick,
  disabled,
  placeholder = "0.00",
  focusColor,
}: AmountInputProps) {
  return (
    <NumericInput
      value={value}
      onValueChange={(v, info) => onValueChange(v.value, info.source)}
      disabled={disabled}
      placeholder={placeholder}
      focusColor={focusColor}
      className="pr-2"
      endContent={
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={onMaxClick}
          disabled={disabled}
          className="border-none text-[12px] font-semibold text-content hover:text-content"
        >
          {maxLabel}
        </Button>
      }
    />
  );
}

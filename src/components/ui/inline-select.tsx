import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

export interface InlineSelectOption<Value extends string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
}

interface InlineSelectProps<Value extends string> {
  value: Value;
  options: readonly InlineSelectOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  contentContainer?: ComponentProps<typeof SelectContent>["container"];
  itemClassName?: string;
  onTriggerClick?: MouseEventHandler<HTMLButtonElement>;
}

export function InlineSelect<Value extends string>({
  value,
  options,
  onValueChange,
  disabled,
  ariaLabel,
  triggerClassName,
  contentClassName,
  contentContainer,
  itemClassName,
  onTriggerClick,
}: InlineSelectProps<Value>) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as Value)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "group/unit h-auto w-auto shrink-0 gap-1 border-0 bg-transparent py-1 pl-1 pr-0 text-[12px] font-medium text-content-secondary shadow-none focus:border-transparent hover:text-content data-[state=open]:text-content disabled:text-content-muted [&_svg]:h-[13px] [&_svg]:w-[13px] [&_svg]:text-content-muted",
          triggerClassName,
        )}
        onClick={onTriggerClick}
      >
        <SelectValue>{selectedOption?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className={contentClassName} container={contentContainer}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={itemClassName}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

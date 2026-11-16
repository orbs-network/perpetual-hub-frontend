import type { Ref } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DashboardSearchInputProps = {
  ariaLabel: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  placeholder: string;
  showClearButton?: boolean;
  showSearchIcon?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function DashboardSearchInput({
  ariaLabel,
  className,
  defaultValue,
  disabled,
  inputRef,
  placeholder,
  showClearButton = true,
  showSearchIcon = true,
  value,
  onValueChange,
}: DashboardSearchInputProps) {
  const hasValue = value?.trim().length;
  const clearButton =
    showClearButton && hasValue && onValueChange ? (
      <button
        aria-label={`Clear ${ariaLabel.toLowerCase()}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-content-muted transition-colors hover:bg-hover hover:text-content disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        onClick={() => onValueChange("")}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    ) : null;
  const hasAdornment = showSearchIcon || Boolean(clearButton);
  const containerClassName = cn(
    "h-8 w-full min-w-[220px] max-w-[360px] border-edge/70 bg-raised/35",
    className,
  );

  return (
    <Input
      aria-label={ariaLabel}
      autoComplete="off"
      className={cn(
        "h-8 appearance-none px-2 text-[13px] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
        !hasAdornment && containerClassName,
      )}
      defaultValue={defaultValue}
      disabled={disabled}
      endContent={clearButton}
      inputSize="sm"
      placeholder={placeholder}
      ref={inputRef}
      startContent={
        showSearchIcon ? <Search className="h-3.5 w-3.5" /> : undefined
      }
      type="search"
      value={value}
      wrapperClassName={hasAdornment ? containerClassName : undefined}
      onChange={
        onValueChange
          ? (event) => onValueChange(event.currentTarget.value)
          : undefined
      }
    />
  );
}

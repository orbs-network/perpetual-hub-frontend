import * as React from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useSafeTranslation";

export type InputSize = "default" | "sm";
export type InputFocusColor = "blue" | "buy" | "sell";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
  focusColor?: InputFocusColor;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  wrapperClassName?: string;
}

const inputSizeStyles: Record<InputSize, string> = {
  default: "h-8 px-2 text-[16px] md:text-[13px] rounded-[6px]",
  sm: "h-8 px-2 text-[16px] md:text-[13px] rounded-[6px]",
};

const inputFocusStyles: Record<InputFocusColor, string> = {
  blue: "focus:border-accent-primary",
  buy: "focus:border-up",
  sell: "focus:border-down",
};

function inputClassName({
  inputSize = "default",
  focusColor,
  className,
  hasStart,
  hasEnd,
}: {
  inputSize?: InputSize;
  focusColor?: InputFocusColor;
  className?: string;
  hasStart?: boolean;
  hasEnd?: boolean;
}) {
  return cn(
    "w-full text-content placeholder:text-content-muted/55 outline-none transition-colors focus:outline-none focus:ring-0 disabled:opacity-50",
    hasStart || hasEnd
      ? "border-0 bg-transparent"
      : "border border-edge bg-input-bg focus:border-content-muted",
    inputSizeStyles[inputSize],
    focusColor && !hasStart && !hasEnd ? inputFocusStyles[focusColor] : null,
    className,
  );
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      inputSize = "default",
      focusColor,
      startContent,
      endContent,
      wrapperClassName,
      placeholder,
      ...props
    },
    ref,
  ) => {
  const { t } = useTranslation();
    if (startContent || endContent) {
      return (
        <div
          className={cn(
            "relative flex w-full items-center rounded-[6px] border border-edge bg-input-bg transition-colors focus-within:border-content-muted",
            focusColor === "blue" && "focus-within:border-accent-primary",
            focusColor === "buy" && "focus-within:border-up",
            focusColor === "sell" && "focus-within:border-down",
            wrapperClassName,
          )}
        >
          {startContent && (
            <span className="pointer-events-none shrink-0 select-none pl-2.5 text-[12px] text-content-secondary">
              {startContent}
            </span>
          )}
          <input
            ref={ref}
            placeholder={
              typeof placeholder === "string"
                ? t(placeholder)
                : placeholder
            }
            className={inputClassName({
              inputSize,
              focusColor,
              className,
              hasStart: !!startContent,
              hasEnd: !!endContent,
            })}
            {...props}
          />
          {endContent && (
            <span className="shrink-0 pr-2">
              {endContent}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        placeholder={
          typeof placeholder === "string" ? t(placeholder) : placeholder
        }
        className={inputClassName({ inputSize, focusColor, className })}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

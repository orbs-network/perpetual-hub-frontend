/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "app-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-button-primary text-content-inverse hover:bg-button-primary-hover disabled:opacity-40",
        themed: "border border-[var(--color-button-primary-border)] bg-[var(--color-button-primary-bg)] text-content-inverse hover:bg-[var(--color-button-primary-bg-hover)] disabled:border-[var(--color-button-primary-disabled-border)] disabled:bg-[var(--color-button-primary-disabled-bg)] disabled:opacity-100",
        tradeLong: "bg-button-primary text-trade-long-text hover:bg-button-primary-hover disabled:opacity-40",
        themedTradeLong: "border border-[var(--color-button-primary-border)] bg-[var(--color-button-primary-bg)] text-trade-long-text hover:bg-[var(--color-button-primary-bg-hover)] disabled:border-[var(--color-button-primary-disabled-border)] disabled:bg-[var(--color-button-primary-disabled-bg)] disabled:opacity-100",

        positive: "bg-up text-content-on-up hover:bg-up/80 disabled:bg-up/40 disabled:text-content-muted disabled:opacity-100",
        tradeShort: "bg-short text-trade-short-text hover:bg-short-hover disabled:bg-short/40 disabled:text-content-muted disabled:opacity-100",
        destructive: "bg-down text-content-on-down hover:bg-down/90 disabled:opacity-40",
        outline: "border border-edge bg-transparent text-content hover:bg-hover disabled:opacity-40",
        secondary: "bg-button-secondary text-content hover:bg-button-secondary-hover disabled:opacity-40",
        themedSecondary: "border border-button-secondary-border bg-button-secondary text-content hover:bg-button-secondary-hover disabled:opacity-40",
        ghost: "text-content hover:text-content-secondary hover:bg-hover disabled:opacity-40",
        warning: "border border-warning/40 text-warning hover:bg-warning/15 disabled:opacity-40",
        amber: "bg-warning/20 border border-warning/50 text-warning font-bold hover:bg-warning/30",
        yellow: "bg-warning text-content-on-warning hover:bg-warning/80 disabled:bg-warning/50",
        muted: "bg-hover text-content-muted hover:bg-edge disabled:opacity-40",
      },
      size: {
        default: "h-[33px] px-4 text-[13px]",
        sm: "h-8 px-3 text-[12px]",
        xs: "h-6 px-2 text-[11px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        data-variant={variant ?? "default"}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

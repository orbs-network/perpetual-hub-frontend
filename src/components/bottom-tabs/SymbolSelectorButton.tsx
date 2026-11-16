import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { getDisplaySymbol, cn } from "@/lib/utils";
import { useSelectTradeSymbol } from "@/hooks/useSelectTradeSymbol";

interface SymbolSelectorButtonProps {
  symbol: string | null | undefined;
  children?: ReactNode;
  className?: string;
  isClose?: boolean;
  tone?: "auto" | "content";
}


export function SymbolSelectorButton({
  symbol,
  children,
  className,
  isClose = false,
  tone = "auto",
}: SymbolSelectorButtonProps) {
  const { t } = useTranslation();
  const selectTradeSymbol = useSelectTradeSymbol();

  if (!symbol) {
    return <span className={className}>-</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        selectTradeSymbol(symbol);
      }}
      title={`${t("Select")} ${symbol}`}
      className={cn(
        "transition-colors focus-visible:outline-none",
        className,
        tone === "content"
          ? "text-content hover:text-content focus-visible:text-content"
          : isClose
            ? "text-down-light hover:text-down focus-visible:text-down"
            : "text-up-light hover:text-up focus-visible:text-up",
      )}
    >
      {children ?? getDisplaySymbol(symbol)}
    </button>
  );
}

import { LeverageModal } from "../../LeverageModal";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAccountSymbolLeverage } from "@/hooks/useUserAccount";
import { SkeletonContainer } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTradeSymbol } from "@/hooks/useSelectTradeSymbol";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function DesktopLeverageModal() {
  const { t } = useTranslation();
  const {symbol} = useTradeSymbol();
  const { leverage, isLoading } = useAccountSymbolLeverage(symbol);

  const isMobile = useIsMobile();

  if (isMobile) return null;

  return (
    <div className="flex items-center justify-between mb-3 mt-2">
      <span className="text-[13px] text-content-secondary">{t("Leverage")}</span>
      <SkeletonContainer isLoading={isLoading}>
        <LeverageModal
          leverage={leverage}
          symbol={symbol}
          label={`${symbol} Leverage`}
          trigger={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1 px-4 pr-3 text-[14px]"
            >
              {leverage || '20'}x
              <ChevronDown size={18} className="text-content-muted" />
            </Button>
          }
        />
      </SkeletonContainer>
    </div>
  );
}

export const MobileLeverageModal = () => {
  const {symbol} = useTradeSymbol();
  const { leverage, isLoading } = useAccountSymbolLeverage(symbol);

  return (
    <SkeletonContainer isLoading={isLoading}>
      <LeverageModal
        leverage={leverage}
        symbol={symbol}
        label={`${symbol} Leverage`}
        trigger={
          <button
            type="button"
            className="inline-flex h-9 min-w-[86px] shrink-0 items-center justify-center gap-2 rounded border border-edge px-4 text-[13px] font-semibold text-content transition-colors"
          >
            {leverage}x
            <ChevronDown size={14} className="text-content-muted" />
          </button>
        }
      />
    </SkeletonContainer>
  );
};

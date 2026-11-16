import { MonitorSmartphone } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { ShareQRModal } from "@/components/ShareQRModal";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HeaderTradeOnMobileButton() {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <ShareQRModal
          trigger={
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-full w-8 rounded border border-edge text-content-secondary hover:text-content"
              >
                <MonitorSmartphone size={16} />
              </Button>
            </TooltipTrigger>
          }
        />
        <TooltipContent>{t("header.tradeOnMobile")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

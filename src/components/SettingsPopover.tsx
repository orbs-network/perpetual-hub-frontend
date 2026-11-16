import { Settings } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { Button } from "./ui/button";

export function SettingsPopover() {
  const { t } = useTranslation();
  const {
    skipOpenOrderConfirm,
    skipClosePositionConfirm,
    showBuysSellsOnChart,
    hidePnl,
    setSkipOpenOrderConfirm,
    setSkipClosePositionConfirm,
    setShowBuysSellsOnChart,
    setHidePnl,
  } = useUserPreferencesStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("settings.selectorLabel")}
          className="h-full w-8 rounded border border-edge text-content-secondary hover:text-content"
        >
          <Settings size={13} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5 bg-base border-edge" align="end">
        <label className="flex items-center justify-between px-2 py-2 rounded hover:bg-hover transition-colors cursor-pointer">
          <span className="text-[12px] text-content-secondary">
            {t("settings.skipOpenOrderConfirm")}
          </span>
          <Checkbox checked={skipOpenOrderConfirm} onCheckedChange={(v) => setSkipOpenOrderConfirm(v === true)} />
        </label>
        <label className="flex items-center justify-between px-2 py-2 rounded hover:bg-hover transition-colors cursor-pointer">
          <span className="text-[12px] text-content-secondary">
            {t("settings.skipClosePositionConfirm")}
          </span>
          <Checkbox checked={skipClosePositionConfirm} onCheckedChange={(v) => setSkipClosePositionConfirm(v === true)} />
        </label>
        <label className="flex items-center justify-between gap-3 px-2 py-2 rounded hover:bg-hover transition-colors cursor-pointer">
          <span className="text-[12px] text-content-secondary">
            {t("settings.hidePnl")}
          </span>
          <Checkbox checked={hidePnl} onCheckedChange={(v) => setHidePnl(v === true)} />
        </label>
        <label className="flex items-center justify-between gap-3 px-2 py-2 rounded hover:bg-hover transition-colors cursor-pointer">
          <span className="text-[12px] text-content-secondary">
            {t("settings.showBuysSellsOnChart")}
          </span>
          <Checkbox checked={showBuysSellsOnChart} onCheckedChange={(v) => setShowBuysSellsOnChart(v === true)} />
        </label>
      </PopoverContent>
    </Popover>
  );
}

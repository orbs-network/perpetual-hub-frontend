import { useCallback } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../ui/select";
import { useOrderFormStore } from "../../../stores/orderFormStore";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { MobileLeverageModal } from "./LeverageModals";
import { TradingTabs, type TradingTabOption } from "@/components/TradingTabs";
import type { UIOrderType } from "@/types";
import { useOrderForm } from "@/hooks/order-form/useOrderForm";
import { useTranslation } from "@/hooks/useSafeTranslation";

const ORDER_TYPE_LABELS: Record<UIOrderType, string> = {
  MARKET: "Market",
  LIMIT: "Limit",
};

const ORDER_TYPE_TABS: { value: UIOrderType; label: string }[] = [
  { value: "MARKET", label: "Market" },
  { value: "LIMIT", label: "Limit" },
];

export function OrderTypeTabs() {
  const { t } = useTranslation();
  const { uiOrderType, setUiOrderType, price, setPrice } = useOrderFormStore();
  const isMobile = useIsMobile();
  const { marginPayload } = useOrderForm();
  const { currentPrice } = marginPayload;
  const translatedOrderTypeTabs: TradingTabOption<UIOrderType>[] =
    ORDER_TYPE_TABS.map((tab) => ({
      ...tab,
      label: t(tab.label),
    }));

  const onSelect = useCallback(
    (value: string) => {
      const nextOrderType = value as UIOrderType;
      if (nextOrderType === "LIMIT" && price === "" && currentPrice > 0) {
        setPrice(currentPrice.toString());
      }
      setUiOrderType(nextOrderType);
    },
    [setUiOrderType, price, currentPrice, setPrice],
  );

  if (isMobile) {
    return (
      <div className="flex items-center gap-2">
        <Select value={uiOrderType} onValueChange={onSelect}>
          <SelectTrigger
            aria-label={t("Order type")}
            className="min-w-0 flex-1"
          >
            <SelectValue>{t(ORDER_TYPE_LABELS[uiOrderType])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ORDER_TYPE_LABELS) as UIOrderType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {t(ORDER_TYPE_LABELS[type])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MobileLeverageModal />
      </div>
    );
  }

  return (
    <TradingTabs
      value={uiOrderType}
      tabs={translatedOrderTypeTabs}
      onValueChange={onSelect}
    />
  );
}

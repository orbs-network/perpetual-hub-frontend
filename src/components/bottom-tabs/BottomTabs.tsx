import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TradingTabs, type TradingTabOption } from "@/components/TradingTabs";
import { TabsContent } from "@/components/ui/tabs";
import { useUserAccount } from "@/hooks/useUserAccount";
import { PositionsTable } from "./PositionsTable";
import { OrdersTable } from "./OrdersTable";
import { OrderHistoryTable } from "./OrderHistoryTable";
import { TradeHistoryTable } from "./TradeHistoryTable";
import { FundingHistoryTable } from "./FundingHistoryTable";
import { TransactionsTable } from "./TransactionsTable";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useFillAvailableHeight } from "@/hooks/useFillAvailableHeight";
import { DEFAULT_BOTTOM_TAB_VALUES } from "@/lib/bottomTabs";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useIsPortfolioReadOnly } from "@/hooks/usePortfolioAddress";

type TabType =
  | "positions"
  | "openOrders"
  | "orderHistory"
  | "tradeHistory"
  | "fundingHistory"
  | "depositsWithdrawals"
  | "assets";

export interface BottomTabConfig {
  value: string;
  label: string;
  mobileLabel: string;
  count?: number;
  content: ReactNode;
}

const BOTTOM_TABS_FILL_HEIGHT_VAR = "--bottom-tabs-fill-height";

type BottomTabsContentStyle = CSSProperties & {
  "--bottom-tabs-fill-height"?: string;
};

// --- Main component ---

export function BottomTabs({
  className = "",
  tabs,
  defaultValue,
  contentHeight,
  fillAvailableSpace = false,
  fillBottomOffset = 50,
  fillMinHeight = 200,
  value,
  onValueChange,
  persistenceKey = "trading",
}: {
  className?: string;
  tabs?: BottomTabConfig[];
  defaultValue?: string;
  contentHeight?: number | string;
  fillAvailableSpace?: boolean;
  fillBottomOffset?: number;
  fillMinHeight?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  persistenceKey?: string;
}) {
  const { t } = useTranslation();
  const { data: userAccount } = useUserAccount();
  const readOnly = useIsPortfolioReadOnly();
  const persistedValue = useUserPreferencesStore(
    (state) => state.selectedBottomTabs[persistenceKey],
  );
  const setSelectedBottomTab = useUserPreferencesStore(
    (state) => state.setSelectedBottomTab,
  );

  const defaultTabs: BottomTabConfig[] = useMemo(
    () => [
      {
        value: "positions" satisfies TabType,
        label: "Positions",
        mobileLabel: "Positions",
        count: userAccount?.positions.length ?? 0,
        content: <PositionsTable readOnly={readOnly} />,
      },
      {
        value: "openOrders" satisfies TabType,
        label: "Open Orders",
        mobileLabel: "Orders",
        count: userAccount?.orders.length ?? 0,
        content: <OrdersTable readOnly={readOnly} />,
      },
      {
        value: "tradeHistory" satisfies TabType,
        label: "Trade History",
        mobileLabel: "Trades",
        content: <TradeHistoryTable />,
      },
      {
        value: "fundingHistory" satisfies TabType,
        label: "Funding History",
        mobileLabel: "Funding",
        content: <FundingHistoryTable />,
      },
      {
        value: "orderHistory" satisfies TabType,
        label: "Order History",
        mobileLabel: "History",
        content: <OrderHistoryTable />,
      },
      {
        value: "depositsWithdrawals" satisfies TabType,
        label: "Deposits and Withdrawals",
        mobileLabel: "Transfers",
        content: <TransactionsTable />,
      },
    ],
    [readOnly, userAccount],
  );

  const activeTabs = tabs ?? defaultTabs;
  const resolvedDefaultValue =
    defaultValue ?? activeTabs[0]?.value ?? DEFAULT_BOTTOM_TAB_VALUES[0];
  const persistedValueIsValid = activeTabs.some(
    (tab) => tab.value === persistedValue,
  );
  const storeValue = persistedValueIsValid ? persistedValue : resolvedDefaultValue;
  const resolvedHeight = contentHeight ?? 400;
  const isMobile = useIsMobile();
  const shouldFillAvailableSpace = fillAvailableSpace && !isMobile;
  const contentRef = useFillAvailableHeight<HTMLDivElement>({
    bottomOffset: fillBottomOffset,
    cssProperty: BOTTOM_TABS_FILL_HEIGHT_VAR,
    enabled: shouldFillAvailableSpace,
    minHeight: fillMinHeight,
  });
  const resolvedHeightValue =
    typeof resolvedHeight === "number" ? `${resolvedHeight}px` : resolvedHeight;
  const contentStyle: BottomTabsContentStyle = {
    ...(shouldFillAvailableSpace
      ? { [BOTTOM_TABS_FILL_HEIGHT_VAR]: resolvedHeightValue }
      : {}),
    height: isMobile
      ? "fit-content"
      : shouldFillAvailableSpace
        ? `var(${BOTTOM_TABS_FILL_HEIGHT_VAR})`
        : resolvedHeight,
    minHeight: shouldFillAvailableSpace ? fillMinHeight : undefined,
  };
  const tabOptions = useMemo<TradingTabOption<string>[]>(
    () => activeTabs.map((tab) => ({
      value: tab.value,
      label: (
        <>
          <span className="min-w-0 truncate md:hidden">
            {t(tab.mobileLabel)}
          </span>
          <span className="hidden md:inline">{t(tab.label)}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className="min-w-[16px] shrink-0 rounded bg-badge-bg px-1 py-0 text-center text-[9px] font-bold text-content-muted group-data-[state=active]:text-content">
              {tab.count}
            </span>
          )}
        </>
      ),
    })),
    [activeTabs, t],
  );

  return (
    <TradingTabs
      value={value ?? storeValue}
      tabs={tabOptions}
      onValueChange={(nextValue) => {
        setSelectedBottomTab(persistenceKey, nextValue);
        onValueChange?.(nextValue);
      }}
      className={cn(`flex min-w-0 flex-col bg-transparent ${className}`)}
      listWrapperClassName="w-full overflow-x-auto overscroll-x-contain border-b border-edge"
      listClassName="w-fit self-start border-b-0"
    >
      <div
        className={cn(
          "flex min-w-0 flex-col bg-surface",
          shouldFillAvailableSpace ? "min-h-0" : "min-h-[200px]",
        )}
        data-bottom-tabs-content="true"
        ref={contentRef}
        style={contentStyle}
      >
        {activeTabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="h-full min-h-0 overflow-hidden"
          >
            {tab.content}
          </TabsContent>
        ))}
      </div>
    </TradingTabs>
  );
}

import { useEffect, useRef, useState } from "react";
import { BarChart3, ChartCandlestick, ChevronDown, User } from "lucide-react";

import { TradingChart } from "@/components/TradingChart";
import { OrderBook } from "@/components/OrderBook";
import { OrderForm } from "@/components/trading-page/order-form/OrderForm";
import { BottomTabs } from "@/components/bottom-tabs";
import { AccountSummary } from "@/components/trading-page/AccountSummary";
import { TradingTabs, type TradingTabOption } from "@/components/TradingTabs";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

import { Switch } from "@/components/ui/switch";
import SurfaceSeparator from "@/components/ui/surface-separator";
import TickerStats from "@/components/TickerStats";
import { cn } from "@/lib/utils";
import { MarketsList } from "../MarketsList";
import Surface from "../ui/surface";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";

type BottomNav = "markets" | "trade" | "account";
type TradeSubTab = "chart" | "book";

const TRADE_SUB_TABS: TradingTabOption<TradeSubTab>[] = [
  { value: "chart", label: "Chart" },
  { value: "book", label: "Order Book" },
];

const MOBILE_MARKET_PANEL_HEIGHT_CLASS = "h-[420px]";
const MOBILE_TRADING_PAGE_HEIGHT_CLASS = "h-[calc(100dvh-57px)]";
const BOTTOM_NAV_TABS: {
  id: BottomNav;
  label: string;
  icon: typeof BarChart3;
}[] = [
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "trade", label: "Trade", icon: ChartCandlestick },
  { id: "account", label: "Account", icon: User },
];

function MobileAssetDetails({ expanded }: { expanded: boolean }) {
  return (
    <div
      data-testid="mobile-asset-details"
      aria-hidden={!expanded}
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 bg-surface px-4 pb-2 pt-3">
          <TickerStats.MarkOracleStat />
          <TickerStats.VolumeStat />
          <TickerStats.OpenInterestStat />
          <TickerStats.FundingStat />
        </div>
      </div>
    </div>
  );
}

function MobileTickerBar() {
  const { t } = useTranslation();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  return (
    <Surface>
      <TradeHeader>
        <Button
          variant="outline"
          size="icon"
          aria-expanded={isDetailsExpanded}
          aria-label={
            isDetailsExpanded
              ? t("Collapse asset details")
              : t("Expand asset details")
          }
          onClick={() => setIsDetailsExpanded((expanded) => !expanded)}
        >
          <ChevronDown
            size={19}
            className={cn(
              "transition-transform",
              isDetailsExpanded && "rotate-180",
            )}
          />
        </Button>
      </TradeHeader>
      <MobileAssetDetails expanded={isDetailsExpanded} />
    </Surface>
  );
}

function MobileSectionSeparator() {
  return (
    <SurfaceSeparator
      direction="horizontal"
    />
  );
}

function MobileBottomTabsSection() {
  return (
    <section className="bg-surface">
      <BottomTabs />
    </section>
  );
}

/* ── Sub-tabs (Chart / Order Book) ── */
function TradeSubTabs({
  active,
  onChange,
}: {
  active: TradeSubTab;
  onChange: (t: TradeSubTab) => void;
}) {
  return (
    <TradingTabs
      value={active}
      tabs={TRADE_SUB_TABS}
      onValueChange={onChange}
    />
  );
}

/* ── Markets screen (chart + positions) ── */
function TradeChartScreen() {
  const [subTab, setSubTab] = useState<TradeSubTab>("chart");

  return (
    <>
      <MobileTickerBar />
      <MobileSectionSeparator />

      <TradeSubTabs active={subTab} onChange={setSubTab} />

      {subTab === "chart" && (
        <Surface
          className={`${MOBILE_MARKET_PANEL_HEIGHT_CLASS} w-full p-0 pr-2`}
        >
          <TradingChart />
        </Surface>
      )}
      {subTab === "book" && (
        <Surface
          className={`${MOBILE_MARKET_PANEL_HEIGHT_CLASS} w-full`}
        >
          <OrderBook mobileSideBySide />
        </Surface>
      )}

      <MobileSectionSeparator />
      <MobileBottomTabsSection />
    </>
  );
}

const TradeHeader = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="flex w-full items-center justify-between gap-[16px]">
      <MarketsList />
      <div className="flex flex-1 items-center gap-[8px] justify-between">
        <div className="flex flex-col items-start gap-1">
          <TickerStats.MarkPriceStat hideLabel className="text-[19px] font-semibold" />
          <TickerStats.ChangeStat hideLabel />
        </div>
        {children}
      </div>
    </div>
  );
};

/* ── Trade screen (order form + optional book) ── */
function TradeFormScreen() {
  const { t } = useTranslation();
  const [showBook, setShowBook] = useState(false);
  const orderFormRef = useRef<HTMLDivElement>(null);
  const [orderFormHeight, setOrderFormHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = orderFormRef.current;
    if (!element) return;

    const measureOrderForm = () => {
      const nextHeight = element.getBoundingClientRect().height;
      if (nextHeight <= 0) return;
      setOrderFormHeight((currentHeight) => (
        currentHeight !== null && Math.abs(currentHeight - nextHeight) < 0.5
          ? currentHeight
          : nextHeight
      ));
    };

    measureOrderForm();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measureOrderForm);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Surface>
        <TradeHeader>
          <Switch aria-label={t("Order Book")} checked={showBook} onCheckedChange={setShowBook} />
        </TradeHeader>
      </Surface>
      <MobileSectionSeparator />

      <div className="flex w-full items-start">
        <div
          ref={orderFormRef}
          data-testid="mobile-order-form-column"
          className={cn(
            "min-w-0 flex-1 p-[10px]",
            showBook && "border-r-4 border-base",
          )}
        >
          <OrderForm />
        </div>
        {showBook && (
          <div
            data-testid="mobile-compact-order-book-shell"
            className="w-[38%] min-w-[120px] max-w-[160px] shrink-0 overflow-hidden"
            style={orderFormHeight ? { height: orderFormHeight } : undefined}
          >
            <OrderBook compact />
          </div>
        )}
      </div>

      <MobileSectionSeparator />
      <MobileBottomTabsSection />
    </>
  );
}

/* ── Account screen ── */
function AccountScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const usePillActions = partner.featureFlags?.pillTradingAccountActions;

  return (
    <div className="flex flex-col bg-surface">
      <section className="bg-surface p-3">
        <AccountSummary />
      </section>
      <MobileSectionSeparator />
      <section className="space-y-2 border-t border-edge bg-surface p-3">
        <DepositModal
          trigger={
            <Button
              variant={usePillActions ? "themed" : "default"}
              className={cn(
                "w-full py-2.5 text-[13px] font-bold",
                usePillActions && "h-[38px] rounded-[32px]",
              )}
            >
              {t("Deposit")}
            </Button>
          }
        />
        <WithdrawModal
          trigger={
            <Button
              variant={usePillActions ? "themedSecondary" : "outline"}
              className={cn(
                "w-full py-2.5 text-[13px] font-bold",
                usePillActions && "h-[38px] rounded-[32px] disabled:opacity-100",
              )}
              disabled={!isAuthenticated}
            >
              {t("Withdraw")}
            </Button>
          }
        />
      </section>
    </div>
  );
}

/* ── Bottom navigation ── */
function MobileBottomNav({
  active,
  onChange,
}: {
  active: BottomNav;
  onChange: (t: BottomNav) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav className="z-20 flex shrink-0 border-t border-edge bg-surface h-12">
      {BOTTOM_NAV_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-0.5 py-2 transition-colors ${
              isActive ? "text-content" : "text-content-secondary"
            }`}
          >
            <Icon size={17} />
            <span className="text-[12px] font-medium">
              {t(tab.label)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Main mobile page ── */
export function MobileTradingPage() {
  const [activeNav, setActiveNav] = useState<BottomNav>("markets");

  return (
    <div
      className={`flex ${MOBILE_TRADING_PAGE_HEIGHT_CLASS} min-h-0 w-full flex-col overflow-hidden`}
    >
      <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
        {activeNav === "markets" && <TradeChartScreen />}
        {activeNav === "trade" && <TradeFormScreen />}
        {activeNav === "account" && <AccountScreen />}
      </div>
      <MobileBottomNav active={activeNav} onChange={setActiveNav} />
    </div>
  );
}

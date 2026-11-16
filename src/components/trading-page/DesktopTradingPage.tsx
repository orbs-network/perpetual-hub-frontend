import { BottomTabs } from "../bottom-tabs";
import { FavoritesBar } from "../FavoritesBar";
import { OrderBook } from "../OrderBook";
import { TradingChart } from "../TradingChart";
import { AccountSummary } from "./AccountSummary";
import { OrderForm } from "./order-form/OrderForm";
import { useAuth } from "@/hooks/useAuth";
import { DepositModal } from "../DepositModal";
import { Button } from "../ui/button";
import { WithdrawModal } from "../WithdrawModal";
import Surface from "../ui/surface";
import { Separator } from "../ui/separator";
import SurfaceSeparator from "../ui/surface-separator";
import { cn } from "@/lib/utils";
import { MarketsList } from "../MarketsList";
import TickerStats from "../TickerStats";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";
import "./DesktopTradingPage.css";

const DepositWithdrawButtons = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const usePillActions = partner.featureFlags?.pillTradingAccountActions;

  return (
    <div className="flex gap-1.5">
      <DepositModal
        trigger={
          <Button
            variant={
              usePillActions
                ? "themed"
                : !isAuthenticated
                  ? "secondary"
                  : "default"
            }
            className={cn(
              "flex-1 text-[11px]",
              usePillActions && "h-[38px] rounded-[32px]",
            )}
            disabled={!isAuthenticated}
          >
            {t("Deposit")}</Button>
        }
      />
      <WithdrawModal
        trigger={
          <Button
            variant={usePillActions ? "themedSecondary" : "outline"}
            className={cn(
              "flex-1 text-[11px]",
              usePillActions && "h-[38px] rounded-[32px] disabled:opacity-100",
            )}
            disabled={!isAuthenticated}
          >
            {t("Withdraw")}</Button>
        }
      />
    </div>
  );
};

const DesktopAssetTicker = () => {
  return (
    <Surface className="desktop-asset-ticker shrink-0 px-3 py-3">
      <div className="desktop-asset-ticker-content">
        <div className="flex min-w-0 items-center">
          <MarketsList />
        </div>
        <div className="desktop-asset-ticker-stats">
          <TickerStats.MarkPriceStat />
          <TickerStats.ChangeStat />
          <TickerStats.VolumeStat />
          <TickerStats.FundingStat />
        </div>
      </div>
    </Surface>
  );
};

const DesktopBottomTabs = ({ className }: { className?: string }) => {
  return (
    <div className={cn(`flex min-w-0 flex-col flex-1 ${className}`)}>
      <SurfaceSeparator direction="horizontal" />
      <Surface className="min-w-0 p-0 overflow-hidden">
        <BottomTabs />
      </Surface>
    </div>
  );
};

const BottomSection = () => {
  return (
    <Surface className="w-[28.5vw] min-w-[320px] min-[1150px]:w-[18.6vw] min-1150px:min-w-[unset] h-full">
      <DepositWithdrawButtons />
      <Separator className="my-2.5" />
      <AccountSummary />
    </Surface>
  );
};

const DesktopOrderBook = () => {
  return (
    <Surface className="overflow-hidden p-0 w-[28.5vw] min-[1150px]:w-[18.6vw] max-[1150px]:h-[600px]">
      <OrderBook />
    </Surface>
  );
};

const DesktopForm = () => {
  return (
    <Surface className="h-[670px] flex-none w-[28.5vw] min-w-[320px] min-[1150px]:w-[18.6vw] min-1150px:min-w-[unset]">
      <OrderForm />
    </Surface>
  );
};

const DesktopTradingChart = () => {
  return (
    <Surface className="flex-1 overflow-hidden p-0 max-[1150px]:h-[580px] max-[1150px]:flex-auto">
      <TradingChart />
    </Surface>
  );
};


function DesktopTradingPage() {
  return (
    <div className="flex flex-col gap-0 w-full">
      <div className="flex items-stretch w-full max-[1150px]:items-start">
      <SurfaceSeparator direction='vertical' />
        <div className="flex min-w-0 flex-col flex-1">
          <FavoritesBar />
          <SurfaceSeparator direction="horizontal" />
          <DesktopAssetTicker />
          <SurfaceSeparator direction="horizontal" />
          <DesktopTradingChart />
          <DesktopBottomTabs className="hidden max-[1150px]:flex" />
        </div>
        <SurfaceSeparator direction='vertical'  className="hidden max-[1150px]:flex"/>
        <div className="hidden min-[1150px]:flex">
          <SurfaceSeparator direction="vertical" />
          <DesktopOrderBook />
          <SurfaceSeparator direction="vertical" />
        </div>
        <div className="flex">
        <div className="flex flex-col">
          <div className="hidden max-[1150px]:flex flex-col">
            <DesktopOrderBook />
            <SurfaceSeparator direction="horizontal" />
          </div>
          <DesktopForm />
          <div className="hidden max-[1150px]:flex flex-col">
          <SurfaceSeparator direction="horizontal" />
          <BottomSection />
          </div>
        </div>
        <SurfaceSeparator direction="vertical" />
        </div>
      </div>

      <div className="items-stretch hidden min-[1150px]:flex">
      <SurfaceSeparator direction="vertical" />
        <DesktopBottomTabs />
        <SurfaceSeparator direction="vertical" />
        <div className="flex flex-col">
          <SurfaceSeparator direction="horizontal" />
          <BottomSection />
        </div>
        <SurfaceSeparator direction="vertical" />
      </div>
    </div>
  );
}

export default DesktopTradingPage;

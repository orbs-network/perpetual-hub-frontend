import { useMarkets } from "@/hooks/useMarkets";
import { TradingServiceError } from "@/components/TradingServiceError";
import { Separator } from "../../ui/separator";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PriceInputs } from "./PriceInputs";
import { DesktopLeverageModal } from "./LeverageModals";
import { BalanceAndCurrentPosition } from "./BalanceAndCurrentPosition";
import { OrderConfirmModal } from "./OrderConfirmModal";
import { OrderInfo } from "./OrderInfo";
import { OrderOptions } from "./OrderOptions";
import { OrderSizeInput } from "./OrderSizeInput";
import { OrderTypeTabs } from "./OrderTypeTabs";
import { SideToggle } from "./SideToggle";
import OrderFormProvider from "@/context/order-form/Provider";


export function OrderForm() {
  const isMobile = useIsMobile();
  const { isUnavailable } = useMarkets();
  if (isUnavailable) return <TradingServiceError />;
  return (
    <OrderFormProvider>
      <div className="overflow-hidden flex flex-col h-full">
        <OrderTypeTabs />
        <SideToggle />
        <DesktopLeverageModal />
        <BalanceAndCurrentPosition />
        <PriceInputs />
        <OrderSizeInput />
        <OrderOptions />
        <div className="mt-auto">
        {!isMobile && <OrderConfirmModal />}
        <Separator className="my-2.5" />
        <OrderInfo />
        {isMobile && <OrderConfirmModal />}
        </div>
      </div>
    </OrderFormProvider>
  );
}

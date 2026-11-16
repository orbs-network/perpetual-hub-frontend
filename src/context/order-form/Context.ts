import { createContext } from "react";
import type { SystemConfig } from "@/api/tee";
import type { MarginInfo, PriceData } from "@/types";
import type { LiquidationEstimate } from "@/lib/liquidation";
import type { OrderSizingMMBracket } from "@/utils/orderSizing";

export type OrderFormContextValue = {
  marginPayload: {
    marginInfo: MarginInfo;
    liquidationEstimate: LiquidationEstimate | null;
    availableBalance: string;
    rawAvailableBalance: string;
    useStandaloneReserveBudget: boolean;
    selectedOrderPrice: string;
    feeRateBps?: number;
    orderSizingBrackets: OrderSizingMMBracket[];
    orderSizingStepSize?: string;
    orderSizingPrices: Record<string, PriceData>;
    orderSizingTeeConfig?: SystemConfig;
    currentPrice: number;
    leverage: number;
    effectiveReduceOnly: boolean;
    isLoading: boolean;
  };
};

export const OrderFormContext = createContext<OrderFormContextValue | null>(null);

import { useMemo } from "react";
import { usePrices } from "@/hooks/useBinancePrices";
import { useUserAccount } from "@/hooks/useUserAccount";
import {
  calculateAvailableBalance,
  calculateMarginBalance,
  calculateMarginRatio,
  calculateTotalMaintenanceMargin,
  calculateTotalInitialMargin,
  calculateTotalNetUnrealizedPnL,
  calculateTotalUnrealizedPnL,
  DEFAULT_TRADING_FEE_RATE_BPS,
  resolveFeeRateBps,
} from "@/lib/margin";
import { useTeeConfig } from "./useTeeConfig";

const EMPTY_PRICES = {};

export function useLiveAccountRisk() {
  const { data: userAccount, isLoading: isUserAccountLoading } = useUserAccount();
  const priceSymbols = useMemo(
    () => [
      ...(userAccount?.positions.map((position) => position.symbol) ?? []),
      ...(userAccount?.orders.map((order) => order.symbol) ?? []),
    ],
    [userAccount?.positions, userAccount?.orders],
  );
  const { data: prices = EMPTY_PRICES } = usePrices(priceSymbols);
  const { data: teeConfig } = useTeeConfig();

  return useMemo(() => {
    const balance = userAccount?.accountSummary?.balance ?? 0n;
    const positions = userAccount?.positions ?? [];
    const orders = userAccount?.orders ?? [];
    const leveragePreferences = userAccount?.leveragePreferences ?? {};
    // These values are price-sensitive, so calculate them in the browser from
    // static account state plus live mark prices instead of waiting for polling.
    const unrealizedPnL = calculateTotalUnrealizedPnL(positions, prices);
    const feeRateBps = resolveFeeRateBps(teeConfig, userAccount?.feeTier ?? 0);
    const displayFeeRateBps = feeRateBps ?? DEFAULT_TRADING_FEE_RATE_BPS;
    const netUnrealizedPnL = calculateTotalNetUnrealizedPnL(
      positions,
      prices,
      displayFeeRateBps,
    );
    const hasFeeRateBps = feeRateBps !== undefined;

    // Used margin is total initial margin: open-position IM plus pending-order
    // Order IM, where Order IM includes worst-case exposure, open loss, and
    // pending fees. This keeps the account summary live when prices move.
    const marginUsed = hasFeeRateBps
      ? calculateTotalInitialMargin(
          positions,
          orders,
          prices,
          leveragePreferences,
          teeConfig,
          feeRateBps,
        )
      : userAccount?.accountSummary?.marginUsed ?? 0n;
    const maintenanceMargin = calculateTotalMaintenanceMargin(positions, prices);
    const marginBalance = calculateMarginBalance(balance, unrealizedPnL);
    const availableBalance = hasFeeRateBps
      ? calculateAvailableBalance(
          balance,
          unrealizedPnL,
          marginUsed,
        )
      : userAccount?.accountSummary?.availableBalance ?? 0n;
    const marginRatio = calculateMarginRatio(maintenanceMargin, marginBalance);

    return {
      availableBalance,
      balance,
      marginBalance,
      marginRatio,
      marginUsed,
      maintenanceMargin,
      netUnrealizedPnL,
      unrealizedPnL,
      feeRateBps,
      hasFeeRateBps,
      isLoading: isUserAccountLoading,
    };
  }, [prices, userAccount, teeConfig, isUserAccountLoading]);
}

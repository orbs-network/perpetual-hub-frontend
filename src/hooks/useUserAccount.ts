import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/user";
import {
  getDisplaySymbol,
  parseAccountSummary,
  parseOrderResponse,
  parsePositionResponse,
} from "@/lib/utils";
import { DEFAULT_POSITION_LEVERAGE } from "@/lib/margin";
import { useTeeConfig } from "./useTeeConfig";
import { usePortfolioAddress } from "./usePortfolioAddress";
import { useOrderOperationsStore } from "@/stores/orderOperationsStore";
import { useIsHedgerAddress } from "./useHedgerAccounting";

const POLL_INTERVAL = 10_000;

export function useUserAccount() {
  const address = usePortfolioAddress();
  const { isHedger, isResolved: isHedgerRoleResolved } =
    useIsHedgerAddress(address);
  const pausePolling = useOrderOperationsStore(
    (state) => state.pendingOrderReplacementCount > 0,
  );

  const query = useQuery({
    queryKey: ["userData", address],
    queryFn: async ({ signal }) => {
      const user = await getUser(address!, signal);
      const accountSummary = parseAccountSummary(user);

      return {
        positions: user.positions.map(parsePositionResponse),
        orders: user.pendingOrders.map(parseOrderResponse),
        pendingWithdrawals: accountSummary.pendingWithdrawals,
        accountSummary: accountSummary,
        feeTier: user.user.feeTier ?? 0,
        leveragePreferences: user.leveragePreferences || {},
        hasNoBalance: accountSummary.balance === 0n,
      };
    },
    enabled: !!address && isHedgerRoleResolved && !isHedger,
    refetchInterval: pausePolling ? false : POLL_INTERVAL,
    refetchOnMount: !pausePolling,
    refetchOnReconnect: !pausePolling,
    refetchOnWindowFocus: !pausePolling,
    retry: 2,
  });

  return {
    ...query,
    isLoading:
      query.isLoading || (Boolean(address) && !isHedgerRoleResolved),
  };
}

export const useAccountSymbolLeverage = (symbol: string) => {
  const { data, isLoading: isUserLoading } = useUserAccount();
  const { data: teeConfig, isLoading: isTeeLoading } = useTeeConfig();
  const isLoading = isUserLoading || isTeeLoading;
  const leverage = useMemo(() => {
    const base = getDisplaySymbol(symbol);
    const prefEntry = Object.entries(data?.leveragePreferences ?? {}).find(
      ([key]) => getDisplaySymbol(key) === base,
    );
    const configEntry = Object.entries(teeConfig?.symbolConfigs ?? {}).find(
      ([key]) => getDisplaySymbol(key) === base,
    );
    return (
      prefEntry?.[1] ||
      configEntry?.[1]?.defaultLeverage ||
      DEFAULT_POSITION_LEVERAGE
    );
  }, [data, teeConfig, symbol]);
  return { leverage, isLoading };
};

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ORDER_HISTORY_QUERY_KEY } from "../useOrderHistory";
import { useRollupStatus } from "../useRollupStatus";
import { TRADE_HISTORY_QUERY_KEY } from "../useTradeHistory";
import { useUserAccount } from "../useUserAccount";

export function useOnOrdersChangeCallback() {
  const queryClient = useQueryClient();
  const { refetch: refetchUserAccount } = useUserAccount();
  const { refetch: refetchRollupStatus } = useRollupStatus();

  return useMutation({
    mutationFn: async () => {
      await Promise.all([
        refetchUserAccount(),
        queryClient.invalidateQueries({ queryKey: TRADE_HISTORY_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ORDER_HISTORY_QUERY_KEY }),
      ]);
      refetchRollupStatus();
    },
  });
}

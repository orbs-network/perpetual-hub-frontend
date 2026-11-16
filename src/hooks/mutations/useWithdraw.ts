import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "../useAuthSession";
import { useUserAccount } from "../useUserAccount";
import { requestWithdrawal } from "@/api/user";
import { generateRequestId } from "@/api/client";
import { signWalletWithdrawal, signWithdrawal } from "@/utils/signing";
import { useRollupStatus } from "../useRollupStatus";
import { toast } from "sonner";
import { useUSDCBalance } from "./useDeposit";
import { useActiveAddress } from "@/hooks/useActiveAddress";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useSupportedChainId } from "../useSupportedChainId";
import {
  MAX_WITHDRAWAL_AMOUNT,
  MIN_WITHDRAWAL_AMOUNT,
} from "@/config/constants";
import { wagmiConfig } from "@/config/wagmi";
import { LEGACY_HEDGER_ACCOUNT_QUERY_KEY } from "../useLegacyHedgerAccount";
import { HEDGER_ACCOUNTING_QUERY_KEY } from "../useHedgerAccounting";

export function useWithdraw() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const address = useActiveAddress();
  const sessionKey = useAuthSession().sessionKey;
  const chainId = useSupportedChainId();
  const { refetch: refetchUserData } = useUserAccount();
  const { refetch: refetchRollupStatus } = useRollupStatus();
  const { refetch: refetchUSDCBalance } = useUSDCBalance();

  return useMutation({
    mutationFn: async ({
      amount,
      isMax,
      onSuccess,
      isHedger,
      isLegacyUser,
    }: {
      amount: bigint;
      isMax?: boolean;
      onSuccess: () => void;
      isHedger?: boolean;
      isLegacyUser?: boolean;
    }) => {
      if (isLegacyUser && !isHedger) throw new Error("Previous user funds require the hedger wallet");
      const isTreasury = isHedger && !isLegacyUser;
      if (!address) throw new Error("Sign in required");
      if (!isHedger && !sessionKey) throw new Error("Sign in required");
      if (!chainId) throw new Error(t("Wallet chain is still loading"));
      if (amount < 0n || (amount === 0n && (isTreasury || !isMax))) throw new Error("Invalid amount");

      const toastId = toast.loading(t("Requesting withdrawal..."));
      const serverRequestId = generateRequestId();

      try {
        const timestamp = BigInt(Date.now());
        const withdrawAmount = amount;
        const requestIsMax = isMax ?? false;
        if (!requestIsMax && withdrawAmount < MIN_WITHDRAWAL_AMOUNT) {
          throw new Error(t("Minimum $2"));
        }
        if (!isTreasury && withdrawAmount > MAX_WITHDRAWAL_AMOUNT) {
          throw new Error(t("Maximum withdrawal is 10000 {{collateralSymbol}}", { collateralSymbol: getCollateralSymbol() }));
        }

        const signature = isTreasury
          ? await signWalletWithdrawal({
              config: wagmiConfig,
              chainId,
              user: address,
              recipient: address,
              amount: withdrawAmount,
              isMax: requestIsMax,
              timestamp,
            })
          : await signWithdrawal({
              config: wagmiConfig,
              chainId,
              user: address,
              recipient: address,
              amount: withdrawAmount,
              isMax: requestIsMax,
              ...(isLegacyUser ? { isLegacyUser: true } : {}),
              timestamp,
            });

        await requestWithdrawal({
          requestId: serverRequestId,
          user: address,
          amount: withdrawAmount.toString(),
          isMax: requestIsMax,
          ...(isLegacyUser ? { isLegacyUser: true } : {}),
          timestamp: Number(timestamp),
          signature,
        });

        refetchRollupStatus();
        onSuccess();
        // Poll USDC balance until it reflects the withdrawal
        // Refresh account data
        await Promise.all([
          isHedger
            ? queryClient.invalidateQueries({
                queryKey: isLegacyUser ? LEGACY_HEDGER_ACCOUNT_QUERY_KEY : HEDGER_ACCOUNTING_QUERY_KEY,
              })
            : refetchUserData(),
          refetchUSDCBalance(),
        ]);
        toast.success(t("Withdrawal approved!"), {
          id: toastId,
          description: t("Withdrawals are released after a 24-hour security delay."),
          duration: Infinity,
          closeButton: true,
        });
      } catch (err) {
        const message = t("Withdrawal failed");
        toast.error(message, { id: toastId, duration: 6000 });
        throw err;
      }
    },
  });
}

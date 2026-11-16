import { changeLeverage } from "../../api/orders";
import { useAuthSession } from "../useAuthSession";
import { toast } from "sonner";
import { signLeverage } from "../../utils/signing";
import { useMutation } from "@tanstack/react-query";
import { useUserAccount } from "../useUserAccount";
import { useRollupStatus } from "../useRollupStatus";
import { useActiveAddress } from "@/hooks/useActiveAddress";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useSupportedChainId } from "../useSupportedChainId";

export const useUpdatePositionLeverage = () => {
  const { t } = useTranslation();
  const address = useActiveAddress();
  const sessionKey = useAuthSession().sessionKey;
  const chainId = useSupportedChainId();

  const { refetch: refetchUserAccount } = useUserAccount();
  const { refetch: refetchRollupStatus } = useRollupStatus();
  return useMutation({
    mutationFn: async ({
      symbol,
      leverage: newLeverage,
      onSuccess,
    }: {
      symbol?: string | null;
      leverage?: number;
      onSuccess?: () => void;
    }) => {
      if (!address || !sessionKey) throw new Error("Sign in required");
      if (!chainId) throw new Error(t("Wallet chain is still loading"));
      if (!symbol) throw new Error("Symbol is required");
      if (!newLeverage) throw new Error("Leverage is required");

      const toastId = toast.loading(t("Modify request submitted"));

      try {
        const timestamp = BigInt(Date.now());
        const signature = await signLeverage({
          sessionKey,
          chainId,
          user: address,
          symbol,
          leverage: BigInt(newLeverage),
          timestamp,
        });


        const response = await changeLeverage({
          user: address,
          symbol,
          leverage: newLeverage,
          timestamp: Number(timestamp),
          signature,
        });

        toast.success(t("Modified position"), {
          id: toastId,
          duration: 5_000,
        });

        await refetchUserAccount();
        refetchRollupStatus();
        onSuccess?.();
        return response;
      } catch (err) {
        const rawMessage =
          err instanceof Error ? err.message : t("Failed to change leverage");
        const isMarginError = rawMessage.includes("INSUFFICIENT_MARGIN");
        const description = isMarginError
          ? t("Position does not have sufficient margin available to decrease leverage. To decrease leverage, deposit more collateral.")
          : t("Failed to change leverage");
        toast.error(t("Modify failed"), {
          id: toastId,
          description,
          duration: 6000,
        });
        throw err;
      }
    },
  });
};

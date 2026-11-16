import { useCallback, useMemo } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { toast } from "sonner";
import type { Chain } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { getChainDetails } from "@/config/chains";
import { useCurrentPartnerChain } from "./useCurrentPartnerChain";

export function getSwitchChainParameters(chainId: number) {
  return {
    chainId,
  };
}

export function getSwitchChainDetails(chainId: number): Chain {
  return getChainDetails(chainId);
}

export function shouldSwitchConnectedChain(
  walletChainId: number | undefined,
  targetChainId: number,
) {
  return Boolean(walletChainId && walletChainId !== targetChainId);
}

export function useShouldSwitchToSupportedChain() {
  const { chainId: walletChainId } = useAccount();
  const targetChainId = useCurrentPartnerChain().chainId;

  return shouldSwitchConnectedChain(walletChainId, targetChainId);
}

export function useSwitchToSupportedChain() {
  const { t } = useTranslation();
  const { chainId: walletChainId } = useAccount();
  const { isPending: isSwitching, switchChainAsync } = useSwitchChain();
  const targetChainId = useCurrentPartnerChain().chainId;
  const shouldSwitchChain = shouldSwitchConnectedChain(
    walletChainId,
    targetChainId,
  );

  const targetChain = useMemo(
    () => getSwitchChainDetails(targetChainId),
    [targetChainId],
  );
  const switchChainName = targetChain.name;

  const switchToSupportedChain = useCallback(async () => {
    try {
      await switchChainAsync(
        getSwitchChainParameters(targetChainId),
      );
    } catch {
      toast.error(t("Failed to switch network"), {
        duration: 5000,
      });
    }
  }, [switchChainAsync, t, targetChainId]);

  return {
    isSwitching,
    shouldSwitchChain,
    switchChainId: targetChainId,
    switchChainName,
    switchToSupportedChain,
  };
}

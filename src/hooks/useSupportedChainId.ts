import { useAccount } from "wagmi";
import { useCurrentPartnerChain } from "./useCurrentPartnerChain";

export interface WalletChainStatusInput {
  walletChainId?: number;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
}

export function isWalletChainResolving({
  walletChainId,
  isConnected,
  isConnecting,
  isReconnecting,
}: WalletChainStatusInput) {
  return isConnecting || isReconnecting || (isConnected && !walletChainId);
}

function useWalletChainStatus(): WalletChainStatusInput {
  const {
    chainId: walletChainId,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useAccount();

  return {
    walletChainId,
    isConnected,
    isConnecting,
    isReconnecting,
  };
}

export function useIsWalletChainResolving() {
  return isWalletChainResolving(useWalletChainStatus());
}

export function useSupportedChainId() {
  const walletChainStatus = useWalletChainStatus();
  const currentPartnerChain = useCurrentPartnerChain();
  const isResolvingChain = isWalletChainResolving(walletChainStatus);

  if (isResolvingChain) {
    return undefined;
  }

  return currentPartnerChain.chainId;
}

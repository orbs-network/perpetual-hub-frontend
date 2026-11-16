import { allChains } from "@/config/wagmi";
import { useMemo } from "react";
import { useSupportedChainId } from "./useSupportedChainId";

export function useTargetChain() {
  const chainId = useSupportedChainId();
  return useMemo(() => {
    if (!chainId) return undefined;
    return allChains.find((c) => c.id === chainId);
  }, [chainId]);
}

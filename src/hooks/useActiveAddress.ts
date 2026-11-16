import { useMemo } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { useAppQueryParams } from "./useAppQueryParams";

type HexAddress = `0x${string}`;

/**
 * Returns the active user address — from the connected wallet,
 * or from a shared session / viewer URL param when no wallet is connected.
 */
export function useActiveAddress(): HexAddress | undefined {
  const { address: walletAddress } = useAccount();
  const { viewerAddress } = useAppQueryParams();

  return useMemo(() => {
    const address = walletAddress ?? viewerAddress;
    return address && isAddress(address, { strict: false })
      ? address
      : undefined;
  }, [walletAddress, viewerAddress]);
}

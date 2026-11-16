import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { useAppQueryParams } from "./useAppQueryParams";

export type HexAddress = `0x${string}`;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function isPortfolioQueryAddress(
  value: string | null | undefined,
): value is HexAddress {
  return !!value && ADDRESS_RE.test(value);
}

export function usePortfolioAddress(): HexAddress | undefined {
  const { address: walletAddress } = useAccount();
  const { address: queryAddress, viewerAddress } = useAppQueryParams();

  return useMemo(() => {
    if (viewerAddress) return viewerAddress;
    if (isPortfolioQueryAddress(queryAddress)) return queryAddress;
    return walletAddress;
  }, [viewerAddress, queryAddress, walletAddress]);
}

function isExplicitReadOnly(search: string) {
  const value = new URLSearchParams(search).get("readonly")?.toLowerCase();
  return value === "1" || value === "true";
}

export function useIsPortfolioReadOnly() {
  const { address: walletAddress } = useAccount();
  const { search } = useLocation();
  const {
    address: queryAddress,
    sharedSession,
    viewerAddress,
  } = useAppQueryParams();

  return useMemo(() => {
    if (isExplicitReadOnly(search)) return true;

    if (viewerAddress && !sharedSession) return true;

    if (!isPortfolioQueryAddress(queryAddress)) return false;
    if (!walletAddress) return true;

    return queryAddress.toLowerCase() !== walletAddress.toLowerCase();
  }, [
    queryAddress,
    search,
    sharedSession,
    viewerAddress,
    walletAddress,
  ]);
}

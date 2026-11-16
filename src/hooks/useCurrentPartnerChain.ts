import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { isAddress } from "viem";
import {
  getCurrentContractAddress,
  getCurrentCollateralAddress,
  resolveCurrentPartnerChain,
  resolveCurrentPartnerChainIdentity,
} from "@/config/constants";

type HexAddress = `0x${string}`;

export function useCurrentPartnerChain() {
  const location = useLocation();

  return useMemo(
    () => resolveCurrentPartnerChain(location.search),
    [location.search],
  );
}

export function useCurrentPartnerChainIdentity() {
  const location = useLocation();

  return useMemo(
    () => resolveCurrentPartnerChainIdentity(location.search),
    [location.search],
  );
}

export function useCurrentPartnerChainKey() {
  return useCurrentPartnerChainIdentity().partnerChainKey;
}

export function useContractAddress(): HexAddress | undefined {
  const location = useLocation();

  return useMemo(() => {
    const address = getCurrentContractAddress(location.search);
    return address && isAddress(address, { strict: false })
      ? address
      : undefined;
  }, [location.search]);
}

export function useCollateralAddress(): HexAddress | undefined {
  const location = useLocation();

  return useMemo(() => {
    const address = getCurrentCollateralAddress(location.search);
    return address && isAddress(address, { strict: false })
      ? address
      : undefined;
  }, [location.search]);
}

export function useCollateralDecimals(): 6 | 18 {
  return useCurrentPartnerChain().collateralDecimals;
}

import { useMemo } from "react";
import {
  useContractAddress,
  useCurrentPartnerChainKey,
  useCollateralAddress,
} from "@/hooks/useCurrentPartnerChain";
import type { DepositLane } from "./bridgeStatus";

/**
 * Where a deposit would go right now.
 *
 * One hook so the page that RECORDS a bridge and the watcher that DEPOSITS it
 * describe the lane the same way. `partnerChainKey` alone is not the target:
 * API-provided contract and collateral addresses may change in a later deployment
 * while the partner and chain identifiers stay the same.
 */
export function useDepositLane(): DepositLane {
  const partnerChainKey = useCurrentPartnerChainKey();
  const contractAddress = useContractAddress();
  const collateralAddress = useCollateralAddress();

  return useMemo(
    () => ({ partnerChainKey, contractAddress, collateralAddress }),
    [partnerChainKey, contractAddress, collateralAddress],
  );
}

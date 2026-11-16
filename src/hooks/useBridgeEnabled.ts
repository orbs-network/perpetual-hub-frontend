import { partner } from "@/config/partners";
import { useCurrentPartnerChain } from "./useCurrentPartnerChain";

/**
 * The chain the bridge deposits INTO. This is a property of the partner and the
 * `?chain=` selection, not of the connected wallet, so it resolves synchronously
 * and is always defined.
 *
 * Deliberately NOT `useSupportedChainId`: that returns `undefined` while wagmi
 * is connecting or reconnecting, and treating the destination as unknown during
 * that window made `/bridge` redirect away on deep links and tore the widget
 * down mid-connect.
 */
export function useBridgeDestinationChainId(): number {
  return useCurrentPartnerChain().chainId;
}

/**
 * Stable route/entry gate using the single app's opt-in and API-provided lanes.
 * The widget checks provider support against validated LI.FI API metadata before
 * mounting. Keeping that async check there avoids redirecting deep links while
 * provider metadata is loading or tearing down an active recovery watcher.
 */
export function useBridgeEnabled(): boolean {
  const chainId = useBridgeDestinationChainId();
  return partner.featureFlags?.bridgeDepositEnabled === true &&
    partner.chains.some((chain) => chain.chainId === chainId);
}

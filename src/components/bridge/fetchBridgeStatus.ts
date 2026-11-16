import type { StatusResponse } from "@lifi/sdk";

/**
 * Ask LI.FI for the status of a bridge transfer.
 *
 * Load the SDK on demand so the app-wide watcher does not put it in the initial
 * bundle. It is needed only when a bridge transfer is pending.
 */
export async function fetchBridgeStatus(params: {
  txHash: string;
  fromChainId: number;
  toChainId: number;
  tool?: string;
}): Promise<StatusResponse> {
  const { getStatus } = await import("@lifi/sdk");
  return getStatus({
    txHash: params.txHash,
    fromChain: params.fromChainId,
    toChain: params.toChainId,
    // LI.FI resolves cross-chain transfers far more reliably when told which
    // bridge to ask about — its own waitForTransactionStatus always sends it.
    // Omitted entirely when unknown; sending `undefined` is not the same as
    // omitting for their query-string builder.
    ...(params.tool ? { bridge: params.tool } : {}),
  });
}

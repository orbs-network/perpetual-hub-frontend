import { getCollateralSymbol } from "@/utils/collateralDisplay";
import type { DepositLane } from "./bridgeStatus";
/**
 * Processes LI.FI reports for a step, in emission order. Only the type matters
 * here, so this is deliberately narrower than the SDK's `Process`.
 */
interface RouteProcessLike {
  txHash?: string;
  type?: string;
  startedAt?: number;
}

interface RouteStepLike {
  tool?: string;
  execution?: { process?: RouteProcessLike[] };
}

/** The subset of a LI.FI `RouteExtended` this module reads. */
export interface RouteLike {
  id?: string;
  fromChainId?: number;
  toChainId?: number;
  toAddress?: string;
  toAmount?: string;
  toToken?: { symbol?: string; decimals?: number };
  steps?: RouteStepLike[];
}

/**
 * Process types that are NOT the bridge send.
 *
 * A route that needs an ERC-20 approval emits `TOKEN_ALLOWANCE` (or `PERMIT`)
 * as its first process, each with its own `txHash`. Those hashes are real
 * on-chain transactions, so a naive "first process with a hash" picks the
 * APPROVAL — which LI.FI's `getStatus` cannot resolve as a transfer. The bridge
 * would then look untrackable and the auto-deposit would silently never fire,
 * specifically for first-time and low-allowance users: the common case.
 *
 * `RECEIVING_CHAIN` is excluded for a different reason: its hash is on the
 * DESTINATION chain, so it cannot identify the source transfer.
 */
const NON_SEND_PROCESS_TYPES = new Set([
  "TOKEN_ALLOWANCE",
  "PERMIT",
  "RECEIVING_CHAIN",
]);

function sendProcessesOf(step: RouteStepLike | undefined): RouteProcessLike[] {
  return (step?.execution?.process ?? []).filter(
    (process) =>
      typeof process.txHash === "string" &&
      process.txHash.length > 0 &&
      !NON_SEND_PROCESS_TYPES.has(process.type ?? ""),
  );
}

/**
 * The transaction that identifies this bridge to LI.FI, and the tool that
 * carried it.
 *
 * **Not simply `steps[0]`.** Bridging from a non-USDC source token can produce
 * a route whose first step is a source-chain SWAP and whose second is the
 * cross-chain send. Recording the swap would have `getStatus` poll a
 * transaction it cannot resolve as a transfer, and the bridge would sit in
 * storage forever without depositing. So a `CROSS_CHAIN` process anywhere in
 * the route wins, and its OWN step supplies the tool — hash and tool must
 * describe the same step or the status query is incoherent.
 *
 * The fallback to the first send-like process is for SAME-CHAIN routes only,
 * where there is no cross-chain process to find. It must not apply while a
 * cross-chain route is mid-execution: at that point the only hash available may
 * be the source-chain swap, and recording it would have `getStatus` poll a
 * transaction it cannot resolve. Recording nothing yet is correct — the next
 * update carries the real send.
 */
export function pickBridgeSend(
  steps: RouteStepLike[] | undefined,
  options: { crossChain: boolean } = { crossChain: false },
): { txHash: string; tool?: string; startedAt?: number } | undefined {
  if (!steps?.length) return undefined;

  for (const step of steps) {
    const crossChain = sendProcessesOf(step).find(
      (process) => process.type === "CROSS_CHAIN",
    );
    if (crossChain?.txHash) {
      return {
        txHash: crossChain.txHash,
        tool: toolOf(step),
        startedAt: crossChain.startedAt,
      };
    }
  }

  if (options.crossChain) return undefined;

  for (const step of steps) {
    const [first] = sendProcessesOf(step);
    if (first?.txHash) {
      return {
        txHash: first.txHash,
        tool: toolOf(step),
        startedAt: first.startedAt,
      };
    }
  }

  return undefined;
}

function toolOf(step: RouteStepLike | undefined): string | undefined {
  const tool = step?.tool;
  return tool && tool !== "custom" ? tool : undefined;
}

function formatToAmount(raw: string | undefined, decimals = 6): string {
  if (!raw) return "";
  try {
    const value = Number(BigInt(raw)) / 10 ** decimals;
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return "";
  }
}

/**
 * Build the record the watcher will act on, or `undefined` if the route is not
 * yet trackable.
 *
 * Returning `undefined` rather than a partial record is deliberate: a record
 * missing the send hash, the account or the partner lane cannot be deposited
 * safely, and storing one would just produce a bridge that polls forever.
 */
export function buildPendingBridge(
  route: RouteLike | undefined,
  connectedAccount: string | undefined,
  lane: DepositLane | undefined,
): {
  txHash: string;
  fromChainId: number;
  toChainId: number;
  account: string;
  displayAmount: string;
  tokenSymbol: string;
  tool?: string;
  partnerChainKey: string;
  contractAddress?: string;
  collateralAddress?: string;
  startedAt?: number;
} | undefined {
  const send = pickBridgeSend(route?.steps, {
    crossChain: !!route && route.fromChainId !== route.toChainId,
  });
  const txHash = send?.txHash;
  // The route's own destination address, NOT the live wallet. If the user
  // switches wallets between signing and the event that carries the hash, the
  // live address is a different account entirely — and the watcher would then
  // deposit THAT wallet's existing USDC while the bridged funds sit elsewhere.
  const account = route?.toAddress ?? connectedAccount;
  if (
    !txHash ||
    !account ||
    !lane?.partnerChainKey ||
    !route?.fromChainId ||
    !route?.toChainId
  ) {
    return undefined;
  }

  return {
    txHash,
    fromChainId: route.fromChainId,
    toChainId: route.toChainId,
    account,
    displayAmount: formatToAmount(route.toAmount, route.toToken?.decimals),
    tokenSymbol: route.toToken?.symbol ?? getCollateralSymbol(),
    tool: send.tool,
    partnerChainKey: lane.partnerChainKey,
    contractAddress: lane.contractAddress,
    collateralAddress: lane.collateralAddress,
    // The route's OWN clock, when it has one. A bridge recovered hours later
    // must not have its 24h expiry restart from the moment we noticed it.
    startedAt: send.startedAt,
  };
}

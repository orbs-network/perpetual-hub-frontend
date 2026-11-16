import type { StatusResponse } from "@lifi/sdk";

/**
 * What the watcher should do next with a pending bridge, derived from LI.FI's
 * status response.
 *
 * Kept as a pure function so every branch — including the ones that are painful
 * to reach in a browser — is directly testable.
 */
export type BridgeOutcome =
  /** Still in flight; keep polling. */
  | { kind: "pending" }
  /** Destination transfer landed. `receivedAmount` is the raw on-chain amount. */
  | { kind: "arrived"; receivedAmount: bigint }
  /** LI.FI says it failed. Funds are wherever the bridge left them. */
  | { kind: "failed"; reason: string }
  /** Not resolvable — drop the record rather than poll forever. */
  | { kind: "unresolvable"; reason: string };

/**
 * `NOT_FOUND` is deliberately treated as pending for a grace period.
 *
 * LI.FI does not know a transaction immediately after it is submitted, so an
 * early NOT_FOUND is normal rather than terminal. Dropping the record then
 * would abandon a bridge that is about to succeed — the user's funds would
 * arrive with nothing watching for them.
 */
export const NOT_FOUND_GRACE_MS = 5 * 60 * 1000;

export function interpretStatus(
  status: StatusResponse | undefined,
  ageMs: number,
  notFoundGraceMs: number = NOT_FOUND_GRACE_MS,
): BridgeOutcome {
  if (!status) return { kind: "pending" };

  switch (status.status) {
    case "DONE": {
      // `DONE` is not the same as "the expected asset arrived". LI.FI reports
      // PARTIAL (only part of the transfer completed, possibly in a different
      // asset) and REFUNDED (sent back on the SOURCE chain) under the same
      // status. Auto-depositing either is impossible, and treating them as
      // arrivals would have the watcher wait for a USDC balance that never
      // appears, then settle the bridge as "already deposited" — silently
      // dropping a bridge whose funds were never deposited at all.
      const substatus = (status as { substatus?: string }).substatus;
      if (substatus === "REFUNDED") {
        return {
          kind: "unresolvable",
          reason: "the bridge refunded on the source chain",
        };
      }
      if (substatus === "PARTIAL") {
        return {
          kind: "unresolvable",
          reason: "the bridge completed only partially",
        };
      }

      const raw = (status as { receiving?: { amount?: string } }).receiving?.amount;
      const amount = parseAmount(raw);
      if (amount === undefined || amount <= 0n) {
        // DONE without a usable amount: the bridge completed but we cannot size
        // a deposit from it. Surfacing rather than guessing — the funds are in
        // the wallet and the user can deposit manually.
        return {
          kind: "unresolvable",
          reason: "completed without a readable received amount",
        };
      }
      return { kind: "arrived", receivedAmount: amount };
    }

    case "FAILED":
      return { kind: "failed", reason: "the bridge reported a failure" };

    case "INVALID":
      return { kind: "unresolvable", reason: "not a recognised bridge transfer" };

    case "NOT_FOUND":
      return ageMs > notFoundGraceMs
        ? { kind: "unresolvable", reason: "not found by the bridge provider" }
        : { kind: "pending" };

    case "PENDING":
    default:
      return { kind: "pending" };
  }
}

function parseAmount(raw: unknown): bigint | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

/**
 * Whether the watcher may act on this bridge right now.
 *
 * The account check is the important one. Depositing after the user has
 * switched wallets would move funds using the wrong signer, so a mismatch must
 * make the record DORMANT — not deleted, because they may switch back, and not
 * acted on.
 */
/**
 * Where a deposit would actually go.
 *
 * `partnerChainKey` alone is not enough: an API deployment can change contract
 * or collateral addresses while retaining the same partner and chain identity.
 * Match the recorded deposit target as well as its lane key.
 */
export interface DepositLane {
  partnerChainKey: string | undefined;
  contractAddress?: string;
  collateralAddress?: string;
}

/**
 * Whether the app is currently pointing at the same deposit target the bridge
 * was started for.
 *
 * The watcher is app-wide but the target comes from the current API-provided
 * lane and `?chain=` selection. Navigation or a later deployment must not send
 * in-flight funds to a different recorded target.
 * Mismatch makes the record dormant — the funds are still theirs and returning
 * to that lane resumes the deposit.
 */
export function isSameDepositLane(
  bridgeLane: DepositLane | undefined,
  currentLane: DepositLane | undefined,
): boolean {
  if (!bridgeLane?.partnerChainKey || !currentLane?.partnerChainKey) return false;
  return (
    bridgeLane.partnerChainKey === currentLane.partnerChainKey &&
    sameAddress(bridgeLane.contractAddress, currentLane.contractAddress) &&
    sameAddress(bridgeLane.collateralAddress, currentLane.collateralAddress)
  );
}

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

export function canActOnBridge(
  bridgeAccount: string,
  connectedAccount: string | undefined,
): boolean {
  if (!connectedAccount) return false;
  return bridgeAccount.toLowerCase() === connectedAccount.toLowerCase();
}

import type { ExtendedChain } from "@lifi/sdk";

/**
 * Validation for chain metadata fetched from LI.FI's `/chains` endpoint.
 *
 * This third-party data feeds the bridge's RPC clients and
 * `wallet_addEthereumChain` (deciding which RPC the user's WALLET talks to).
 *
 * A malicious or merely malformed response could therefore point a real chain at
 * an attacker-controlled RPC. That RPC can present forged balances and contract
 * state, induce an approval or bridge signature taken under that false view, and
 * relay the signed transaction to the real network. So the response is treated
 * as untrusted input rather than configuration.
 *
 * The app's configured chains keep their existing wagmi transports. The bridge
 * provider uses this metadata only when switching to an additional source chain.
 */

/** Max plausible decimals for a native currency; guards absurd/hostile values. */
const MAX_DECIMALS = 36;

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    // Plain http is rejected: it is both downgradeable and, for a wallet-facing
    // RPC, an obvious interception point.
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * True when the metadata is internally consistent and safe to hand to wagmi or
 * a wallet. `expectedId`, when given, must match — so a response cannot smuggle
 * metadata for one chain under another chain's id.
 */
export function isTrustworthyChainMetadata(
  meta: ExtendedChain | undefined,
  expectedId?: number,
): boolean {
  if (!meta || !isPositiveInt(meta.id)) return false;
  if (expectedId !== undefined && meta.id !== expectedId) return false;

  const metamask = meta.metamask;
  if (!metamask) return false;

  // The hex chainId the wallet is asked to trust must agree with the numeric id
  // the app is registering. A mismatch is the exact shape of a swap attack.
  const declared = Number.parseInt(String(metamask.chainId), 16);
  if (declared !== meta.id) return false;

  // Passed straight into wallet_addEthereumChain and the viem client we build,
  // so it has to be present — otherwise the chain looks selectable and fails
  // only once execution reaches the wallet prompt.
  if (typeof metamask.chainName !== "string" || metamask.chainName.length === 0) {
    return false;
  }

  const rpcUrls = metamask.rpcUrls;
  if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) return false;
  if (!rpcUrls.every(isHttpsUrl)) return false;

  // Required, not optional: `convertExtendedChain` does
  // `chain.metamask.blockExplorerUrls.reduce(...)` with no guard, so an entry
  // without explorers throws during conversion and takes the whole sync down to
  // `degraded`. Rejecting it here drops one chain instead of all of them.
  const explorers = metamask.blockExplorerUrls;
  if (!Array.isArray(explorers) || explorers.length === 0) return false;
  if (!explorers.every(isHttpsUrl)) return false;

  // EIP-3085 requires name, symbol and decimals. Failing closed here beats
  // offering the chain and having wallet_addEthereumChain reject it only once
  // the user tries to execute.
  const currency = metamask.nativeCurrency;
  if (!currency) return false;
  if (typeof currency.name !== "string" || currency.name.length === 0) {
    return false;
  }
  if (typeof currency.symbol !== "string" || currency.symbol.length === 0) {
    return false;
  }
  if (
    typeof currency.decimals !== "number" ||
    !Number.isInteger(currency.decimals) ||
    currency.decimals < 0 ||
    currency.decimals > MAX_DECIMALS
  ) {
    return false;
  }

  return true;
}

/**
 * Keep only chains whose metadata passes validation. Anything rejected is
 * logged — silently dropping a chain would look identical to LI.FI not
 * supporting it, which is a confusing thing to debug.
 */
export function filterTrustworthyChains(
  chains: readonly ExtendedChain[],
): ExtendedChain[] {
  const kept: ExtendedChain[] = [];
  const rejected: number[] = [];
  const seen = new Set<number>();
  for (const chain of chains) {
    if (!isTrustworthyChainMetadata(chain)) {
      rejected.push(chain?.id);
      continue;
    }
    // Deduplicate by id, keeping the FIRST entry. LI.FI's own `getChainById`
    // resolves first-match, so keeping the last would let the metadata used for
    // routing diverge from the metadata handed to wallet_addEthereumChain.
    if (seen.has(chain.id)) {
      rejected.push(chain.id);
      continue;
    }
    seen.add(chain.id);
    kept.push(chain);
  }
  if (rejected.length > 0) {
    console.warn(
      "[bridge] dropped LI.FI chains with unusable or untrusted metadata:",
      rejected,
    );
  }
  return kept;
}

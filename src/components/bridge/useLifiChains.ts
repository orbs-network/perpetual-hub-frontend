import { useEffect, useState } from "react";
import { ChainType, getChains, type ExtendedChain } from "@lifi/sdk";
import { filterTrustworthyChains } from "./validateLifiChain";

/** Give up rather than gate the page on a third party forever. */
const CHAIN_FETCH_TIMEOUT_MS = 12_000;

export type LifiChainsState =
  | { status: "loading" }
  | { status: "ready"; chains: ExtendedChain[]; byId: Map<number, ExtendedChain> }
  /** Chain list unavailable — the widget cannot validate provider support. */
  | { status: "degraded" };

/**
 * Loads and validates LI.FI's EVM chain list.
 *
 * Deliberately does nothing else. An earlier version of this hook also widened
 * the app's shared wagmi chain list and monkey-patched the connected connector,
 * which is what forced a long tail of teardown races, remount leaks and — not
 * fixable at all — WalletConnect session invalidation. `createBridgeEvmProvider`
 * replaced that by owning LI.FI's chain switching directly, so this hook has no
 * global state to mutate and nothing to unwind.
 */
export function useLifiChains(): LifiChainsState {
  const [state, setState] = useState<LifiChainsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        // Deliberately NOT aborted on unmount. `@lifi/sdk` dedupes `getChains`
        // by URL, so the promise is shared: aborting it during one mount's
        // cleanup would cancel the fetch a remount is already awaiting, and
        // force a healthy LI.FI into `degraded` on any quick back/forward.
        // The timeout is raced instead, and `cancelled` just ignores a late
        // result.
        const response = await Promise.race([
          getChains({ chainTypes: [ChainType.EVM] }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("timed out loading LI.FI chains")),
              CHAIN_FETCH_TIMEOUT_MS,
            );
          }),
        ]);
        if (cancelled) return;

        // Untrusted input: this decides which RPC the app — and, via
        // wallet_addEthereumChain, the user's WALLET — will talk to.
        const chains = filterTrustworthyChains(response);
        if (chains.length === 0) {
          console.error("[bridge] no usable chain metadata from LI.FI");
          setState({ status: "degraded" });
          return;
        }

        setState({
          status: "ready",
          chains,
          byId: new Map(chains.map((chain) => [chain.id, chain])),
        });
      } catch (error) {
        if (cancelled) return;
        console.error("[bridge] failed to load LI.FI chain list", error);
        setState({ status: "degraded" });
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return state;
}

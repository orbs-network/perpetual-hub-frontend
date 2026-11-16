import type { Config, Connector } from "wagmi";

const patched = new WeakSet<Connector>();

/**
 * Make `wallet_getCapabilities` throw for a connector's provider.
 *
 * EIP-5792 (`wallet_sendCalls` / `wallet_getCapabilities`) is the wallet-side
 * spec for atomic batched transactions. MetaMask implements it on top of
 * EIP-7702: when a dApp advertises 5792 support and requests a batch, MM offers
 * to upgrade the user's EOA to a Smart Account.
 *
 * Once enrolled, MM globally routes every approve through its
 * `Delegation7702PublishHook`. That hook fails on chains which have not
 * activated 7702, and the failure is not recoverable from the dApp side — the
 * user simply cannot approve or deposit any more, on any page, until they
 * switch the account back to Standard in MetaMask.
 *
 * Throwing here makes SDKs that probe for batching treat the wallet as
 * non-batching and fall back to sequential transactions, which never trigger
 * the Smart Account upgrade prompt. LI.FI probes exactly this way, via viem's
 * `getCapabilities` (`useIsBatchingSupported` → `isBatchingSupported`).
 *
 * This is installed GLOBALLY rather than on the bridge route, because the
 * damage is global: enrollment triggered by the bridge would break the ordinary
 * deposit flow too. `perps-frontend` learned this from real user reports
 * (orbs-network/perps-frontend#387, #389, #390) and made the same call.
 *
 * Idempotent — a connector is patched at most once.
 *
 * Returns true if the connector was (or already had been) patched, false if it
 * is not a real connector instance. See `installGlobalBatchingCapabilityBlock`.
 */
export function disableBatchingCapability(connector: Connector): boolean {
  // `config.state.connections` is REHYDRATED from storage on load, and wagmi
  // persists each connection's connector as a bare `{id, name, type, uid}`
  // (see partialize() in @wagmi/core's createConfig). That stub has no methods,
  // so touching `getProvider` on it throws — and because this runs from an
  // effect in App, the throw took the ENTIRE app down to a white screen for any
  // user who had connected a wallet before. Skip it; the real Connector arrives
  // when reconnection completes and the subscription below patches it then.
  if (typeof connector?.getProvider !== "function") return false;

  if (patched.has(connector)) return true;
  patched.add(connector);

  const originalGetProvider = connector.getProvider.bind(connector);
  connector.getProvider = async (...args: Parameters<typeof originalGetProvider>) => {
    const provider = (await originalGetProvider(...args)) as {
      request: (req: { method?: string }) => Promise<unknown>;
    };
    // Prototype-chained rather than mutated: the provider object is shared and
    // may be handed out elsewhere, so we override `request` only for callers
    // that go through this connector.
    const wrapped = Object.create(provider) as typeof provider;
    wrapped.request = async (req: { method?: string }) => {
      if (req?.method === "wallet_getCapabilities") {
        throw new Error(
          "wallet_getCapabilities disabled to prevent EIP-7702 enrollment",
        );
      }
      return provider.request(req);
    };
    return wrapped;
  };
  return true;
}

/**
 * Block `wallet_getCapabilities` on every connector for the life of the app.
 *
 * Patches `config.connectors` — the real, instantiated connectors — plus any
 * connector attached to a live connection, then watches for new connections.
 *
 * `config.connectors` is the reliable source: connections rehydrated from
 * storage carry a stripped connector stub until reconnection replaces it, so
 * relying on connections alone would leave a just-reconnected wallet unpatched
 * until its next connection event.
 *
 * Returns an unsubscribe function.
 */
export function installGlobalBatchingCapabilityBlock(config: Config): () => void {
  for (const connector of config.connectors) {
    disableBatchingCapability(connector);
  }
  for (const { connector } of config.state.connections.values()) {
    disableBatchingCapability(connector);
  }

  return config.subscribe(
    (state) => state.connections,
    (connections) => {
      for (const { connector } of connections.values()) {
        disableBatchingCapability(connector);
      }
    },
  );
}

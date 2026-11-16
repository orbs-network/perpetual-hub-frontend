import { createWalletClient, custom, type Client } from "viem";
import type { Config } from "wagmi";
import { getConnectorClient, switchChain } from "wagmi/actions";
import { EVM, type ExtendedChain } from "@lifi/sdk";
import { isTrustworthyChainMetadata } from "./validateLifiChain";

/**
 * A LI.FI EVM provider that uses the app's existing wallet connection but owns
 * its own chain switching.
 *
 * ## Why this exists
 *
 * The widget's DEFAULT EVM provider (`SDKProviders.js`) does:
 *
 *   switchChain: async (chainId) => {
 *     const chain = await switchChain(wagmiConfig, { chainId })   // <-- throws
 *     return getConnectorClient(wagmiConfig, { chainId: chain.id })
 *   }
 *
 * `switchChain` resolves the target against `config.chains` and throws
 * `ChainNotConfiguredError` for anything the app does not configure. The app
 * configures the partner API's deposit chains; LI.FI can offer more source chains.
 *
 * The previous approach widened the app's shared `config.chains` at runtime and
 * monkey-patched the connected connector to compensate. That works, but it
 * mutates global wallet state on a route, and it has a defect no amount of care
 * fixes: WalletConnect's `isChainsStale()` compares live `config.chains` against
 * the session's requested chains, and `isAuthorized()` DISCONNECTS on mismatch
 * (`@wagmi/connectors/walletConnect.js`, `isNewChainsStale` defaults true).
 *
 * Supplying our own provider removes the need for any of that: LI.FI installs
 * its wagmi-backed default only when no EVM provider is configured, so this
 * replaces the one call that was forcing the problem. The app's chain list is
 * never touched.
 *
 * `getWalletClient` still resolves through the app's wagmi connector, so this is
 * the same wallet and the same account — not a second connection.
 */

type ProviderLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Chain ids the app itself configures — the normal wagmi path handles these. */
function isConfiguredChain(config: Config, chainId: number): boolean {
  return config.chains.some((chain) => chain.id === chainId);
}

/** EIP-1193 userRejectedRequest. */
function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: number })?.code;
  const nested = (error as { data?: { originalError?: { code?: number } } })?.data
    ?.originalError?.code;
  return code === 4001 || nested === 4001;
}

function isWalletConnect(connectorId: string | undefined): boolean {
  return String(connectorId ?? "").toLowerCase().includes("walletconnect");
}

export class BridgeChainSwitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeChainSwitchError";
  }
}

/**
 * How long to let a wallet settle after it reports a successful switch.
 * Overridable so tests need not sleep; production uses the defaults.
 */
export type SettleOptions = { timeoutMs?: number; intervalMs?: number };

const CHAIN_SETTLE_TIMEOUT_MS = 3_000;
const CHAIN_SETTLE_INTERVAL_MS = 250;

/**
 * Poll until the wallet reports the target chain, or give up.
 *
 * Some wallets apply `wallet_addEthereumChain` / `wallet_switchEthereumChain`
 * asynchronously and briefly keep reporting the previous chain, so a single
 * read would misclassify a working switch as a failure.
 */
async function waitForChain(
  connector: { getChainId: () => Promise<number> },
  chainId: number,
  { timeoutMs = CHAIN_SETTLE_TIMEOUT_MS, intervalMs = CHAIN_SETTLE_INTERVAL_MS }:
    SettleOptions = {},
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let actual = await connector.getChainId();
  while (actual !== chainId && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    actual = await connector.getChainId();
  }
  return actual;
}

export interface BridgeEvmProviderOptions {
  config: Config;
  /** Validated LI.FI chain metadata, keyed by chain id. */
  chainMetadata: ReadonlyMap<number, ExtendedChain>;
  /** Test seam for the post-switch settle poll. */
  settle?: SettleOptions;
}

/**
 * Switch the wallet to `chainId` and return a client for it.
 *
 * Exported for tests; `createBridgeEvmProvider` wires it into the SDK.
 */
export async function switchBridgeChain(
  { config, chainMetadata, settle }: BridgeEvmProviderOptions,
  chainId: number,
): Promise<Client | undefined> {
  // Chains the app configures: let wagmi do it. It handles connector-specific
  // behaviour, the `change` event that keeps the store in sync, and
  // WalletConnect's requested-chain bookkeeping — none of which we want to
  // reimplement.
  if (isConfiguredChain(config, chainId)) {
    const chain = await switchChain(config, { chainId });
    return getConnectorClient(config, { chainId: chain.id });
  }

  const uid = config.state.current;
  const connection = uid ? config.state.connections.get(uid) : undefined;
  const connector = connection?.connector;
  if (!connector) {
    throw new BridgeChainSwitchError("No wallet is connected.");
  }

  // WalletConnect sessions are approved for a chain set agreed at connect time.
  // A raw `wallet_switchEthereumChain` cannot widen that, and going around the
  // connector would desync its requested-chain bookkeeping. Fail with something
  // actionable instead of a confusing wallet-level rejection.
  if (isWalletConnect(connector.id)) {
    throw new BridgeChainSwitchError(
      "This wallet can only bridge from networks the app already supports. " +
        "Switch to one of them, or reconnect with a browser wallet.",
    );
  }

  const meta = chainMetadata.get(chainId);
  // Re-validated against the requested id: this decides which RPC the user's
  // WALLET will trust for this chain, and the metadata is third-party input.
  if (!meta || !isTrustworthyChainMetadata(meta, chainId)) {
    throw new BridgeChainSwitchError(
      `No trustworthy network details available for chain ${chainId}.`,
    );
  }

  const provider = (await connector.getProvider()) as ProviderLike;
  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    const nested = (error as { data?: { originalError?: { code?: number } } })
      ?.data?.originalError?.code;
    // 4902: the wallet does not know this chain yet.
    if (code !== 4902 && nested !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: meta.metamask.chainName,
          // `metamask.nativeCurrency` is the EIP-3085 shape. `meta.nativeToken`
          // is a LI.FI `Token` (address, priceUSD, ...) and is not valid here.
          nativeCurrency: meta.metamask.nativeCurrency,
          rpcUrls: meta.metamask.rpcUrls,
          blockExplorerUrls: meta.metamask.blockExplorerUrls,
        },
      ],
    });

    // Some wallets treat wallet_addEthereumChain as "add only" rather than
    // "add and switch", so without this follow-up they stay on the old network
    // and the switch is reported as failed even though the user approved the
    // add — blocking the first bridge from any previously unknown chain.
    //
    // Most errors are tolerated (the wallet may already have switched, and the
    // poll below is what decides) EXCEPT an explicit rejection: this prompt is
    // user-facing, and swallowing a 4001 would resurface it as a generic
    // "did not switch" only after the settle timeout, misreporting a deliberate
    // cancellation as an internal failure.
    await provider
      .request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      })
      .catch((followUpError: unknown) => {
        if (isUserRejection(followUpError)) throw followUpError;
        return undefined;
      });
  }

  // Adding a chain does not guarantee the wallet moved to it — several wallets
  // add and stay put, and others apply it asynchronously. Returning a client
  // without checking would have LI.FI sign against the wrong network; checking
  // only once would reject a switch that was about to land. wagmi's own
  // MetaMask connector has the same post-add retry for the same reason.
  const actual = await waitForChain(connector, chainId, settle);
  if (actual !== chainId) {
    throw new BridgeChainSwitchError(
      "The wallet did not switch to the selected network.",
    );
  }

  // Tell wagmi the chain moved.
  //
  // Going direct to the provider bypasses the connector's own `switchChain`,
  // and with it the synthetic `change` event wagmi emits for wallets that
  // switch without firing `chainChanged` (injected/MetaMask notably). Without
  // this, `config.state.connections` keeps the OLD chain: the first bridge
  // works because `getChainId()` reads the provider directly, but the next
  // `getConnectorClient` throws ConnectorChainMismatchError and any UI reading
  // the current chain stays stale.
  connector.emitter?.emit("change", { chainId });

  const [account] = await connector.getAccounts();
  if (!account) {
    throw new BridgeChainSwitchError("No account available after switching.");
  }

  // Built directly rather than via `getConnectorClient`, which would resolve the
  // chain against `config.chains` and fail for exactly the chains this path
  // exists to serve. `convertExtendedChain` gives a real viem Chain.
  return createWalletClient({
    account,
    chain: {
      id: chainId,
      name: meta.metamask.chainName,
      nativeCurrency: meta.metamask.nativeCurrency,
      rpcUrls: { default: { http: [...meta.metamask.rpcUrls] } },
    },
    transport: custom(provider as Parameters<typeof custom>[0]),
  }) as unknown as Client;
}

/**
 * Build the EVM provider to hand to the widget via `sdkConfig.providers`.
 * Supplying this suppresses LI.FI's own wagmi-backed EVM provider.
 */
export function createBridgeEvmProvider(options: BridgeEvmProviderOptions) {
  return EVM({
    // Same connection the rest of the app uses — no second wallet, and the
    // signer is always the account `toAddress` was derived from.
    //
    // `assertChainId: false` matches the stock LI.FI provider and is load
    // bearing: LI.FI builds its EVM step executor by calling getWalletClient()
    // BEFORE it calls switchChain(). If the wallet's real chain and wagmi's
    // stored connection chain have diverged even briefly — a manual wallet
    // switch, or a previous switch still syncing — asserting here throws
    // ConnectorChainMismatchError and aborts execution before our switchChain
    // ever gets the chance to correct it.
    getWalletClient: () =>
      getConnectorClient(options.config, { assertChainId: false }),
    switchChain: (chainId: number) => switchBridgeChain(options, chainId),
  });
}

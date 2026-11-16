import { useEffect, useMemo } from "react";
import { useAccount, useConfig } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  ChainType,
  DisabledUI,
  HiddenUI,
  LiFiWidget,
  type WidgetConfig,
} from "@lifi/widget";
import { WidgetSkeleton } from "@lifi/widget/skeleton";
import { useWidgetEvents } from "@lifi/widget";
import { partner } from "@/config/partners";
import { allChains, isMobile, walletConnectProjectId } from "@/config/wagmi";
import { RPC_URLS_BY_CHAIN } from "@/config/constants";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useCollateralAddress } from "@/hooks/useCurrentPartnerChain";
import { createBridgeEvmProvider } from "./createBridgeEvmProvider";
import { useDepositLane } from "./useDepositLane";
import { useRecordBridges } from "./useRecordBridges";
import { useLifiChains } from "./useLifiChains";

/**
 * Chains that only exist on a developer machine. Excluded from the RPC map
 * below — this is a "not reachable from a browser on the internet" check, which
 * is separate from provider capability validation. These RPCs serve source and
 * destination networks, and local endpoints must not be handed to a remote SDK.
 */
const LOCAL_ONLY_CHAIN_IDS: readonly number[] = [31337, 1337];

/**
 * Our own RPC endpoints, handed to the LI.FI SDK so bridge quotes and balance
 * reads go through the same providers as the rest of the app.
 *
 * Module-level so the object is referentially stable across mounts — a fresh
 * `rpcUrls` identity makes `SDKClientProvider` re-run `createClient()`.
 * Local-only chains are excluded because a remote SDK cannot reach them.
 */
const SDK_RPC_URLS: Record<number, string[]> = Object.fromEntries(
  Object.entries(RPC_URLS_BY_CHAIN)
    .filter(([chainId]) => !LOCAL_ONLY_CHAIN_IDS.includes(Number(chainId)))
    .map(([chainId, urls]) => [chainId, [...urls]]),
);

interface BridgeWidgetProps {
  /**
   * Destination chain, already resolved and validated by the page. Passed in
   * rather than re-derived so the widget cannot disagree with the value the
   * route guard approved.
   */
  destinationChainId: number;
}

export function BridgeWidget({ destinationChainId }: BridgeWidgetProps) {
  const { t } = useTranslation();
  const { address, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const collateralAddress = useCollateralAddress();
  const wagmiConfig = useConfig();
  const lifiChains = useLifiChains();
  const depositLane = useDepositLane();

  // Record completed bridges so the app-wide watcher can deposit the funds when
  // they land — which is typically minutes later, on another page.
  const widgetEvents = useWidgetEvents();
  useRecordBridges(widgetEvents, address, depositLane);

  // A missing/malformed collateral address is a partner misconfiguration, not a
  // transient state — surface it instead of rendering an empty page.
  useEffect(() => {
    if (!collateralAddress) {
      console.error(
        "[bridge] no valid USDC address resolved for chain",
        destinationChainId,
        "— check the partner chain API response",
      );
    }
  }, [collateralAddress, destinationChainId]);

  // A WalletConnect session is approved for a chain set agreed at connect time,
  // so `switchBridgeChain` refuses anything outside the configured list for it.
  // The selector must agree, or mobile users can quote routes that are
  // guaranteed to fail the moment execution starts.
  // Before a mobile connection, use the conservative session chain set when
  // WalletConnect is available. Without a project ID only injected wallets are
  // offered, so the validated provider source list remains available.
  const isWalletConnect =
    String(connector?.id ?? "").toLowerCase().includes("walletconnect") ||
    (!connector && isMobile && !!walletConnectProjectId);

  // Validated endpoints, keyed by chain id, for the SDK's own reads.
  const validatedRpcUrls = useMemo(() => {
    if (lifiChains.status !== "ready") return {};
    return Object.fromEntries(
      lifiChains.chains.map((chain) => [
        chain.id,
        [...chain.metamask.rpcUrls],
      ]),
    ) as Record<number, string[]>;
  }, [lifiChains]);

  const widgetConfig = useMemo<Omit<WidgetConfig, "integrator"> | undefined>(() => {
    if (!collateralAddress) return undefined;

    return {
      // Destination is fixed to this partner's deposit chain and collateral
      // token. `toChain`/`toToken` alone are only *initial form values*, so the
      // destination token selector is disabled and the destination chain list
      // is restricted to one entry — otherwise the user could bridge to a
      // chain/token the deposit flow cannot spend from.
      toChain: destinationChainId,
      toToken: collateralAddress,
      // REQUIRED — do not remove without reading this.
      //
      // Without it the widget returns "No routes available" for EVERY pair and
      // never issues a route request at all.
      //
      // `useRoutes`' queryFn parses BOTH amounts unconditionally:
      //   parseUnits(toTokenAmount, toToken.decimals)
      // and `toAmount` is the empty string whenever the user types only a FROM
      // amount, which is the normal case. viem <=2.41 returned 0n for
      // `parseUnits("")`; current viem (2.55) throws InvalidDecimalNumberError.
      // The query function therefore throws before any network call and the UI
      // reports "no routes".
      //
      // @lifi/widget@3.40.12 is the newest 3.x, so there is no upgrade that
      // fixes it, and pinning viem back would drag the whole app (and wagmi)
      // to an older version. Seeding "0" keeps the form value parseable.
      // perps-frontend does not hit this only because it runs viem 2.41.2.
      toAmount: "0",
      chains: {
        to: { allow: [destinationChainId] },
        // EVM only. Our wallet layer is RainbowKit/wagmi, so a Solana, Sui, or
        // Bitcoin source is not connectable here and would only offer the user
        // a route they cannot sign.
        types: { allow: [ChainType.EVM] },
        // Restrict the SOURCE selector to chains we can actually switch to.
        //
        // This is always set, not just in degraded mode, because the widget
        // re-fetches its own chain catalog (`useAvailableChains` calls
        // `getChains()` and `config.setChains()` on a 5-minute interval),
        // which overwrites `sdkConfig.chains` and would otherwise repopulate
        // the selector with entries our validation rejected. `from.allow` is
        // the widget's own supported mechanism and survives that refetch.
        //
        // Our provider's `switchChain` re-validates anyway, so an unvalidated
        // chain could never be switched to — but it would fail after the user
        // picked it, which is a worse experience than not offering it.
        from: {
          allow:
            lifiChains.status === "ready"
              ? isWalletConnect
                ? allChains.filter((chain) => lifiChains.byId.has(chain.id)).map((chain) => chain.id)
                : lifiChains.chains.map((chain) => chain.id)
              : [],
        },
      },
      disabledUI: [DisabledUI.ToToken],
      // Recipient is always the connected wallet. Set unconditionally so the
      // key is always present: the widget's form store keys its reset on
      // `Object.hasOwn(config, "toAddress")`, so a conditional spread would
      // leave the previous account in place across a disconnect.
      toAddress: address ? { address, chainType: ChainType.EVM } : undefined,
      hiddenUI: [HiddenUI.ToAddress],
      appearance: "dark",
      sdkConfig: {
        // Seeded with the app's own endpoints AND the validated LI.FI ones.
        //
        // The widget re-fetches `/chains` every 5 minutes and calls
        // `config.setChains(raw)`, which feeds each chain's metamask.rpcUrls
        // into the SDK. `setRPCUrls` only APPENDS when a chain already has
        // entries, so seeding validated URLs here keeps ours first in the list
        // and therefore preferred. It does not fully exclude a later-appended
        // entry; our bridge provider validates chain metadata again before use.
        rpcUrls: {
          ...(lifiChains.status === "ready" ? validatedRpcUrls : {}),
          ...SDK_RPC_URLS,
        },
        ...(lifiChains.status === "ready" && {
          // The widget still needs LI.FI's catalog for routing and for
          // getChainById during execution.
          chains: lifiChains.chains,
          preloadChains: false,
          // Supplying an EVM provider suppresses LI.FI's own wagmi-backed one,
          // whose switchChain calls wagmi's switchChain and therefore throws
          // ChainNotConfiguredError for any chain the app does not configure.
          // Owning that hook is what lets us leave the app's shared wagmi
          // config — and WalletConnect's session — completely alone.
          providers: [
            createBridgeEvmProvider({
              config: wagmiConfig,
              chainMetadata: lifiChains.byId,
            }),
          ],
        }),
      },
      // The widget detects our WagmiProvider and reuses the existing
      // connection; this only routes its "connect" affordance to RainbowKit.
      walletConfig: {
        onConnect: () => {
          openConnectModal?.();
        },
      },
    };
  }, [
    destinationChainId,
    collateralAddress,
    address,
    openConnectModal,
    lifiChains,
    wagmiConfig,
    isWalletConnect,
    validatedRpcUrls,
  ]);

  // Checked BEFORE the loading skeleton: an invalid collateral address is a
  // permanent partner misconfiguration, not a transient state, so hiding it
  // behind the skeleton would present a hard failure as a 12s hang.
  if (
    !widgetConfig || lifiChains.status === "degraded" ||
    (lifiChains.status === "ready" && !lifiChains.byId.has(destinationChainId))
  ) {
    return (
      <div
        className="rounded-lg border border-edge bg-surface px-4 py-6 text-center text-xs text-content-muted"
        data-testid="bridge-unavailable"
      >
        {t("Bridging is unavailable right now. Please try again later.")}
      </div>
    );
  }

  // Wait for the chain list before mounting. Mounting first and letting the
  // config change on `loading -> ready` would hand LiFiWidget a new config
  // object, re-initialising its SDK client and resetting a form the user may
  // already have filled in.
  if (lifiChains.status === "loading") {
    return <WidgetSkeleton config={{ appearance: "dark" }} />;
  }

  // `integrator` is passed only as a prop: LiFiWidget merges `{...props,
  // ...props.config}`, so a duplicate inside `config` would silently win over
  // any future override made here.
  //
  // The `key` forces a remount when the connector class changes. LI.FI keeps
  // the chosen `fromChain` in form state even when `chains.from.allow` shrinks,
  // so a desktop user who opens /bridge disconnected, picks an unconfigured
  // source, then connects with WalletConnect would keep quoting a route
  // `switchBridgeChain` must reject at execution. Remounting clears it, and it
  // only happens on that transition — not on ordinary account changes.
  return (
    <LiFiWidget
      key={isWalletConnect ? "wc" : "standard"}
      integrator={partner.id}
      config={widgetConfig}
    />
  );
}

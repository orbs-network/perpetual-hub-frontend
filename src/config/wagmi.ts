import { createConfig, fallback, http } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { walletConnectWallet, metaMaskWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import type { Chain } from 'viem';
import { partner, publicEnvironment } from './partners';
import { getAppTargetChainId, getPartnerChainIds } from '@/utils/config';
import { getChainDetails } from './chains';
import { RPC_URLS_BY_CHAIN } from './constants';

import { isPartnerApprovalPending } from './partners/availability';

export const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function getChain(chainId: number): Chain {
  return getChainDetails(chainId);
}

const appTargetChainId = getAppTargetChainId();

const configuredChainIds = [appTargetChainId, ...getPartnerChainIds(partner.chains)].filter(
  (chainId, index, chainIds) => chainIds.indexOf(chainId) === index,
);
const configuredChains = configuredChainIds.map((chainId) => getChain(chainId));
export const allChains = configuredChains as [Chain, ...Chain[]];

export function getTransport(chain: Chain) {
  const configuredRpcUrls = RPC_URLS_BY_CHAIN[chain.id];

  // API-provided chains without an RPC override use their catalog endpoints.
  const rpcUrls = configuredRpcUrls?.length
    ? configuredRpcUrls
    : chain.rpcUrls?.default?.http ?? [];
  // A hanging provider must release the request to a backup promptly. Viem's
  // fallback tries each endpoint once before retrying the whole list; keep its
  // default terminal handling for contract reverts and wallet rejections.
  const httpOptions = { timeout: 5_000 };
  if (rpcUrls.length > 1) {
    return fallback(rpcUrls.map((url) => http(url, httpOptions)), { retryCount: 2 });
  }
  if (rpcUrls.length === 1) return http(rpcUrls[0], httpOptions);

  // No endpoint anywhere. Bare `http()` would throw `UrlRequiredError` inside
  // `createClient` — i.e. during render, reproducing the very crash this
  // factory exists to prevent. Hand back a transport that constructs fine and
  // fails at request time instead, so the failure surfaces as a query error.
  return http(UNREACHABLE_RPC_URL, httpOptions);
}

/**
 * Placeholder endpoint for a chain that declares no RPC at all. Deliberately a
 * `.invalid` host (RFC 2606, guaranteed not to resolve) so a request fails
 * fast and locally rather than reaching anything real.
 */
const UNREACHABLE_RPC_URL = "http://rpc-unavailable.invalid";

/**
 * A `transports` map that answers for ANY chain id, not just the ones known at
 * `createConfig` time.
 *
 * The problem: a plain record is fixed at construction and has no setter, so a
 * chain outside that initial set resolves to
 * `undefined` and `config.getClient()` throws `TypeError:
 * rest.transports[chainId] is not a function`. RainbowKit resolves a public
 * client during render on every page, so that surfaces as an app-wide render
 * crash rather than a caught error.
 *
 * Why a Proxy rather than wagmi's `client` factory option: `client` bypasses
 * wagmi's own client construction, which silently costs us `batch: { multicall:
 * true }` (every batched contract read becomes an individual `eth_call`) and
 * the injection of the connectors store into the transport. It also leaves
 * `config.transports` undefined, which matters because the WALLET reads it —
 * WalletConnect and the MetaMask SDK build their session `rpcMap` from
 * `extractRpcUrls({ chain, transports: config.transports })`, falling back to
 * viem's public defaults when absent rather than our configured RPC fallbacks.
 *
 * Keeping the transports path and making the map total preserves all of that.
 * Both callers invoke the entry as `transports[chainId]({ chain, ... })`, so the
 * chain is available at call time and the transport is derived from it.
 */
const transports = new Proxy({} as Record<number, ReturnType<typeof getTransport>>, {
  get(_target, key) {
    // React/devtools probe Symbol.toStringTag when inspecting context values.
    // Symbols are metadata, not chain IDs, and Number(symbol) throws.
    if (typeof key === 'symbol') return undefined;
    const chainId = Number(key);
    if (!Number.isFinite(chainId)) return undefined;
    return ((parameters: { chain?: Chain }) => {
      const chain =
        parameters?.chain ?? allChains.find((candidate) => candidate.id === chainId);
      if (!chain) return http(UNREACHABLE_RPC_URL)(parameters as never);
      return getTransport(chain)(parameters as never);
    }) as unknown as ReturnType<typeof getTransport>;
  },
  has() {
    return true;
  },
});

export const walletConnectProjectId = publicEnvironment.walletConnectProjectId;

export const wallets = isMobile
  ? [{ groupName: 'Connect', wallets: walletConnectProjectId ? [walletConnectWallet, injectedWallet] : [injectedWallet] }]
  : [{ groupName: 'Popular', wallets: [
      ...(walletConnectProjectId ? [metaMaskWallet, walletConnectWallet] : []),
      injectedWallet,
    ] }];

/**
 * Wallet connectors, built explicitly rather than via RainbowKit's
 * `getDefaultConfig`.
 *
 * `getDefaultConfig` is a thin wrapper that calls `connectorsForWallets` and
 * then `createConfig`. `connectorsForWallets` supplies the configured partner
 * name and current-origin icon to wallet connection metadata.
 */
const walletIcon = partner.favicon || partner.logoUrl;

export const connectors = isPartnerApprovalPending() ? [] : connectorsForWallets(wallets, {
  appName: partner.name,
  appIcon: walletIcon && typeof window !== 'undefined'
    ? new URL(walletIcon, window.location.origin).href
    : undefined,
  projectId: walletConnectProjectId,
});

export const wagmiConfig = createConfig({
  chains: allChains,
  connectors,
  transports,
  ...(isPartnerApprovalPending()
    ? { storage: null, multiInjectedProviderDiscovery: false }
    : {}),
});

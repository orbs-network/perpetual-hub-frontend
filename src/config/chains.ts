import type { Chain } from "viem";
import * as viemChains from "viem/chains";
import {
  arbitrum,
  base,
  bsc,
  mainnet,
  monad,
  plasma,
  polygon,
  robinhood,
  sei,
  sonic,
} from "viem/chains";

const _getChainLogoUrl = (chainId: number) => {
  return `/chain-logos/${chainId}.svg`;
}

export const CHAIN_LOGO_URLS: Record<number, string> = {
  [arbitrum.id]: _getChainLogoUrl(arbitrum.id),
  [bsc.id]: _getChainLogoUrl(bsc.id),
  [base.id]: _getChainLogoUrl(base.id),
  [mainnet.id]: _getChainLogoUrl(mainnet.id),
  [monad.id]: '/chain-logos/143.png',
  [plasma.id]: _getChainLogoUrl(plasma.id),
  [polygon.id]: '/chain-logos/137.png',
  [robinhood.id]: '/chain-logos/4663.jpg',
  [sei.id]: _getChainLogoUrl(sei.id),
  [sonic.id]: '/chain-logos/146.png',
};

const availableChains: readonly Chain[] = Object.values(viemChains);

export function findChainById(chainId: number): Chain | undefined {
  return availableChains.find((chain) => chain.id === chainId);
}

export function getFallbackChain(chainId: number): Chain {
  return {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: { default: { http: [] } },
  };
}

export function getChainDetails(chainId: number): Chain {
  const chain = findChainById(chainId);
  // Preserve the existing compact wallet network label.
  if (chain?.id === arbitrum.id) return { ...chain, name: "Arbitrum" };
  return chain ?? getFallbackChain(chainId);
}

export function getChainLogoUrl(chainId: number) {
  return CHAIN_LOGO_URLS[chainId];
}

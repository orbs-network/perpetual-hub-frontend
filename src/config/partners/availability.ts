import { zeroAddress } from 'viem';
import { registry } from './registry';
import type { PartnerChainConfig } from './types';

// Resolved once during bootstrap, before importing the app or constructing wallets.
let partnerApprovalPending = false;

export function setPartnerApprovalPending(pending: boolean): void {
  partnerApprovalPending = pending;
}

export function isPartnerApprovalPending(): boolean {
  return partnerApprovalPending;
}

const PUBLIC_DISPLAY_PATHS = new Set([
  '/api/v1/markets',
  '/api/v1/admin/config',
  '/api/v1/market-data',
  '/api/v1/market-data/klines',
  '/api/v1/market-data/depth',
  '/api/v1/leverage/allowed',
]);

/** Display metadata only: read-only mode never installs tradable contract addresses. */
export function getReadOnlyDisplayChains(): readonly PartnerChainConfig[] {
  return registry.chains.map((chain) => Object.freeze({
    ...chain,
    contractAddress: zeroAddress,
    collateralAddress: zeroAddress,
  }));
}

/** Only existing public market/config reads may use the public display data lane. */
export function getPublicDisplayReadIdentity(
  method: string | undefined,
  path: string | undefined,
): { partnerId: string; chainId: number; partnerChainKey: string } | null {
  if ((method ?? 'get').toLowerCase() !== 'get' || !path || !PUBLIC_DISPLAY_PATHS.has(path)) {
    return null;
  }
  const chainId = registry.chains[0].chainId;
  return { partnerId: registry.partnerId, chainId, partnerChainKey: `${registry.partnerId}:${chainId}` };
}

import { isAddress, zeroAddress } from 'viem';
import type { PartnerChainConfig } from '@/config/partners/types';
import { registry } from '@/config/partners/registry';
import { findChainById } from '@/config/chains';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContractAddress(value: unknown): value is string {
  return typeof value === 'string' && isAddress(value, { strict: false }) && value.toLowerCase() !== zeroAddress;
}

/** Validate the API boundary before any wallet or account queries can start. */
export function parsePartnerChains(response: unknown, partnerId: string): readonly PartnerChainConfig[] {
  if (!isRecord(response) || response.partnerId !== partnerId || !Array.isArray(response.chains)) {
    throw new Error('Invalid partner chains response');
  }
  if (!response.chains.length) {
    throw new Error('No chains are available for this partner');
  }
  const seen = new Set<number>();
  return Object.freeze(response.chains.map((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.chainId !== 'number' || !Number.isSafeInteger(entry.chainId) || entry.chainId <= 0 ||
      !findChainById(entry.chainId) || seen.has(entry.chainId) ||
      typeof entry.chainName !== 'string' || !entry.chainName.trim() ||
      (entry.collateralDecimals !== 6 && entry.collateralDecimals !== 18) ||
      typeof entry.collateralSymbol !== 'string' || !entry.collateralSymbol.trim() ||
      !isContractAddress(entry.contractAddress) || !isContractAddress(entry.collateralAddress)
    ) {
      throw new Error('Invalid partner chain configuration');
    }
    seen.add(entry.chainId);
    return Object.freeze({
      chainId: entry.chainId,
      chainName: entry.chainName.trim(),
      collateralDecimals: entry.collateralDecimals,
      collateralSymbol: entry.collateralSymbol.trim(),
      collateralAddress: entry.collateralAddress,
      contractAddress: entry.contractAddress,
    });
  }));
}

/**
 * Temporary asynchronous mock API, explicitly requested for chain discovery.
 * Replace this function's transport with the partner-ID endpoint when available.
 * Do not use the trading API client: its headers require an already loaded chain.
 */
export async function fetchPartnerChains(partnerId: string): Promise<readonly PartnerChainConfig[]> {
  const response: unknown = await Promise.resolve(
    partnerId === registry.partnerId
      ? structuredClone(registry)
      : { partnerId, chains: [] },
  );
  return parsePartnerChains(response, partnerId);
}

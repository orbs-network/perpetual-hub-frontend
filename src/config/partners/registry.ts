import type { PartnerChainConfig } from './types';

/** Local chain registry for the temporary discovery API. Replace with server data. */
export const registry: {
  partnerId: string;
  chains: readonly PartnerChainConfig[];
} = {
  partnerId: 'global',
  chains: [{
    chainId: 42161,
    chainName: 'Arbitrum One',
    collateralDecimals: 6,
    collateralSymbol: 'USDC',
    collateralAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    contractAddress: '0xd2c8793397036f6D2F60A93D3eB28295a3F1B102',
  }],
};

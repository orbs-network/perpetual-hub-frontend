import { fetchPartnerChains } from '@/api/partnerChains';
import { partner, type PartnerChainConfig } from './index';

export type PartnerChainsLoader = (partnerId: string) => Promise<readonly PartnerChainConfig[]>;

/** Complete discovery before importing the app and constructing wallet config. */
export async function loadPartnerChains(loader: PartnerChainsLoader = fetchPartnerChains): Promise<void> {
  const chains = await loader(partner.id);
  if (!chains.length) throw new Error('No chains are available for this partner');
  partner.chains = chains;
}

import { fetchPartnerChains, PartnerApprovalPendingError } from '@/api/partnerChains';
import { partner, type PartnerChainConfig } from './index';
import { getReadOnlyDisplayChains, setPartnerApprovalPending } from './availability';

export type PartnerChainsLoader = (partnerId: string) => Promise<readonly PartnerChainConfig[]>;

/** Complete discovery before importing the app and constructing wallet config. */
export async function loadPartnerChains(loader: PartnerChainsLoader = fetchPartnerChains): Promise<void> {
  try {
    const chains = await loader(partner.id);
    if (!chains.length) throw new PartnerApprovalPendingError();
    partner.chains = chains;
    setPartnerApprovalPending(false);
  } catch (error) {
    // Connection failures and invalid configurations still use the bootstrap retry screen.
    if (!(error instanceof PartnerApprovalPendingError)) throw error;
    partner.chains = getReadOnlyDisplayChains();
    setPartnerApprovalPending(true);
  }
}

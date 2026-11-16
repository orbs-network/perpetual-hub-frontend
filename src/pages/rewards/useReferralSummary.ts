import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  getUserReferralSummary,
  normalizePartnerId,
} from "@/api/referrals";
import { partner } from "@/config/partners";

export function useReferralSummary() {
  const { address: walletAddress } = useAccount();
  const queryClient = useQueryClient();
  const partnerId = normalizePartnerId(partner.id);
  const summaryQuery = useQuery({
    queryKey: ["referralSummary", partnerId, walletAddress],
    queryFn: ({ signal }) =>
      getUserReferralSummary(partnerId, walletAddress!, signal),
    enabled: !!walletAddress,
    retry: 1,
  });
  const refreshSummary = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["referralSummary", partnerId, walletAddress],
    });
  }, [partnerId, queryClient, walletAddress]);

  return {
    refreshSummary,
    summaryQuery,
    walletAddress,
  };
}

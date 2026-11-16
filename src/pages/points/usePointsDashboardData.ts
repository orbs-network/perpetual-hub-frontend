import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  getCampaignUserPointsOrZero,
  listCampaigns,
} from "@/api/campaigns";
import { partner } from "@/config/partners";
import { useCurrentPartnerChain } from "@/hooks/useCurrentPartnerChain";
import {
  buildCampaignPeriodRows,
  isCampaignVisibleOnChain,
  parseInteger,
  sortCampaigns,
  type CampaignPointsEntry,
} from "./pointsUtils";

type PointsDashboardQueryData = {
  campaignPoints: CampaignPointsEntry[];
};

type PointsDashboardData = PointsDashboardQueryData & {
  pointRows: ReturnType<typeof buildCampaignPeriodRows>;
  totalPoints: bigint;
};

export function usePointsDashboardData() {
  const { address } = useAccount();
  const currentChain = useCurrentPartnerChain();
  const walletAddress = address;
  const selectDashboardData = useCallback(
    (data: PointsDashboardQueryData): PointsDashboardData => {
      const realPointRows = buildCampaignPeriodRows(data.campaignPoints);

      return {
        ...data,
        pointRows: realPointRows,
        totalPoints: data.campaignPoints.reduce(
          (sum, entry) => sum + parseInteger(entry.userPoints.totalPoints),
          0n,
        ),
      };
    },
    [],
  );

  const dashboardQuery = useQuery({
    queryKey: [
      "points",
      "dashboard",
      partner.id,
      currentChain.chainId,
      walletAddress?.toLowerCase() ?? "disconnected",
    ],
    queryFn: async ({ signal }): Promise<PointsDashboardQueryData> => {
      if (!walletAddress) {
        return { campaignPoints: [] };
      }

      const pointsAddress = walletAddress;
      const response = await listCampaigns(partner.id, signal);
      const campaigns = response.campaigns
        .filter((campaign) =>
          isCampaignVisibleOnChain(campaign, currentChain.chainId),
        )
        .sort(sortCampaigns);

      return {
        campaignPoints: await Promise.all(
          campaigns.map(async (campaign) => ({
            campaign,
            userPoints: await getCampaignUserPointsOrZero(
              campaign.campaignId,
              pointsAddress,
              signal,
            ),
          })),
        ),
      };
    },
    enabled: !!walletAddress,
    retry: false,
    select: selectDashboardData,
  });

  const isTableLoading = !!walletAddress && dashboardQuery.isLoading;

  return {
    hasUserError: !!walletAddress && dashboardQuery.isError,
    isTableLoading,
    needsWalletConnection: !walletAddress,
    pointRows: dashboardQuery.data?.pointRows ?? [],
    totalPoints: dashboardQuery.data?.totalPoints ?? 0n,
  };
}

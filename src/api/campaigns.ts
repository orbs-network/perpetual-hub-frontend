import apiClient from "./client";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface Campaign {
  campaignId: string;
  partnerId: string;
  name: string;
  startMs: number;
  epochDurationMs: number;
  epochCount: number;
  status: CampaignStatus;
  metadata: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface ListCampaignsResponse {
  campaigns: Campaign[];
}

export interface CampaignPointDepth {
  campaignId: string;
  epoch: number;
  partnerId: string;
  chainId: string;
  userAddress: string;
  depth: number;
  metric: string;
  metricAmount: string;
  weightedScore: string;
  updatedAt: number;
}

export interface CampaignPoint {
  epoch: number;
  userAddress: string;
  directVolume: string;
  referralVolume: string;
  fees: string;
  score: string;
  points: string;
  updatedAt: number;
  depths?: CampaignPointDepth[];
}

export interface CampaignUserPointsResponse {
  campaignId: string;
  userAddress: string;
  rank: number;
  totalParticipants: number;
  totalPoints: string;
  epochs: CampaignPoint[];
}

function normalizePartnerId(partnerId: string) {
  return partnerId.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCampaignUserPointsNotFoundError(error: unknown) {
  const response = isRecord(error) && isRecord(error.response)
    ? error.response
    : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const responseCode = data?.code;
  const responseMessage = data?.error;
  const errorMessage = error instanceof Error ? error.message : undefined;

  return (
    responseCode === "CAMPAIGN_USER_NOT_FOUND" ||
    [errorMessage, responseMessage].some(
      (message) =>
        typeof message === "string" &&
        message.toLowerCase().includes("campaign user points not found"),
    )
  );
}

export function emptyCampaignUserPoints(
  campaignId: string,
  address: string,
): CampaignUserPointsResponse {
  return {
    campaignId,
    userAddress: address,
    rank: 0,
    totalParticipants: 0,
    totalPoints: "0",
    epochs: [],
  };
}

export async function listCampaigns(
  partnerId?: string,
  signal?: AbortSignal,
): Promise<ListCampaignsResponse> {
  const response = await apiClient.get<ListCampaignsResponse>(
    "/api/v1/campaigns",
    {
      params: partnerId ? { partnerId: normalizePartnerId(partnerId) } : undefined,
      signal,
    },
  );
  return response.data;
}

export async function getCampaignUserPoints(
  campaignId: string,
  address: string,
  signal?: AbortSignal,
): Promise<CampaignUserPointsResponse> {
  const response = await apiClient.get<CampaignUserPointsResponse>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/user/${address}`,
    { signal },
  );
  return response.data;
}

export async function getCampaignUserPointsOrZero(
  campaignId: string,
  address: string,
  signal?: AbortSignal,
): Promise<CampaignUserPointsResponse> {
  try {
    return await getCampaignUserPoints(campaignId, address, signal);
  } catch (error) {
    if (isCampaignUserPointsNotFoundError(error)) {
      return emptyCampaignUserPoints(campaignId, address);
    }
    throw error;
  }
}

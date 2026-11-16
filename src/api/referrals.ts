import apiClient from "./client";
import { safeUpperCase } from "@/lib/string";

export interface CreateReferralCodeRequest {
  partnerId: string;
  user: string;
  code: string;
  timestamp: number;
  signature: string;
}

export interface LinkReferralCodeRequest {
  partnerId: string;
  user: string;
  code: string;
  timestamp: number;
  signature: string;
}

export interface ReferralCodeResponse {
  code: string;
  partnerId: string;
  creatorAddress: string;
  createdAt: number;
}

export interface ReferralLinkResponse {
  partnerId: string;
  userAddress: string;
  code: string;
  referrerAddress: string;
  linkedAt: number;
}

export interface ReferralCheckResponse {
  valid: boolean;
  code?: string;
  partnerId?: string;
  creatorAddress?: string;
}

export interface CreatedReferralCodeSummary {
  code: string;
  createdAt: number;
}

export interface LinkedReferralCodeSummary {
  code: string;
  referrerAddress: string;
  linkedAt: number;
}

export interface ReferredUserSummary {
  userAddress: string;
  linkedAt: number;
}

export interface UserReferralSummaryResponse {
  createdCode?: CreatedReferralCodeSummary;
  linkedCode?: LinkedReferralCodeSummary;
  referredUsers: ReferredUserSummary[];
}

export function normalizeReferralCode(code: string | null | undefined) {
  return safeUpperCase(code).trim();
}

export function normalizePartnerId(partnerId: string) {
  return partnerId.trim();
}

export async function createReferralCode(
  request: CreateReferralCodeRequest,
  signal?: AbortSignal,
): Promise<ReferralCodeResponse> {
  const response = await apiClient.post<ReferralCodeResponse>(
    "/api/v1/referrals/code",
    request,
    { signal },
  );
  return response.data;
}

export async function linkReferralCode(
  request: LinkReferralCodeRequest,
  signal?: AbortSignal,
): Promise<ReferralLinkResponse> {
  const response = await apiClient.post<ReferralLinkResponse>(
    "/api/v1/referrals/link",
    request,
    { signal },
  );
  return response.data;
}

export async function checkReferralCode(
  partnerId: string,
  code: string,
  signal?: AbortSignal,
): Promise<ReferralCheckResponse> {
  const response = await apiClient.get<ReferralCheckResponse>(
    `/api/v1/referrals/check/${encodeURIComponent(normalizeReferralCode(code))}`,
    {
      params: { partnerId: normalizePartnerId(partnerId) },
      signal,
    },
  );
  return response.data;
}

export async function getUserReferralSummary(
  partnerId: string,
  address: string,
  signal?: AbortSignal,
): Promise<UserReferralSummaryResponse> {
  const response = await apiClient.get<UserReferralSummaryResponse>(
    `/api/v1/referrals/user/${address}`,
    {
      params: { partnerId: normalizePartnerId(partnerId) },
      signal,
    },
  );
  return response.data;
}

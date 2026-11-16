import axios from 'axios';
import apiClient from './client';
import type { GetUserResponse, PositionResponse, RiskPreviewResponse, UserPortfolioResponse, WithdrawRequest, WithdrawResponse } from '../types';
import { fetchAdminConfig } from './tee';
import { resolveFeeRateBps } from '../lib/margin';

export async function getUser(address: string, signal?: AbortSignal): Promise<GetUserResponse> {
  const response = await apiClient.get<GetUserResponse>(`/api/v1/user/${address}`, { signal });
  return response.data;
}

export async function getLegacyHedgerUser(address: string, signal?: AbortSignal): Promise<GetUserResponse> {
  const response = await apiClient.get<GetUserResponse>(`/api/v1/user/${address}`, {
    params: { accountScope: "legacy-user" }, signal,
  });
  return response.data;
}

export async function getUserPortfolio(address: string, signal?: AbortSignal): Promise<UserPortfolioResponse> {
  try {
    const response = await apiClient.get<UserPortfolioResponse>(`/api/v1/user/${address}/portfolio`, { signal });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const [user, adminConfig] = await Promise.all([
        getUser(address, signal),
        fetchAdminConfig(signal),
      ]);
      return buildPortfolioFallback(user, adminConfig.config);
    }
    throw error;
  }
}

type PortfolioFeeConfig = {
  feeTiers?: Array<{ tierLevel: number; totalFeeRateBps?: number }>;
};

function parseRawAmount(value?: string | null) {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function positionUsdValue(position: PositionResponse) {
  const quantity = parseRawAmount(position.quantity);
  const markPrice = parseRawAmount(position.markPrice);
  if (quantity === 0n || markPrice === 0n) return 0n;
  const absQuantity = quantity < 0n ? -quantity : quantity;
  return (absQuantity * markPrice) / 100_000_000_000_000_000_000n;
}

export function buildPortfolioFallback(user: GetUserResponse, feeConfig: PortfolioFeeConfig): UserPortfolioResponse {
  const walletBalance = parseRawAmount(user.user.balance);
  const unrealizedPnl = parseRawAmount(user.unrealizedPnl);
  const totalPositionUsdValue = user.positions.reduce(
    (sum, position) => sum + positionUsdValue(position),
    0n,
  );
  const marginBalance =
    parseRawAmount(user.marginBalance) || walletBalance + unrealizedPnl;
  const totalValue = walletBalance + totalPositionUsdValue + unrealizedPnl;
  const feeTier = user.user.feeTier ?? 0;
  const totalFeeRateBps = resolveFeeRateBps(feeConfig, feeTier);
  if (totalFeeRateBps === undefined) {
    throw new Error(`Fee tier ${feeTier} is not configured`);
  }

  return {
    userAddress: user.user.address,
    totalValue: totalValue.toString(),
    totalEquity: marginBalance.toString(),
    perpsEquity: marginBalance.toString(),
    walletBalance: walletBalance.toString(),
    availableBalance: parseRawAmount(user.availableBalance).toString(),
    marginUsed: parseRawAmount(user.marginUsed).toString(),
    maintenanceMargin: parseRawAmount(user.maintenanceMargin).toString(),
    unrealizedPnl: unrealizedPnl.toString(),
    realizedPnl: "0",
    totalPnl: unrealizedPnl.toString(),
    totalDeposits: "0",
    totalWithdrawals: "0",
    totalPositionUsdValue: totalPositionUsdValue.toString(),
    volume24h: "0",
    volume14d: "0",
    volume30d: "0",
    volumeAllTime: "0",
    feeTier,
    totalFeeRateBps,
    timestamp: Date.now(),
    source: "sql_current",
  };
}

export async function getRiskPreview(address: string, symbol: string, signal?: AbortSignal): Promise<RiskPreviewResponse> {
  const response = await apiClient.get<RiskPreviewResponse>(
    `/api/v1/user/${address}/risk-preview`,
    { params: { symbol }, signal },
  );
  return response.data;
}

export interface WithdrawParams {
  requestId: string;
  user: string;
  amount: string;
  isMax: boolean;
  isLegacyUser?: boolean;
  timestamp: number;
  signature: string;
}

export async function requestWithdrawal(
  params: WithdrawParams,
  signal?: AbortSignal,
): Promise<WithdrawResponse> {
  const request: WithdrawRequest = {
    requestId: params.requestId,
    user: params.user,
    amount: params.amount,
    isMax: params.isMax,
    ...(params.isLegacyUser ? { isLegacyUser: true } : {}),
    timestamp: params.timestamp,
    signature: params.signature,
  };

  const response = await apiClient.post<WithdrawResponse>('/api/v1/withdraw', request, { signal });
  return response.data;
}

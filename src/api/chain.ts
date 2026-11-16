import apiClient from './client';

export interface RollupStatus {
  lastSubmitTime: number;
  lastOnChainRoot: string;
  lastOnChainSeq: number;
  teeRoot: string;
  teeSeq: number;
  pendingOps: number;
  nextRollupIn: number;
  lastError?: string;
}

export interface ChainState {
  merkleRoot: string;
  sequenceNumber: number;
  totalDeposits: string;
  contractUsdcBalance: string;
  teeAddress: string;
}

export async function getRollupStatus(signal?: AbortSignal): Promise<RollupStatus> {
  const response = await apiClient.get<RollupStatus>('/api/v1/rollup/status', { signal });
  return response.data;
}

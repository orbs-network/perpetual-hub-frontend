import apiClient from './client';
import type { RollupItem, OperationItem } from '../types';

export interface RollupListResponse {
  rollups: RollupItem[];
  total: number;
  limit: number;
  offset: number;
  stats: {
    totalRollups: number;
    totalOps: number;
    latestSequence: number;
    avgOpsPerRollup: number;
  };
}

export interface RollupDetailResponse {
  rollup: RollupItem;
  operations: OperationItem[];
}

export async function getRollups(
  limit = 20,
  offset = 0,
  signal?: AbortSignal,
): Promise<RollupListResponse> {
  const response = await apiClient.get<RollupListResponse>('/api/v1/rollups', {
    params: { limit, offset },
    signal,
  });
  return response.data;
}

export async function getRollupDetail(id: number, signal?: AbortSignal): Promise<RollupDetailResponse> {
  const response = await apiClient.get<RollupDetailResponse>(`/api/v1/rollups/${id}`, { signal });
  return response.data;
}

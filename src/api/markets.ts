import apiClient from './client';

export interface MarketInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  pricePrecision: number;
  quantityPrecision: number;
}

export async function fetchMarkets(signal?: AbortSignal): Promise<MarketInfo[]> {
  const response = await apiClient.get<MarketInfo[]>('/api/v1/markets', { signal });
  return response.data;
}

export interface AllowedLeverageInfo {
  aggregateNotional: string;
  allowedLeverage: number;
  symbol: string;
  symbolMaxLeverage: number;
  tierIndex: number;
  tierMaxLeverage: number;
  tierMaxNotional: string;
}

export async function fetchAllowedLeverageInfo(
  symbol: string,
  signal?: AbortSignal,
): Promise<AllowedLeverageInfo> {
  const response = await apiClient.get<AllowedLeverageInfo>('/api/v1/leverage/allowed', {
    params: { symbol },
    signal,
  });
  return response.data;
}

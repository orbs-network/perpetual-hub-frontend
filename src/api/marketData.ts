import apiClient from "./client";

export interface HedgerMarketDataEntry {
  symbol: string;
  price?: string;
  markPrice?: string;
  priceChangePercent?: string;
  high24h?: string;
  low24h?: string;
  volume24h?: string;
  fundingRate?: string;
  nextFundingTime?: number;
  updatedAt: number;
}

interface HedgerMarketDataResponse {
  markets: HedgerMarketDataEntry[];
}

export interface HedgerKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

interface HedgerKlinesResponse {
  symbol: string;
  interval: string;
  klines: HedgerKline[];
}

export interface HedgerKlinesParams {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export async function fetchHedgerMarketData(
  signal?: AbortSignal,
): Promise<HedgerMarketDataEntry[]> {
  const response = await apiClient.get<HedgerMarketDataResponse>(
    "/api/v1/market-data",
    { signal },
  );
  return response.data.markets;
}

export async function fetchHedgerKlines(
  params: HedgerKlinesParams,
  signal?: AbortSignal,
): Promise<HedgerKline[]> {
  const response = await apiClient.get<HedgerKlinesResponse>(
    "/api/v1/market-data/klines",
    { params, signal },
  );
  return response.data.klines;
}

import apiClient from "./client";

export interface FeeTierConfig {
  tierLevel: number;
  totalFeeRateBps: number;
  hedgerShareBps: number;
  fundingSpreadBps: number;
}

export interface MMBracket {
  maxNotional: string;
  mmrBps: number;
  cum: string;
  maxLeverage: number;
}

export interface SymbolConfig {
  symbol: string;
  maxLeverage: number;
  defaultLeverage: number;
  oracleFillToleranceBps: number;
  enabled: boolean;
  tickSize: string;
  stepSize: string;
  minQty?: string;
  minNotional?: string;
  mmBrackets: MMBracket[];
}

export interface SystemConfig {
  adminAddress: string;
  hedgerAddress: string;
  priceOracleAddress: string;
  fundingOracleAddress: string;
  feeTiers: FeeTierConfig[];
  symbolConfigs: Record<string, SymbolConfig>;
  lastUpdate?: number;
  riskCaps?: {
    maxTotalOpenNotional: string;
    defaultSymbolCaps: {
      maxOpenNotional: string;
      maxOrderNotional: string;
    };
    symbols: Record<
      string,
      {
        maxOpenNotional: string;
        maxOrderNotional: string;
      }
    >;
  };
}

export interface AdminConfigResponse {
  config: SystemConfig;
  currentStateRoot: string;
  sequence: number;
  configHashToSign: string;
  digestToSign: string;
}

export async function fetchAdminConfig(
  signal?: AbortSignal,
): Promise<AdminConfigResponse> {
  const response = await apiClient.get<AdminConfigResponse>(
    "/api/v1/admin/config",
    { signal },
  );
  return response.data;
}

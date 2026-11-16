import apiClient from './client';

export interface HedgerAccounting {
  hedgerAddress: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalFeesCollected: string;
  totalFunding: string;
  realizedPnl: string;
  balance: string;
  balanceRaw: string;
  updatedAt?: number;
}

export async function getHedgerAccounting(
  signal?: AbortSignal,
): Promise<HedgerAccounting> {
  const response = await apiClient.get<HedgerAccounting>(
    '/api/v1/hedger/accounting',
    { signal },
  );
  return response.data;
}

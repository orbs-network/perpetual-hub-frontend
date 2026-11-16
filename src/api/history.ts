import apiClient from './client';
import { HISTORY_ROW_LIMIT } from '@/lib/historyPagination';
import type { TradeItem, OrderHistoryItem, TransactionItem } from '../types';
import axios from 'axios';
import { safeUpperCase } from '@/lib/utils';

export interface TradeListResponse {
  trades: TradeItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderHistoryListResponse {
  orders: OrderHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionListResponse {
  transactions: TransactionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FundingListResponse {
  funding: OrderHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  sourceOldestTimestamp?: number | null;
}

export interface PortfolioLedgerHistoryResponse {
  transactions: TransactionItem[];
  orders: OrderHistoryItem[];
  funding: OrderHistoryItem[];
}

export interface PortfolioLedgerHistoryCursor {
  transactions: number | null;
  orders: number | null;
  funding: number | null;
}

export interface PortfolioLedgerHistoryPage
  extends PortfolioLedgerHistoryResponse {
  oldestTimestamps: PortfolioLedgerHistoryOldestTimestamps;
  nextCursor: PortfolioLedgerHistoryCursor | null;
  limitedStreams?: Array<keyof PortfolioLedgerHistoryCursor>;
}

export interface PortfolioLedgerHistoryOldestTimestamps {
  transactions: number | null;
  orders: number | null;
  funding: number | null;
}

export const PORTFOLIO_HISTORY_PAGE_LIMIT = 100;
export const INITIAL_PORTFOLIO_HISTORY_CURSOR: PortfolioLedgerHistoryCursor = {
  transactions: 0,
  orders: 0,
  funding: 0,
};

export const HISTORY_EXPORT_PAGE_LIMIT = 100;

export async function getUserTrades(
  address: string,
  limit = 200,
  offset = 0,
  signal?: AbortSignal,
): Promise<TradeListResponse> {
  const response = await apiClient.get<TradeListResponse>(
    `/api/v1/user/${address}/trades`,
    { params: { limit, offset }, signal },
  );
  return response.data;
}

export async function getUserOrderHistory(
  address: string,
  limit = 20,
  offset = 0,
  signal?: AbortSignal,
): Promise<OrderHistoryListResponse> {
  const response = await apiClient.get<OrderHistoryListResponse>(
    `/api/v1/user/${address}/orders/history`,
    { params: { limit, offset }, signal },
  );
  return response.data;
}

export async function getUserTransactions(
  address: string,
  limit = 20,
  offset = 0,
  signal?: AbortSignal,
): Promise<TransactionListResponse> {
  const response = await apiClient.get<TransactionListResponse>(
    `/api/v1/user/${address}/transactions`,
    { params: { limit, offset }, signal },
  );
  return response.data;
}

async function getUserFundingHistoryFromEndpoint(
  address: string,
  limit: number,
  offset: number,
  signal?: AbortSignal,
): Promise<FundingListResponse> {
  const response = await apiClient.get<FundingListResponse>(
    `/api/v1/user/${address}/funding`,
    { params: { limit, offset }, signal },
  );
  return response.data;
}

export async function getUserFundingHistory(
  address: string,
  limit = 20,
  offset = 0,
  signal?: AbortSignal,
): Promise<FundingListResponse> {
  try {
    return await getUserFundingHistoryFromEndpoint(address, limit, offset, signal);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const history = await getUserOrderHistory(address, limit, offset, signal);
      const funding = history.orders.filter((item) =>
        safeUpperCase(item.operationType).includes("FUNDING"),
      );
      return {
        funding,
        total: history.total,
        limit,
        offset,
        sourceOldestTimestamp: oldestHistoryTimestamp(history.orders),
      };
    }
    throw error;
  }
}

function oldestHistoryTimestamp(rows: Array<{ timestamp?: number }>) {
  let oldest: number | null = null;
  for (const row of rows) {
    if (typeof row.timestamp !== "number" || !Number.isFinite(row.timestamp)) {
      continue;
    }
    oldest = oldest === null ? row.timestamp : Math.min(oldest, row.timestamp);
  }
  return oldest;
}

async function fetchRecentPages<TPage extends { total: number }, TItem>(
  fetchPage: (
    limit: number,
    offset: number,
    signal?: AbortSignal,
  ) => Promise<TPage>,
  getItems: (page: TPage) => TItem[] | null | undefined,
  options: {
    pageSize?: number;
    signal?: AbortSignal;
  } = {},
) {
  const pageSize = options.pageSize ?? HISTORY_EXPORT_PAGE_LIMIT;
  const items: TItem[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < Math.min(total, HISTORY_ROW_LIMIT)) {
    const page = await fetchPage(pageSize, offset, options.signal);
    const pageItems = getItems(page) ?? [];
    total = page.total;

    items.push(...pageItems);
    if (items.length >= HISTORY_ROW_LIMIT) return items.slice(0, HISTORY_ROW_LIMIT);
    if (total <= 0) break;

    offset += pageSize;
  }

  return items;
}

export function getRecentUserTrades(address: string, signal?: AbortSignal) {
  return fetchRecentPages(
    (limit, offset, pageSignal) =>
      getUserTrades(address, limit, offset, pageSignal),
    (page) => page.trades,
    { signal },
  );
}

export function getRecentUserOrderHistory(address: string, signal?: AbortSignal) {
  return fetchRecentPages(
    (limit, offset, pageSignal) =>
      getUserOrderHistory(address, limit, offset, pageSignal),
    (page) => page.orders,
    { signal },
  );
}

export async function getRecentUserFundingHistory(
  address: string,
  signal?: AbortSignal,
) {
  try {
    return await fetchRecentPages(
      (limit, offset, pageSignal) =>
        getUserFundingHistoryFromEndpoint(address, limit, offset, pageSignal),
      (page) => page.funding,
      { signal },
    );
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }

    return fetchRecentPages(
      (limit, offset, pageSignal) =>
        getUserOrderHistory(address, limit, offset, pageSignal),
      (page) =>
        page.orders.filter((item) =>
          safeUpperCase(item.operationType).includes("FUNDING"),
        ),
      { signal },
    );
  }
}

export function getRecentUserTransactions(address: string, signal?: AbortSignal) {
  return fetchRecentPages(
    (limit, offset, pageSignal) =>
      getUserTransactions(address, limit, offset, pageSignal),
    (page) => page.transactions,
    { signal },
  );
}

function nextHistoryOffset(
  offset: number | null,
  total: number,
) {
  if (offset === null || offset + PORTFOLIO_HISTORY_PAGE_LIMIT >= Math.min(total, HISTORY_ROW_LIMIT)) {
    return null;
  }
  return offset + PORTFOLIO_HISTORY_PAGE_LIMIT;
}

function hasNextHistoryCursor(cursor: PortfolioLedgerHistoryCursor) {
  return Object.values(cursor).some((offset) => offset !== null);
}

export async function getUserPortfolioLedgerHistoryPage(
  address: string,
  cursor: PortfolioLedgerHistoryCursor = INITIAL_PORTFOLIO_HISTORY_CURSOR,
  signal?: AbortSignal,
): Promise<PortfolioLedgerHistoryPage> {
  const [transactionsPage, ordersPage, fundingPage] = await Promise.all([
    cursor.transactions === null
      ? null
      : getUserTransactions(
          address,
          PORTFOLIO_HISTORY_PAGE_LIMIT,
          cursor.transactions,
          signal,
        ),
    cursor.orders === null
      ? null
      : getUserOrderHistory(
          address,
          PORTFOLIO_HISTORY_PAGE_LIMIT,
          cursor.orders,
          signal,
        ),
    cursor.funding === null
      ? null
      : getUserFundingHistory(
          address,
          PORTFOLIO_HISTORY_PAGE_LIMIT,
          cursor.funding,
          signal,
        ),
  ]);
  const orderRows = ordersPage?.orders ?? [];
  const orders = orderRows.filter((item) =>
    ["OPEN_POSITION", "CLOSE_POSITION", "FILL_ORDER", "LIQUIDATION"].includes(
      safeUpperCase(item.operationType),
    ),
  );
  const nextCursor: PortfolioLedgerHistoryCursor = {
    transactions: transactionsPage
      ? nextHistoryOffset(cursor.transactions, transactionsPage.total)
      : null,
    orders: ordersPage
      ? nextHistoryOffset(cursor.orders, ordersPage.total)
      : null,
    funding: fundingPage
      ? nextHistoryOffset(cursor.funding, fundingPage.total)
      : null,
  };

  return {
    limitedStreams: (['transactions', 'orders', 'funding'] as const).filter((stream) => {
      const page = { transactions: transactionsPage, orders: ordersPage, funding: fundingPage }[stream];
      return page !== null && cursor[stream] !== null &&
        cursor[stream]! + PORTFOLIO_HISTORY_PAGE_LIMIT >= HISTORY_ROW_LIMIT && page.total > HISTORY_ROW_LIMIT;
    }),
    transactions: transactionsPage?.transactions ?? [],
    orders,
    funding: fundingPage?.funding ?? [],
    oldestTimestamps: {
      transactions: oldestHistoryTimestamp(
        transactionsPage?.transactions ?? [],
      ),
      orders: oldestHistoryTimestamp(orderRows),
      funding:
        fundingPage?.sourceOldestTimestamp ??
        oldestHistoryTimestamp(fundingPage?.funding ?? []),
    },
    nextCursor: hasNextHistoryCursor(nextCursor) ? nextCursor : null,
  };
}

import {
  buildOrderBookData,
  extractDepthLevels,
  parseLevels,
} from "@/utils/book";
import type { BinanceDepthMessage, OrderBookData } from "@/types";
import { ORDER_BOOK_REST_DEPTH_LIMIT } from "@/config/constants";
import apiClient from "./client";

function parseOrderBookSnapshot(msg: BinanceDepthMessage): OrderBookData {
  const { rawBids, rawAsks } = extractDepthLevels(msg);
  return buildOrderBookData(
    parseLevels(rawBids, "bid"),
    parseLevels(rawAsks, "ask"),
  );
}

export async function fetchHedgerOrderBookSnapshot(
  symbol: string,
  signal?: AbortSignal,
): Promise<OrderBookData> {
  const response = await apiClient.get<BinanceDepthMessage>(
    "/api/v1/market-data/depth",
    {
      params: { symbol, limit: ORDER_BOOK_REST_DEPTH_LIMIT },
      signal,
    },
  );
  return parseOrderBookSnapshot(response.data);
}

export async function fetchOrderBookSnapshot(
  restUrl: string,
  symbol: string,
  signal?: AbortSignal,
): Promise<OrderBookData> {
  try {
    const res = await fetch(
      `${restUrl}/fapi/v1/depth?symbol=${symbol}&limit=${ORDER_BOOK_REST_DEPTH_LIMIT}`,
      {
        signal,
      },
    );
    if (!res.ok) throw new Error(`Binance depth REST ${res.status}`);
    const msg: BinanceDepthMessage = await res.json();
    return parseOrderBookSnapshot(msg);
  } catch (error) {
    if (signal?.aborted) throw error;
    return fetchHedgerOrderBookSnapshot(symbol, signal);
  }
}

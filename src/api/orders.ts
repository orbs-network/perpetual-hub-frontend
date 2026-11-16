import apiClient from './client';
import type { OrderRequest, OrderResponse, CancelOrderRequest, OrderReplacementRequest, OrderType, TimeInForce } from '../types';

export interface CreateOrderParams {
  requestId: string;
  user: string;
  symbol: string;
  orderType: string;
  side: string;
  quantity: string;
  price?: string;
  stopPrice?: string;
  priceDecimal?: string;
  stopPriceDecimal?: string;
  reduceOnly: boolean;
  closePosition: boolean;
  timeInForce: string;
  timestamp: number;
  signature: string;
  skipRiskEngine?: boolean;
  bracket?: BracketOrderParams;
  replacement?: OrderReplacementRequest;
}

export interface BracketOrderLegParams {
  orderType: OrderType;
  stopPrice?: string;
  price?: string;
  stopPriceDecimal?: string;
  priceDecimal?: string;
  timeInForce?: TimeInForce;
}

export interface BracketOrderParams {
  takeProfit?: BracketOrderLegParams;
  stopLoss?: BracketOrderLegParams;
  bracketSignature: string;
}

export async function createOrder(
  params: CreateOrderParams,
  signal?: AbortSignal,
): Promise<OrderResponse> {
  const request: OrderRequest = {
    requestId: params.requestId,
    order: {
      user: params.user,
      symbol: params.symbol,
      orderType: params.orderType as OrderRequest['order']['orderType'],
      side: params.side as OrderRequest['order']['side'],
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      priceDecimal: params.priceDecimal,
      stopPriceDecimal: params.stopPriceDecimal,
      reduceOnly: params.reduceOnly,
      closePosition: params.closePosition,
      timeInForce: params.timeInForce as OrderRequest['order']['timeInForce'],
      timestamp: params.timestamp,
      signature: params.signature,
      skipRiskEngine: params.skipRiskEngine,
      bracket: params.bracket,
      replacement: params.replacement,
    },
  };

  const response = await apiClient.post<OrderResponse>('/api/v1/order', request, { signal });
  return response.data;
}

export interface ChangeLeverageParams {
  user: string;
  symbol: string;
  leverage: number;
  timestamp: number;
  signature: string;
}

export interface ChangeLeverageResponse {
  symbol: string;
  leverage: number;
  stateRoot?: string;
  sequenceNumber?: number;
}

export async function changeLeverage(
  params: ChangeLeverageParams,
  signal?: AbortSignal,
): Promise<ChangeLeverageResponse> {
  const response = await apiClient.post<ChangeLeverageResponse>('/api/v1/leverage', params, { signal });
  return response.data;
}

export interface CancelOrderParams {
  requestId: string;
  orderId: string;
  timestamp: number;
  signature: string;
}

export async function cancelOrder(
  params: CancelOrderParams,
  signal?: AbortSignal,
): Promise<OrderResponse> {
  const request: CancelOrderRequest = {
    requestId: params.requestId,
    timestamp: params.timestamp,
    signature: params.signature,
  };

  const response = await apiClient.delete<OrderResponse>(`/api/v1/order/${params.orderId}`, {
    data: request,
    signal,
  });
  return response.data;
}

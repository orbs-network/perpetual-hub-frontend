// API Request/Response Types

import type { Symbol } from "@/config/constants";

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number;
}

export type RawDepthLevel = [string, string];

export type BinanceDepthMessage = {
  bids?: RawDepthLevel[];
  asks?: RawDepthLevel[];
  b?: RawDepthLevel[];
  a?: RawDepthLevel[];
};

export interface LoginRequest {
  address: string;
  partnerId: string;
  chainId: string;
  partnerChainKey: string;
  sessionPublicKey: string;
  sessionExpiresAt: number;
  timestamp: number;
  signature: string;
}

export interface LoginResponse {
  success: boolean;
  sessionExpiresAt: number;
  stateRoot?: string;
  sequenceNumber?: number;
}

export interface OrderRequest {
  requestId: string;
  order: {
    user: string;
    symbol: string;
    orderType: OrderType;
    side: OrderSide;
    quantity: string;
    // Legacy 1e6 integer prices. Sent only when the exact 1e18 price is
    // representable at 1e6; "0" means no price.
    price?: string;
    stopPrice?: string;
    // Exact decimal prices ("0.0000095"), sent for every positive price.
    priceDecimal?: string;
    stopPriceDecimal?: string;
    reduceOnly: boolean;
    closePosition: boolean;
    timeInForce: TimeInForce;
    timestamp: number;
    signature?: string;
    skipRiskEngine?: boolean;
    bracket?: BracketOrderRequest;
    replacement?: OrderReplacementRequest;
  };
}

export interface OrderReplacementRequest {
  orderId: string;
  timestamp: number;
  signature: string;
}

export interface BracketOrderLegRequest {
  orderType: OrderType;
  // Legacy 1e6 integers, only when representable; the decimal fields always
  // carry the exact prices.
  stopPrice?: string;
  price?: string;
  stopPriceDecimal?: string;
  priceDecimal?: string;
  timeInForce?: TimeInForce;
}

export interface BracketOrderRequest {
  takeProfit?: BracketOrderLegRequest;
  stopLoss?: BracketOrderLegRequest;
  bracketSignature: string;
}

export type OrderExecutionStatus =
  | "EXECUTING"
  | "ATTEMPT_FAILED"
  | "OUTCOME_UNKNOWN"
  | "NO_MORE_ATTEMPTS"
  | "NO_FILL_RETRY_PENDING"
  | "NO_FILL_ATTEMPTS_EXHAUSTED";

export interface OrderResponse {
  orderId: string;
  user: string;
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: string;
  price: string;
  stopPrice: string;
  priceDecimal?: string;
  stopPriceDecimal?: string;
  reduceOnly: boolean;
  closePosition: boolean;
  timeInForce: TimeInForce;
  timestamp: number;
  status: OrderStatus;
  executionStatus?: OrderExecutionStatus;
  stateRoot?: string;
  sequenceNumber?: number;
  teeSignature?: string;
  entryPrice?: string;
  fee?: string;
  parentOrderId?: string;
  bracketGroupId?: string;
  attachedRole?: string;
}

export interface PositionResponse {
  symbol: string;
  quantity: string;
  entryPrice: string;
  entryPriceDecimal?: string;
  markPrice?: string;
  markPriceDecimal?: string;
  liquidationPrice?: string;
  liquidationPriceDecimal?: string;
  maintenanceMargin?: string;
  initialMargin?: string;
  lockedMMR?: number;
  accumulatedFunding: string;
  openTimestamp: number;
  allocatedMargin?: string;
  leverage?: number;
}

export interface UserResponse {
  address: string;
  balance: string;
  nonce: number;
  feeTier?: number;
}

export interface PendingWithdrawalResponse {
  withdrawalId: string;
  recipient: string;
  amount: string;
  requestedAt: number;
  availableAt: number;
}

export interface GetUserResponse {
  user: UserResponse;
  positions: PositionResponse[];
  pendingOrders: OrderResponse[];
  pendingWithdrawals: PendingWithdrawalResponse[];
  availableBalance: string;
  marginUsed: string;
  maintenanceMargin?: string;
  marginBalance?: string;
  unrealizedPnl: string;
  leveragePreferences?: Record<string, number>;
}

export interface UserPortfolioResponse {
  userAddress: string;
  totalValue: string;
  totalEquity: string;
  perpsEquity: string;
  walletBalance: string;
  availableBalance: string;
  marginUsed: string;
  maintenanceMargin: string;
  unrealizedPnl: string;
  realizedPnl: string;
  totalPnl: string;
  totalDeposits?: string;
  totalWithdrawals?: string;
  totalPositionUsdValue: string;
  volume24h: string;
  volume14d: string;
  volume30d: string;
  volumeAllTime: string;
  feeTier: number;
  totalFeeRateBps: number;
  timestamp: number;
  source: "sql_current" | "hedger_accounting";
}

export interface RiskMMBracket {
  maxNotional?: string;
  mmrBps: number;
  cum?: string;
  maxLeverage?: number;
}

export interface RiskSymbolConfig {
  defaultLeverage: number;
  maxLeverage?: number;
  mmBrackets: RiskMMBracket[];
}

export interface RiskConfigResponse {
  symbols: Record<string, RiskSymbolConfig>;
  feeTiers?: RiskFeeTier[];
}

export interface RiskFeeTier {
  tierLevel: number;
  totalFeeRateBps: number;
}

export interface RiskPreviewMMBracket {
  maxNotional: string;
  mmrBps: number;
  cum: string;
  maxLeverage?: number;
}

export interface RiskPreviewPosition {
  quantity: string;
  entryPrice: string;
  lockedMMR: number;
}

export interface RiskPreviewResponse {
  user: string;
  symbol: string;
  walletBalance: string;
  upnlOthers: string;
  maintenanceMarginOthers: string;
  feeTier: number;
  feeRateBps: number;
  aggregateNotional: string;
  mmBrackets?: RiskPreviewMMBracket[];
  existingPosition?: RiskPreviewPosition;
  timestamp: number;
}

export interface WithdrawRequest {
  requestId: string;
  user: string;
  amount: string;
  isMax: boolean;
  isLegacyUser?: boolean;
  timestamp: number;
  signature: string;
}

export interface WithdrawResponse {
  withdrawalId: string;
  user: string;
  amount: string;
  timestamp: number;
  status: string;
  stateRoot?: string;
  sequenceNumber?: number;
  teeSignature?: string;
}

export interface CancelOrderRequest {
  requestId: string;
  orderId?: string;
  timestamp: number;
  signature: string;
}

// Enums
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_MARKET' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET' | 'TAKE_PROFIT_LIMIT';
export type OrderSide = 'BUY' | 'SELL';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type OrderStatus = 'NEW' | 'PENDING_ACTIVATION' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'EXPIRED' | 'REJECTED';

// Rollup Explorer types
export interface TradeItem {
  id: number;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  fee: string;
  realizedPnl: string;
  isClose: boolean;
  timestamp: number;
}

export interface OrderHistoryItem {
  id: number;
  operationType: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  amount: string;
  fee: string;
  realizedPnl: string;
  status: string;
  rejectReason: string;
  timestamp: number;
  extraData?: string;
}

export interface WithdrawalPayout {
  status: "UNAVAILABLE" | "COOLDOWN" | "CLAIMABLE" | "PAUSED" | "PAID";
  chainId?: number;
  contractAddress?: string;
  sequence?: string;
  recipient?: string;
  /** Collateral token-native units, not protocol accounting units. */
  amount?: string;
  /** Chain timestamp, in seconds. */
  unlockAt?: number;
}

export interface WithdrawalLifecycle {
  payout?: WithdrawalPayout;
  withdrawalId?: string;
  eventWithdrawalId?: string;
  status: "REQUEST_REJECTED" | "REQUEST_ACCEPTED" | "RELEASE_ACCEPTED" | "ROLLUP_CONFIRMED" | "RELEASE_FAILED" | "LINK_UNAVAILABLE" | "FEE_ONLY";
  availableAt?: number;
  release?: {
    operationId?: number;
    requestId?: string;
    status: string;
    timestamp?: number;
    teeSequence: number;
    rollupId?: number;
    rollupStatus?: string;
    txHash?: string;
    confirmedAt?: number;
  };
}

export interface TransactionItem {
  accountingStatus?: "UNAVAILABLE";
  id: number;
  operationType: string;
  amount: string;
  fee?: string;
  extraData?: string;
  symbol: string;
  status: string;
  timestamp: number;
  withdrawal?: WithdrawalLifecycle;
}

export interface RollupItem {
  id: number;
  oldStateRoot: string;
  newStateRoot: string;
  oldSequence: number;
  newSequence: number;
  txHash: string;
  blockNumber: number;
  operationsCount: number;
  status: string;
  submittedAt: number;
}

export interface OperationItem {
  id: number;
  operationType: string;
  userAddress: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  amount: string;
  fee: string;
  realizedPnl: string;
  status: string;
  rejectReason: string;
  timestamp: number;
  teeSequence?: number;
  stateRoot?: string;
}

export interface WSFillEvent {
  type: 'FILL';
  channel: string;
  data: {
    fillId: string;
    orderId: string;
    user: string;
    symbol: string;
    side: OrderSide;
    quantity: string;
    price: string;
    fee: string;
    timestamp: number;
  };
}

// Domain types for UI
export interface Position {
  symbol: string;
  quantity: bigint;
  entryPrice: bigint;
  liquidationPrice?: bigint;
  maintenanceMargin?: bigint;
  initialMargin?: bigint;
  lockedMMR?: number;
  accumulatedFunding: bigint;
  openTimestamp: number;
  allocatedMargin?: bigint;
  leverage?: number;
  // Computed
  unrealizedPnL?: bigint;
  currentPrice?: bigint;
}

export interface Order {
  orderId: string;
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: bigint;
  price: bigint;
  stopPrice: bigint;
  reduceOnly: boolean;
  closePosition: boolean;
  timeInForce: TimeInForce;
  timestamp: number;
  status: OrderStatus;
  executionStatus?: OrderExecutionStatus;
  parentOrderId?: string;
  bracketGroupId?: string;
  attachedRole?: string;
}

export interface AccountSummary {
  balance: bigint;
  availableBalance: bigint;
  marginUsed: bigint;
  maintenanceMargin?: bigint;
  marginBalance?: bigint;
  unrealizedPnL: bigint;
  pendingWithdrawals: PendingWithdrawal[];
}

export interface PendingWithdrawal {
  withdrawalId: string;
  recipient: string;
  amount: bigint;
  requestedAt: number;
  availableAt: number;
}

export interface PriceData {
  symbol: Symbol;
  price: number;
  markPrice?: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  fundingRate?: number;
  lastUpdated: number;
  nextFundingTime?: number;
}

export type UIOrderType = "MARKET" | "LIMIT";

export interface MarginInfo {
  allocated: string;
  available: string;
  estimatedOrderReserve: string;
  required: string;
  hasEnough: boolean;
  hasValidQuantity: boolean;
  derivedQuantity: string;
  notionalValue: string;
}

import {
  resolveDefaultApiUrl,
  resolveDefaultWsUrl,
} from "@/config/apiEndpoints";
import { partner } from "@/config/partners";
import {
  arbitrum,
  base,
  bsc,
  mainnet,
  monad,
  optimism,
  plasma,
  polygon,
  robinhood,
  sei,
  sonic,
} from "viem/chains";
import {
  getContractAddress,
  getAppPartnerChain,
  getQueryAppTargetChainId,
  getCollateralAddress,
} from "@/utils/config";

export { ZERO_ADDRESS } from "@/utils/config";

export function resolveCurrentPartnerChain(search?: string) {
  return getAppPartnerChain({
    selectedChainId: getQueryAppTargetChainId(search),
  });
}

export function resolveCurrentPartnerChainIdentity(search?: string) {
  const currentPartnerChain = resolveCurrentPartnerChain(search);
  return {
    partnerChainKey: currentPartnerChain.partnerChainKey,
    partnerId: currentPartnerChain.partnerId,
    chainId: currentPartnerChain.chainId,
  };
}

export function resolveCurrentPartnerChainKey(search?: string) {
  return resolveCurrentPartnerChainIdentity(search).partnerChainKey;
}

function resolveBrowserWsUrl(rawWsUrl: string) {
  return typeof window !== 'undefined' && rawWsUrl.startsWith('/')
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${rawWsUrl}`
    : rawWsUrl;
}

export function getCurrentContractAddress(search?: string) {
  return getContractAddress({
    partnerContractAddress: resolveCurrentPartnerChain(search).contractAddress,
  });
}

export function getCurrentCollateralAddress(search?: string) {
  return getCollateralAddress({
    partnerCollateralAddress: resolveCurrentPartnerChain(search).collateralAddress,
  });
}

export const API_URL = resolveDefaultApiUrl(import.meta.env.DEV);
export const WS_URL = resolveBrowserWsUrl(resolveDefaultWsUrl(import.meta.env.DEV));

// Symbol is now a plain string type — the actual list is loaded dynamically from the backend.
export type Symbol = string;

// Binance market data always uses mainnet.
export const DEFAULT_PRICE_SOURCE = 'mainnet' as const;
export type PriceSource = typeof DEFAULT_PRICE_SOURCE;

// Binance USDⓈ-M futures WS routed endpoints (post-2026-04-23 migration).
// Each routed endpoint exposes its own nested /ws/<stream> (single) and
// /stream?streams=<list> (combined) subpaths. Stream-to-endpoint mapping:
//   /market/ws/<stream> — kline, aggTrade, markPrice, ticker, miniTicker, etc.
//   /public/ws/<stream> — bookTicker, depth<levels>@<speed>
//   /private             — user data streams (listenKey)
// Legacy `wss://fstream.binance.com/ws/<stream>` was decommissioned on
// 2026-04-23: connections still open but only deliver /public streams,
// silently dropping kline/markPrice/ticker frames.
// See https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams
export const BINANCE_CONFIG = {
  mainnet: {
    futuresRestUrl: 'https://fapi.binance.com',
    futuresMarketWsUrl: 'wss://fstream.binance.com/market/ws',
    futuresPublicWsUrl: 'wss://fstream.binance.com/public/ws',
  },
} as const;

// Scaling factors (matching backend)
// PRICE_SCALE is the 1e6 USDC amount scale (balances, margin, PnL, fees,
// withdrawals). Order and position prices are exact 1e18 DOMAIN_PRICE_SCALE.
export const PRICE_SCALE = 1_000_000n; // 1e6
export const DOMAIN_PRICE_SCALE = 1_000_000_000_000_000_000n; // 1e18
export const QUANTITY_SCALE = 100_000_000n; // 1e8
export const MIN_WITHDRAWAL_AMOUNT = 2n * PRICE_SCALE;
export const WITHDRAWAL_FEE_AMOUNT = 1n * PRICE_SCALE;
export const MAX_WITHDRAWAL_AMOUNT = 10_000n * PRICE_SCALE;

// Leverage limits
export const MIN_LEVERAGE = 1;

// Internal collateral accounting always uses 1e6 protocol units. The ERC-20
// used by a partner-chain lane can expose a different native precision.
export const PROTOCOL_COLLATERAL_DECIMALS = 6;
export const USDC_DECIMALS = PROTOCOL_COLLATERAL_DECIMALS;

export const SL_ORDER_TYPES = new Set(["STOP", "STOP_MARKET", "STOP_LOSS_LIMIT"]);

export const DEFAULT_TRADE_SYMBOL =
  partner.marketPreferences?.defaultSymbol || "BTC";
export const ORDER_BOOK_REST_DEPTH_LIMIT = 500;

// Public RPC fallbacks curated for browser access and frontend contract reads.
export const RPC_URLS_BY_CHAIN: Record<number, readonly string[]> = {
  [robinhood.id]: [
    "https://robinhood.api.pocket.network",
    "https://robinhood.drpc.org",
    "https://robinhood-rpc.publicnode.com",
  ],
  [mainnet.id]: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://ethereum.reth.rs/rpc",
  ],
  [optimism.id]: [
    "https://optimism.gateway.tenderly.co",
    "https://op.api.pocket.network",
  ],
  [arbitrum.id]: [
    "https://arbitrum.drpc.org",
    "https://arb-one.api.pocket.network",
  ],
  [polygon.id]: [
    "https://polygon.drpc.org",
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon.gateway.tenderly.co",
  ],
  [base.id]: [
    "https://base-rpc.publicnode.com",
    "https://base.gateway.tenderly.co",
  ],
  [sei.id]: [
    "https://sei.drpc.org",
    "https://evm-rpc.sei-apis.com",
    "https://sei.api.pocket.network",
  ],
  [sonic.id]: [
    "https://sonic.drpc.org",
    "https://sonic-rpc.publicnode.com",
    "https://sonic.api.pocket.network",
  ],
  [bsc.id]: [
    "https://bsc-rpc.publicnode.com",
    "https://bsc.api.pocket.network",
  ],
  [monad.id]: [
    "https://monad-mainnet.rpc.sentio.xyz",
    "https://infra.originstake.com/monad/evm",
  ],
  [plasma.id]: [
    "https://rpc.plasma.to",
    "https://plasma.gateway.tenderly.co",
  ],
};


export const TP_ORDER_TYPES = new Set([
  "TAKE_PROFIT",
  "TAKE_PROFIT_MARKET",
  "TAKE_PROFIT_LIMIT",
]);


export const ACTIVE_ORDER_STATUSES = new Set([
  "NEW",
  "PENDING_ACTIVATION",
  "PARTIALLY_FILLED",
]);

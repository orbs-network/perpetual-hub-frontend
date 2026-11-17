import { signTypedData } from 'wagmi/actions';
import { numberToHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Config } from 'wagmi';
import {
  BRACKET_ORDER_TYPES,
  CANCEL_TYPES,
  CREATE_REFERRAL_CODE_TYPES,
  createEIP712Domain,
  createPartnerChainKeyHash,
  createTermsAcceptanceDomain,
  LEVERAGE_TYPES,
  LINK_REFERRAL_CODE_TYPES,
  LOGIN_TYPES,
  ORDER_TYPES,
  TERMS_ACCEPTANCE_PRIMARY_TYPE,
  TERMS_ACCEPTANCE_TYPES,
  WEBSOCKET_AUTH_TYPES,
  WITHDRAWAL_TYPES,
} from '../config/eip712';

export interface SignLoginParams {
  config: Config;
  chainId: number;
  user: `0x${string}`;
  sessionPublicKey: Hex;
  sessionExpiresAt: bigint;
  timestamp: bigint;
}

export async function signLogin({ config, chainId, user, sessionPublicKey, sessionExpiresAt, timestamp }: SignLoginParams): Promise<string> {
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);
  const signature = await signTypedData(config, {
    domain,
    types: LOGIN_TYPES,
    primaryType: 'Login',
    message: {
      partnerChainKeyHash,
      user,
      sessionPublicKey,
      sessionExpiresAt,
      timestamp,
    },
  });

  return signature;
}

export interface SignTermsAcceptanceParams {
  config: Config;
  chainId: number;
  chainName: string;
  timestamp: bigint;
}

export async function signTermsAcceptance({ config, chainId, chainName, timestamp }: SignTermsAcceptanceParams): Promise<Hex> {
  const domain = createTermsAcceptanceDomain(chainId);
  const message = {
    type: 'acceptTerms',
    signatureChainId: numberToHex(chainId),
    perpetualHubChain: chainName,
    time: timestamp,
  };

  return signTypedData(config, {
    domain,
    types: TERMS_ACCEPTANCE_TYPES,
    primaryType: TERMS_ACCEPTANCE_PRIMARY_TYPE,
    message,
  });
}

function getSessionAccount(sessionKey: Hex) {
  return privateKeyToAccount(sessionKey);
}

export interface SignWebSocketAuthParams {
  sessionKey: Hex;
  chainId: number;
  user: `0x${string}`;
  timestamp: bigint;
}

export async function signWebSocketAuth({ sessionKey, chainId, user, timestamp }: SignWebSocketAuthParams): Promise<string> {
  const account = getSessionAccount(sessionKey);
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);

  return account.signTypedData({
    domain,
    types: WEBSOCKET_AUTH_TYPES,
    primaryType: 'WebSocketAuth',
    message: {
      partnerChainKeyHash,
      user,
      timestamp,
    },
  });
}

export interface SignOrderParams {
  sessionKey: Hex;
  chainId: number;
  user: `0x${string}`;
  symbol: string;
  orderType: string;
  side: string;
  quantity: bigint;
  price: bigint;
  stopPrice: bigint;
  reduceOnly: boolean;
  closePosition: boolean;
  timeInForce: string;
  timestamp: bigint;
}

export async function signOrder({ sessionKey, chainId, ...params }: SignOrderParams): Promise<string> {
  const account = getSessionAccount(sessionKey);
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);

  const signature = await account.signTypedData({
    domain,
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: {
      partnerChainKeyHash,
      user: params.user,
      symbol: params.symbol,
      orderType: params.orderType,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      reduceOnly: params.reduceOnly,
      closePosition: params.closePosition,
      timeInForce: params.timeInForce,
      timestamp: params.timestamp,
    },
  });

  return signature;
}

export interface SignBracketOrderParams {
  sessionKey: Hex;
  chainId: number;
  user: `0x${string}`;
  symbol: string;
  side: string;
  orderType: string;
  quantity: bigint;
  price: bigint;
  stopPrice: bigint;
  reduceOnly: boolean;
  closePosition: boolean;
  timeInForce: string;
  timestamp: bigint;
  takeProfitType?: string;
  takeProfitStopPrice?: bigint;
  takeProfitPrice?: bigint;
  stopLossType?: string;
  stopLossStopPrice?: bigint;
  stopLossPrice?: bigint;
}

export async function signBracketOrder({ sessionKey, chainId, ...params }: SignBracketOrderParams): Promise<string> {
  const account = getSessionAccount(sessionKey);
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);

  return account.signTypedData({
    domain,
    types: BRACKET_ORDER_TYPES,
    primaryType: 'BracketOrder',
    message: {
      partnerChainKeyHash,
      user: params.user,
      symbol: params.symbol,
      side: params.side,
      orderType: params.orderType,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      reduceOnly: params.reduceOnly,
      closePosition: params.closePosition,
      timeInForce: params.timeInForce,
      timestamp: params.timestamp,
      takeProfitType: params.takeProfitType ?? "",
      takeProfitStopPrice: params.takeProfitStopPrice ?? 0n,
      takeProfitPrice: params.takeProfitPrice ?? 0n,
      stopLossType: params.stopLossType ?? "",
      stopLossStopPrice: params.stopLossStopPrice ?? 0n,
      stopLossPrice: params.stopLossPrice ?? 0n,
    },
  });
}

export interface SignCancelParams {
  sessionKey: Hex;
  chainId: number;
  user: `0x${string}`;
  orderId: bigint;
  timestamp: bigint;
}

export async function signCancel({ sessionKey, chainId, user, orderId, timestamp }: SignCancelParams): Promise<string> {
  const account = getSessionAccount(sessionKey);
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);

  const signature = await account.signTypedData({
    domain,
    types: CANCEL_TYPES,
    primaryType: 'Cancel',
    message: {
      partnerChainKeyHash,
      user,
      orderId,
      timestamp,
    },
  });

  return signature;
}

export interface SignWithdrawalParams {
  config: Config;
  chainId: number;
  user: `0x${string}`;
  recipient: `0x${string}`;
  amount: bigint;
  isMax: boolean;
  isLegacyUser?: boolean;
  timestamp: bigint;
}

export async function signWithdrawal({ config, chainId, user, recipient, amount, isMax, isLegacyUser = false, timestamp }: SignWithdrawalParams): Promise<string> {
  const domain = createEIP712Domain(chainId);
  const message = {
    partnerChainKeyHash: createPartnerChainKeyHash(chainId),
    user, recipient, amount, isMax, timestamp,
  };
  if (isLegacyUser) {
    return signTypedData(config, {
      domain,
      types: { LegacyUserWithdrawal: WITHDRAWAL_TYPES.Withdrawal },
      primaryType: 'LegacyUserWithdrawal',
      message,
    });
  }
  return signTypedData(config, {
    domain,
    types: WITHDRAWAL_TYPES,
    primaryType: 'Withdrawal',
    message,
  });
}

export interface SignWalletWithdrawalParams {
  config: Config;
  chainId: number;
  user: `0x${string}`;
  recipient: `0x${string}`;
  amount: bigint;
  isMax: boolean;
  timestamp: bigint;
}

export async function signWalletWithdrawal({
  config,
  chainId,
  user,
  recipient,
  amount,
  isMax,
  timestamp,
}: SignWalletWithdrawalParams): Promise<string> {
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);

  return signTypedData(config, {
    domain,
    types: WITHDRAWAL_TYPES,
    primaryType: 'Withdrawal',
    message: {
      partnerChainKeyHash,
      user,
      recipient,
      amount,
      isMax,
      timestamp,
    },
  });
}

export interface SignLeverageParams {
  sessionKey: Hex;
  chainId: number;
  user: `0x${string}`;
  symbol: string;
  leverage: bigint;
  timestamp: bigint;
}

export async function signLeverage({ sessionKey, chainId, user, symbol, leverage, timestamp }: SignLeverageParams): Promise<string> {
  const account = getSessionAccount(sessionKey);
  const domain = createEIP712Domain(chainId);
  const partnerChainKeyHash = createPartnerChainKeyHash(chainId);

  const signature = await account.signTypedData({
    domain,
    types: LEVERAGE_TYPES,
    primaryType: 'Leverage',
    message: {
      partnerChainKeyHash,
      user,
      symbol,
      leverage,
      timestamp,
    },
  });

  return signature;
}

export interface ReferralCodeTypedDataParams {
  user: `0x${string}`;
  partnerId: string;
  code: string;
  timestamp: bigint;
  chainId: number;
}

export function buildCreateReferralCodeTypedData({
  user,
  partnerId,
  code,
  timestamp,
  chainId,
}: ReferralCodeTypedDataParams) {
  return {
    domain: createEIP712Domain(chainId),
    types: CREATE_REFERRAL_CODE_TYPES,
    primaryType: 'CreateReferralCode',
    message: {
      user,
      partnerId,
      code,
      timestamp,
    },
  } as const;
}

export function buildLinkReferralCodeTypedData({
  user,
  partnerId,
  code,
  timestamp,
  chainId,
}: ReferralCodeTypedDataParams) {
  return {
    domain: createEIP712Domain(chainId),
    types: LINK_REFERRAL_CODE_TYPES,
    primaryType: 'LinkReferralCode',
    message: {
      partnerChainKeyHash: createPartnerChainKeyHash(chainId),
      user,
      partnerId,
      code,
      timestamp,
    },
  } as const;
}

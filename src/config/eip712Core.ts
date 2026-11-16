import { sha256, stringToHex, zeroAddress, type Address, type Hex } from 'viem';

export function createProtocolEIP712Domain(
  chainId: number,
  verifyingContract: Address,
) {
  return {
    name: 'ProtocolTEE',
    version: '1',
    chainId: BigInt(chainId),
    verifyingContract,
  } as const;
}

export function createTermsAcceptanceDomain(chainId: number) {
  return {
    name: 'PerpetualHubSignTransaction',
    version: '1',
    chainId,
    verifyingContract: zeroAddress,
  } as const;
}

export function createPartnerChainKeyHash(partnerId: string, chainId: number | string): Hex {
  return sha256(stringToHex(`partner_chain:${partnerId.trim()}:${String(chainId).trim()}`));
}

export const LOGIN_TYPES = {
  Login: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'sessionPublicKey', type: 'string' },
    { name: 'sessionExpiresAt', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const TERMS_ACCEPTANCE_PRIMARY_TYPE = 'PerpetualHub:AcceptTerms';

export const TERMS_ACCEPTANCE_TYPES = {
  'PerpetualHub:AcceptTerms': [
    { name: 'perpetualHubChain', type: 'string' },
    { name: 'time', type: 'uint64' },
  ],
} as const;

export const WEBSOCKET_AUTH_TYPES = {
  WebSocketAuth: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const ORDER_TYPES = {
  Order: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'symbol', type: 'string' },
    { name: 'orderType', type: 'string' },
    { name: 'side', type: 'string' },
    { name: 'quantity', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'stopPrice', type: 'uint256' },
    { name: 'reduceOnly', type: 'bool' },
    { name: 'closePosition', type: 'bool' },
    { name: 'timeInForce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const BRACKET_ORDER_TYPES = {
  BracketOrder: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'symbol', type: 'string' },
    { name: 'side', type: 'string' },
    { name: 'orderType', type: 'string' },
    { name: 'quantity', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'stopPrice', type: 'uint256' },
    { name: 'reduceOnly', type: 'bool' },
    { name: 'closePosition', type: 'bool' },
    { name: 'timeInForce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'takeProfitType', type: 'string' },
    { name: 'takeProfitStopPrice', type: 'uint256' },
    { name: 'takeProfitPrice', type: 'uint256' },
    { name: 'stopLossType', type: 'string' },
    { name: 'stopLossStopPrice', type: 'uint256' },
    { name: 'stopLossPrice', type: 'uint256' },
  ],
} as const;

export const CANCEL_TYPES = {
  Cancel: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'orderId', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const WITHDRAWAL_TYPES = {
  Withdrawal: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'isMax', type: 'bool' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const LEVERAGE_TYPES = {
  Leverage: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'symbol', type: 'string' },
    { name: 'leverage', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const CREATE_REFERRAL_CODE_TYPES = {
  CreateReferralCode: [
    { name: 'user', type: 'address' },
    { name: 'partnerId', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export const LINK_REFERRAL_CODE_TYPES = {
  LinkReferralCode: [
    { name: 'partnerChainKeyHash', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'partnerId', type: 'string' },
    { name: 'code', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

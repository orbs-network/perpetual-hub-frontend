import { isAddress, zeroAddress, type Address, type Hex } from 'viem';
import {
  createPartnerChainKeyHash as createPartnerChainKeyHashForPartner,
  createProtocolEIP712Domain,
} from './eip712Core';
import { partner } from './partners';

export * from './eip712Core';

// Create EIP-712 domain for a specific chain
export function createEIP712Domain(chainId: number) {
  const chain = partner.chains.find((entry) => entry.chainId === chainId);
  if (!chain) {
    throw new Error(`Unsupported partner chain: ${chainId}`);
  }
  const verifyingContract = chain.contractAddress;
  if (
    !isAddress(verifyingContract, { strict: false }) ||
    verifyingContract.toLowerCase() === zeroAddress
  ) {
    throw new Error("Invalid contract address");
  }

  return createProtocolEIP712Domain(chainId, verifyingContract as Address);
}

export function createPartnerChainKeyHash(chainId: number | string): Hex {
  return createPartnerChainKeyHashForPartner(partner.id, chainId);
}

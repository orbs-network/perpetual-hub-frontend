export function buildPartnerChainKey(partnerId: string, chainId: number | string) {
  return `${partnerId}:${chainId}`;
}

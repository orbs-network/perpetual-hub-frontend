import { getChainDetails } from "@/config/chains";

export function buildAddressExplorerUrl(
  chainId: number | null | undefined,
  address: string,
) {
  if (!Number.isInteger(chainId) || !chainId || chainId <= 0) return "";

  const explorerUrl = getChainDetails(chainId).blockExplorers?.default?.url;
  return explorerUrl
    ? `${explorerUrl.replace(/\/$/, "")}/address/${address}`
    : "";
}

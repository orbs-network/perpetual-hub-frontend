import { setAppChainQueryParam } from "@/utils/config";

export function buildHeaderChainSelectorHref({
  chainId,
  hash,
  pathname,
  search,
}: {
  chainId: number;
  hash: string;
  pathname: string;
  search: string;
}) {
  return `${pathname}${setAppChainQueryParam(chainId, search)}${hash}`;
}

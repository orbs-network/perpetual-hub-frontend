import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQueryParams, type UrlUpdateType } from "use-query-params";
import {
  appQueryParamConfig,
  stripDeprecatedAppQueryParams,
  stripReadOnlyPortfolioQueryParams,
  stripUserSessionQueryParams,
  type SharedSession,
} from "@/lib/appQueryParams";
import { isAddress } from "viem";

function isUserSessionPath(pathname: string) {
  return pathname === "/user-session" || pathname === "/use-session";
}

export function useAppQueryParams() {
  const [query, setQuery] = useQueryParams(appQueryParamConfig);
  const { pathname, search } = useLocation();
  const setAddress = useCallback(
    (address: string, updateType: UrlUpdateType = "pushIn") => {
      setQuery({ address: address || undefined }, updateType);
    },
    [setQuery],
  );


  const sharedSession = (query.s ?? null) as SharedSession | null;
  const rawViewerAddress = sharedSession?.address ?? query.v ?? undefined;
  const viewerAddress = rawViewerAddress && isAddress(rawViewerAddress, { strict: false })
    ? rawViewerAddress
    : undefined;

  return {
    address: query.address ?? "",
    viewerAddress,
    sharedSession,
    query,
    queryString: isUserSessionPath(pathname)
      ? stripUserSessionQueryParams(search)
      : stripReadOnlyPortfolioQueryParams(
          stripDeprecatedAppQueryParams(search),
        ),
    setAddress,
    setQuery,
  };
}

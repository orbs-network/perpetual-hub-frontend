import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getRollupStatus } from "@/api/chain";
import { useCurrentPartnerChainKey } from "./useCurrentPartnerChain";

const ROLLUP_STATUS_KEY = ["rollupStatus"] as const;

/** Mutation callbacks refresh this status explicitly; it does not poll. */
export function useRollupStatus() {
  const partnerChainKey = useCurrentPartnerChainKey();
  const query = useQuery({
    queryKey: [...ROLLUP_STATUS_KEY, partnerChainKey],
    queryFn: ({ signal }) => getRollupStatus(signal),
    staleTime: 10_000,
    enabled: false,
  });

  return useMemo(() => {
    return {
      status: query.data ?? null,
      error: query.error ? query.error.message : null,
      isLoading: query.isLoading,
      refetch: query.refetch,
    };
  }, [query.data, query.error, query.isLoading, query.refetch]);
}

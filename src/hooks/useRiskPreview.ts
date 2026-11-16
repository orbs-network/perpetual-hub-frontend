import { useQuery } from "@tanstack/react-query";
import { getRiskPreview } from "@/api/user";
import { useActiveAddress } from "./useActiveAddress";

const RISK_PREVIEW_POLL_INTERVAL_MS = 30_000;

export function useRiskPreview(symbol: string, enabled: boolean) {
  const address = useActiveAddress();

  return useQuery({
    queryKey: ["riskPreview", address, symbol],
    queryFn: ({ signal }) => getRiskPreview(address!, symbol, signal),
    enabled: !!address && !!symbol && enabled,
    refetchInterval: enabled ? RISK_PREVIEW_POLL_INTERVAL_MS : false,
    staleTime: RISK_PREVIEW_POLL_INTERVAL_MS,
    retry: 1,
  });
}

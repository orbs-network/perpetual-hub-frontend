import { useQuery } from "@tanstack/react-query";
import { getHedgerAccounting } from "@/api/hedger";
import { useTeeConfig } from "./useTeeConfig";
import { isSameAddress } from "@/utils/address";

export const HEDGER_ACCOUNTING_QUERY_KEY = ["hedgerAccounting"];

export function useIsHedgerAddress(address?: string | null) {
  const { data: teeConfig, isError } = useTeeConfig();
  const isResolved = !address || !!teeConfig || isError;
  return {
    isHedger: isSameAddress(address, teeConfig?.hedgerAddress),
    isResolved,
  };
}

export function useHedgerAccounting(enabled = true) {
  return useQuery({
    queryKey: HEDGER_ACCOUNTING_QUERY_KEY,
    queryFn: ({ signal }) => getHedgerAccounting(signal),
    enabled,
    refetchInterval: 10_000,
    retry: 2,
  });
}

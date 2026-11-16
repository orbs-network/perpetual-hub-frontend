import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { getLegacyHedgerUser } from "@/api/user";

export const LEGACY_HEDGER_ACCOUNT_QUERY_KEY = ["legacyHedgerUser"];

export function useLegacyHedgerAccount(address: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...LEGACY_HEDGER_ACCOUNT_QUERY_KEY, address],
    queryFn: async ({ signal }) => {
      try {
        const account = await getLegacyHedgerUser(address!, signal);
        return { availableBalance: BigInt(account.availableBalance) };
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return { availableBalance: 0n };
        }
        throw error;
      }
    },
    enabled: enabled && !!address,
    refetchInterval: 5_000,
    retry: 1,
  });
}

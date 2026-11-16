import { useQuery } from "@tanstack/react-query";
import { getHedgerAccounting } from "@/api/hedger";
import { getUserPortfolio } from "@/api/user";
import { buildHedgerPortfolio } from "@/lib/portfolio";
import { usePortfolioAddress } from "./usePortfolioAddress";
import { useIsHedgerAddress } from "./useHedgerAccounting";

const POLL_INTERVAL = 10_000;

export function useUserPortfolio() {
  const address = usePortfolioAddress();
  const { isHedger, isResolved: isHedgerRoleResolved } =
    useIsHedgerAddress(address);

  const query = useQuery({
    queryKey: [isHedger ? "hedgerPortfolio" : "userPortfolio", address],
    queryFn: async ({ signal }) => {
      if (isHedger) {
        return buildHedgerPortfolio(await getHedgerAccounting(signal));
      }
      return getUserPortfolio(address!, signal);
    },
    enabled: !!address && isHedgerRoleResolved,
    refetchInterval: POLL_INTERVAL,
    retry: 2,
  });

  return {
    ...query,
    isLoading:
      query.isLoading || (Boolean(address) && !isHedgerRoleResolved),
  };
}

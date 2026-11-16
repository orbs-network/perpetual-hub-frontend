import { fetchAdminConfig } from "@/api/tee";
import { useQuery } from "@tanstack/react-query";

const TEE_CONFIG_KEY = ["teeConfig"];

/**
 * The trading page gates the chart, the markets list and the price socket on
 * this query. During a deploy the API answers 502/503 for roughly 40 seconds;
 * with the old two quick retries and no refetch interval, a page loaded in that
 * window stayed on skeletons until the user refocused or reloaded. Retries now
 * cover the cutover window and an errored query keeps polling until it heals.
 */
export const TEE_CONFIG_RETRY_COUNT = 5;
export const TEE_CONFIG_RETRY_MAX_DELAY_MS = 10_000;
export const TEE_CONFIG_ERROR_REFETCH_INTERVAL_MS = 5_000;

export function teeConfigRetryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, TEE_CONFIG_RETRY_MAX_DELAY_MS);
}

export function teeConfigRefetchInterval(
  status: "pending" | "error" | "success",
): number | false {
  return status === "error" ? TEE_CONFIG_ERROR_REFETCH_INTERVAL_MS : false;
}

export function useTeeConfig() {
  return useQuery({
    queryKey: TEE_CONFIG_KEY,
    queryFn: async ({ signal }) => {
      const response = await fetchAdminConfig(signal);
      if (!response.config) {
        throw new Error("TEE config response missing config");
      }
      return response.config;
    },
    retry: TEE_CONFIG_RETRY_COUNT,
    retryDelay: teeConfigRetryDelay,
    refetchInterval: (query) => teeConfigRefetchInterval(query.state.status),
    refetchIntervalInBackground: false,
    staleTime: Infinity,
  });
}

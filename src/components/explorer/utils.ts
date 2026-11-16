import { formatTimestamp } from "@/utils/formatting";

export function truncateHash(hash?: string | null): string {
  if (!hash || hash.length <= 12) return hash || "N/A";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/** Explorer API timestamps are Unix epoch milliseconds. */
export function formatExplorerTimestamp(ms?: number | null): string {
  if (!ms) return "N/A";
  return formatTimestamp(ms);
}

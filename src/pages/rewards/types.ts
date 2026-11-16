import type { ReferredUserSummary } from "@/api/referrals";

export type ReferralDialog = "create" | "enter" | null;

export type ReferralTableUser = ReferredUserSummary & {
  feesPaid?: string;
  totalVolume?: string;
  yourRewards?: string;
};

export type WalletAddress = `0x${string}`;

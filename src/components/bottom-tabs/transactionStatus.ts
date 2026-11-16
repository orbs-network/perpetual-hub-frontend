import { safeUpperCase } from "@/lib/utils";
import type { TransactionItem } from "@/types";

const MINUTE_MS = 60 * 1000;
const WITHDRAWAL_DISPLAY_DELAY_MS = 24 * 60 * MINUTE_MS;

type TransactionStatusInput = Pick<
  TransactionItem,
  "operationType" | "status" | "timestamp" | "withdrawal" | "accountingStatus"
>;

type EstimateTranslator = (
  key: string,
  options?: { hours: number; minutes: number },
) => string;

export function isWithdrawalTransaction(transaction: TransactionStatusInput) {
  return safeUpperCase(transaction.operationType).includes("WITHDRAW");
}

// Keep request admission status intact for portfolio accounting; this label is
// only the withdrawal's latest lifecycle progress for display and export.
export function transactionDisplayStatus(transaction: TransactionStatusInput): string {
  const payoutStatus = transaction.withdrawal?.payout?.status;
  if (payoutStatus) {
    const labels = { PAID: "PAID", CLAIMABLE: "AWAITING PAYMENT", COOLDOWN: "PENDING", PAUSED: "WITHDRAWALS STOPPED", UNAVAILABLE: "PAYMENT STATUS UNAVAILABLE" };
    return labels[payoutStatus];
  }
  if (transaction.accountingStatus === "UNAVAILABLE") {
    return transaction.withdrawal?.status === "RELEASE_FAILED"
      ? "FAILED · ACCOUNTING UNAVAILABLE" : "ACCOUNTING UNAVAILABLE";
  }
  if (!transaction.withdrawal) return isWithdrawalTransaction(transaction) && transaction.status === "SUCCESS"
    ? "PAYMENT STATUS UNAVAILABLE" : transaction.status || "-";
  switch (transaction.withdrawal.status) {
    case "REQUEST_REJECTED": return "REJECTED";
    case "REQUEST_ACCEPTED": return "PENDING";
    case "RELEASE_ACCEPTED": return "SUBMITTED";
    case "ROLLUP_CONFIRMED": return "PAYMENT STATUS UNAVAILABLE";
    case "RELEASE_FAILED": return "FAILED";
    case "FEE_ONLY": return "FEE CHARGED";
    default: return "UNKNOWN";
  }
}

export function formatPendingWithdrawalEstimate(
  transaction: TransactionStatusInput,
  nowMs = Date.now(),
  translate: EstimateTranslator = (key) => key,
) {
  if (!isWithdrawalTransaction(transaction) || !Number.isSafeInteger(transaction.timestamp) ||
      transaction.timestamp <= 0 || !Number.isFinite(nowMs)) {
    return null;
  }

  const withdrawal = transaction.withdrawal;
  if (!withdrawal || !["REQUEST_ACCEPTED", "RELEASE_ACCEPTED", "ROLLUP_CONFIRMED"].includes(withdrawal.status)) return null;
  if (withdrawal.payout ? withdrawal.payout.status !== "COOLDOWN" : withdrawal.status === "ROLLUP_CONFIRMED") return null;

  // Frontend display policy: always estimate 24 hours from the original request,
  // including queued payouts, without adding the separate backend request hold.
  const deadline = transaction.timestamp + WITHDRAWAL_DISPLAY_DELAY_MS;
  if (!Number.isSafeInteger(deadline) || deadline <= nowMs) return null;
  const totalMinutes = Math.ceil((deadline - nowMs) / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const key = hours > 0
    ? minutes > 0 ? "Estimated arrival in {{hours}}h {{minutes}}m" : "Estimated arrival in {{hours}}h"
    : "Estimated arrival in {{minutes}}m";
  return translate(key, { hours, minutes })
    .replace("{{hours}}", String(hours))
    .replace("{{minutes}}", String(minutes));
}

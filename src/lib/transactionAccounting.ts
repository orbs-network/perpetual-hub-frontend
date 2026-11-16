import type { TransactionItem } from "@/types";

// Missing accounting is distinct from a real zero-payout/zero-fee withdrawal.
export function hasUnavailableWithdrawalAccounting(transaction: TransactionItem) {
  if (transaction.operationType?.toUpperCase() !== "WITHDRAWAL" || transaction.status?.toUpperCase() !== "SUCCESS") return false;
  return transaction.accountingStatus === "UNAVAILABLE" ||
    !/^\d+$/.test(transaction.amount ?? "") || !/^\d+$/.test(transaction.fee ?? "");
}

import { formatNumber } from "@/utils/formatting";
import { safeUpperCase } from "@/lib/utils";
import type { TransactionItem } from "@/types";

export interface TransactionAmountBreakdown {
  amount: bigint | null;
  fee: bigint | null;
  debit: bigint | null;
}

function parseRawAmount(value?: string | number | bigint | null) {
  if (value === undefined || value === null || !/^\d+$/.test(String(value))) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function isSuccessfulWithdrawal(transaction: TransactionItem) {
  return (
    safeUpperCase(transaction.operationType) === "WITHDRAWAL" &&
    safeUpperCase(transaction.status) === "SUCCESS"
  );
}

export function getTransactionAmountBreakdown(
  transaction: TransactionItem,
): TransactionAmountBreakdown {
  const amount = parseRawAmount(transaction.amount);
  if (!isSuccessfulWithdrawal(transaction) || amount === null || amount < 0n) {
    return { amount, fee: null, debit: null };
  }

  const explicitFee = parseRawAmount(transaction.fee);
  const fee = explicitFee !== null && explicitFee >= 0n ? explicitFee : null;
  return { amount, fee, debit: fee === null ? null : amount + fee };
}


export function formatTransactionCsvAmount(transaction: TransactionItem) {
  const amount = getTransactionAmountBreakdown(transaction).amount;
  return amount === null ? "-" : `$${formatNumber(amount, { decimalScale: 2, scaled: "price" })}`;
}

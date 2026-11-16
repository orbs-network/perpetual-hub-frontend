import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TableCell } from "@/components/ui/table";
import { formatTimestamp, formatNumber } from "@/utils/formatting";
import type { TransactionItem } from "@/types";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  formatOperationTypeLabel,
  getTransactionTypeBadgeClass,
  getTransactionStatusBadgeClass,
} from "./utils";
import { getTransactionAmountBreakdown } from "./transactionAmounts";
import { formatPendingWithdrawalEstimate, transactionDisplayStatus } from "./transactionStatus";

interface TransactionRowProps {
  transaction: TransactionItem;
  nowMs?: number;
}

function formatUsdAmount(amount: bigint | string) {
  return `$${formatNumber(amount, { decimalScale: 2, scaled: "price" })}`;
}

function TransactionAmountDisplay({ transaction }: TransactionRowProps) {
  const { t } = useTranslation();
  const breakdown = getTransactionAmountBreakdown(transaction);
  if (breakdown.amount === null) return <>-</>;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1 leading-tight">
      <span>{formatUsdAmount(breakdown.amount)}</span>
      {breakdown.debit !== null && (
        <span className="text-[10px] font-medium text-content-muted">
          ({t("Debit")} {formatUsdAmount(breakdown.debit)})
        </span>
      )}
    </span>
  );
}

function TransactionFeeCell({ transaction }: TransactionRowProps) {
  const breakdown = getTransactionAmountBreakdown(transaction);
  return breakdown.fee !== null ? formatUsdAmount(breakdown.fee) : "-";
}

function TransactionReceiveEstimate({ transaction, nowMs }: TransactionRowProps) {
  const { t } = useTranslation();
  const estimate = formatPendingWithdrawalEstimate(
    transaction,
    nowMs,
    (key, options) => t(key, options),
  );
  if (!estimate) return null;

  return (
    <span className="text-[10px] font-semibold text-content-muted">
      ({estimate})
    </span>
  );
}

function TransactionTypeDisplay({ transaction, nowMs }: TransactionRowProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getTransactionTypeBadgeClass(transaction.operationType || "")}`}>
        {formatOperationTypeLabel(transaction.operationType)}
      </span>
      <TransactionReceiveEstimate transaction={transaction} nowMs={nowMs} />
    </span>
  );
}

function TransactionStatusBadge({ transaction }: TransactionRowProps) {
  const status = transactionDisplayStatus(transaction);
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getTransactionStatusBadgeClass(status)}`}>
      {status}
    </span>
  );
}

export function TransactionCells({ transaction, nowMs }: TransactionRowProps) {
  return (
    <>
      <TableCell className="text-content ">
        {formatTimestamp(transaction.timestamp)}
      </TableCell>

      <TableCell>
        <TransactionTypeDisplay transaction={transaction} nowMs={nowMs} />
      </TableCell>

      <TableCell className=" text-content-secondary font-medium">
        <TransactionAmountDisplay transaction={transaction} />
      </TableCell>

      <TableCell className=" text-content-secondary font-medium">
        <TransactionFeeCell transaction={transaction} />
      </TableCell>

      <TableCell>
        <TransactionStatusBadge transaction={transaction} />
      </TableCell>

    </>
  );
}

export function MobileTransactionCard({ transaction, nowMs }: TransactionRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const breakdown = getTransactionAmountBreakdown(transaction);

  return (
    <div className="bg-base border border-edge rounded-lg">
      <div className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-1.5">
          <TransactionTypeDisplay transaction={transaction} nowMs={nowMs} />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2"
        >
          <span className="text-right text-[11px] text-content-secondary">
            <TransactionAmountDisplay transaction={transaction} />
          </span>
          <ChevronDown
            size={14}
            className={`text-content-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
            <div>
              <div className="text-content-muted">{t("Status")}</div>
              <div>
                <TransactionStatusBadge transaction={transaction} />
              </div>
            </div>
            <div>
              <div className="text-content-muted">{t("Fee")}</div>
              <div className="text-content-secondary">
                {breakdown.fee !== null ? formatUsdAmount(breakdown.fee) : "-"}
              </div>
            </div>
            <div>
              <div className="text-content-muted">{t("Time")}</div>
              <div className="text-content-secondary">
                {formatTimestamp(transaction.timestamp)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

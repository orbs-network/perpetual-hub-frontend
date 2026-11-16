import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useTransactions } from "@/hooks/useTransactions";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { getRecentUserTransactions } from "@/api/history";
import type { TransactionItem } from "@/types";
import { TransactionCells, MobileTransactionCard } from "./TransactionRow";
import {
  ActivityState,
  type AddressScopedHistoryTableProps,
} from "./shared";
import { SortableHeaderRow } from "./SortableHeaderRow";
import { formatNumber, formatTimestamp } from "@/utils/formatting";
import {
  compareBigInt,
  compareText,
  sortRows,
  useSortedRows,
  useTableSort,
  type SortDirection,
} from "./useSortableRows";
import { formatOperationTypeLabel } from "./utils";
import { getTransactionAmountBreakdown, formatTransactionCsvAmount } from "./transactionAmounts";
import { isWithdrawalTransaction, transactionDisplayStatus } from "./transactionStatus";
import { buildTimestampedCsvFilename } from "./csvExport";

type TransactionSortColumn = "time" | "type" | "amount" | "fee" | "status";

const DEFAULT_TRANSACTION_SORT_DIRECTIONS: Record<
  TransactionSortColumn,
  SortDirection
> = {
  time: "desc",
  type: "asc",
  amount: "desc",
  fee: "desc",
  status: "asc",
};

const TRANSACTION_SORT_LABELS: Record<TransactionSortColumn, string> = {
  time: "time",
  type: "type",
  amount: "amount",
  fee: "fee",
  status: "status",
};

interface TransactionColumn {
  column: TransactionSortColumn;
  label: string;
}

const TRANSACTION_COLUMNS: TransactionColumn[] = [
  { column: "time", label: "Time" },
  { column: "type", label: "Type" },
  { column: "amount", label: "Amount" },
  { column: "fee", label: "Fee" },
  { column: "status", label: "Status" },
];

function parseTransactionAmount(transaction: TransactionItem) {
  try {
    return BigInt(transaction.amount || "0");
  } catch {
    return 0n;
  }
}

function compareTransactionsByColumn(
  column: TransactionSortColumn,
  left: TransactionItem,
  right: TransactionItem,
) {
  switch (column) {
    case "time":
      return left.timestamp - right.timestamp;
    case "type":
      return compareText(
        formatOperationTypeLabel(left.operationType),
        formatOperationTypeLabel(right.operationType),
      );
    case "amount":
      return compareBigInt(
        parseTransactionAmount(left),
        parseTransactionAmount(right),
      );
    case "fee":
      return compareBigInt(
        getTransactionAmountBreakdown(left).fee ?? 0n,
        getTransactionAmountBreakdown(right).fee ?? 0n,
      );
    case "status":
      return compareText(transactionDisplayStatus(left), transactionDisplayStatus(right));
    default:
      return 0;
  }
}

export function TransactionsTable({
  address: addressOverride,
  fillAvailableSpace,
  queryKeyScope,
}: AddressScopedHistoryTableProps = {}) {
  const { t } = useTranslation();
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;
  const {
    data: transactions,
    isInitialLoading,
    error,
    total,
    pageSize,
    fetchNextPage,
    hasNextPage,
    historyRowLimit,
    isFetchingNextPage,
  } = useTransactions(address, queryKeyScope);
  const { sort, setSortColumn, getNextDirection } =
    useTableSort<TransactionSortColumn>({
      initialSort: {
        column: "time",
        direction: "desc",
      },
      defaultDirections: DEFAULT_TRANSACTION_SORT_DIRECTIONS,
    });
  const sortedTransactions = useSortedRows({
    rows: transactions,
    sort,
    compareRows: compareTransactionsByColumn,
  });
  const hasPendingWithdrawal = useMemo(
    () => sortedTransactions.some(isWithdrawalTransaction),
    [sortedTransactions],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!hasPendingWithdrawal) return undefined;

    const refreshNow = () => setNowMs(Date.now());
    const timeoutId = window.setTimeout(refreshNow, 0);
    const intervalId = window.setInterval(refreshNow, 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [hasPendingWithdrawal]);

  const fetchCsvRows = useCallback(async (signal?: AbortSignal) => {
    if (!address) return [];
    const rows = await getRecentUserTransactions(address, signal);
    return sortRows({
      rows,
      sort: {
        column: sort.column,
        direction: sort.direction,
      },
      compareRows: compareTransactionsByColumn,
    });
  }, [address, sort.column, sort.direction]);
  const csvExport = useMemo(
    () => ({
      filename: () =>
        buildTimestampedCsvFilename(["deposits-and-withdrawals", address]),
      fetchRows: fetchCsvRows,
      columns: [
        { header: t("Time"), value: (tx: TransactionItem) => formatTimestamp(tx.timestamp) },
        { header: t("Type"), value: (tx: TransactionItem) => t(formatOperationTypeLabel(tx.operationType)) },
        {
          header: t("Amount"),
          value: formatTransactionCsvAmount,
        },
        {
          header: t("Debit"),
          value: (tx: TransactionItem) => {
            const debit = getTransactionAmountBreakdown(tx).debit;
            return debit !== null
              ? `$${formatNumber(debit, { decimalScale: 2, scaled: "price" })}`
              : "-";
          },
        },
        {
          header: t("Fee"),
          value: (tx: TransactionItem) => {
            const fee = getTransactionAmountBreakdown(tx).fee;
            return fee !== null
              ? `$${formatNumber(fee, { decimalScale: 2, scaled: "price" })}`
              : "-";
          },
        },
        { header: t("Status"), value: (tx: TransactionItem) => transactionDisplayStatus(tx) },
      ],
    }),
    [address, fetchCsvRows, t],
  );

  return (
    <ActivityState
      address={address}
      icon={CreditCard}
      emptyTitle="No Transactions"
      emptySubtitle="Your Deposits And Withdrawals Will Appear Here"
      isLoading={isInitialLoading}
      isEmpty={total === 0}
      error={error}
      fillAvailableSpace={fillAvailableSpace}
      label="Transactions"
      data={sortedTransactions}
      csvExport={csvExport}
      computeItemKey={(_, tx) => `${tx.id}-${tx.timestamp}`}
      pageSize={pageSize}
      total={total}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      historyRowLimit={historyRowLimit}
      isFetchingNextPage={isFetchingNextPage}
      fixedHeaderContent={() => (
        <SortableHeaderRow
          columns={TRANSACTION_COLUMNS}
          sort={sort}
          sortLabels={TRANSACTION_SORT_LABELS}
          defaultDirections={DEFAULT_TRANSACTION_SORT_DIRECTIONS}
          onSort={setSortColumn}
          getNextDirection={getNextDirection}
        />
      )}
      itemContent={(_, tx) => <TransactionCells transaction={tx} nowMs={nowMs} />}
      mobileItemContent={(_, tx) => <MobileTransactionCard transaction={tx} nowMs={nowMs} />}
    />
  );
}

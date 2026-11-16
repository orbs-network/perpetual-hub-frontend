import { useCallback, useMemo } from "react";
import { Landmark } from "lucide-react";
import { TableCell } from "@/components/ui/table";
import { useFundingHistory } from "@/hooks/useFundingHistory";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { getRecentUserFundingHistory } from "@/api/history";
import type { OrderHistoryItem } from "@/types";
import { formatTimestamp } from "@/utils/formatting";
import {
  ActivityState,
  type AddressScopedHistoryTableProps,
} from "./shared";
import { SortableHeaderRow } from "./SortableHeaderRow";
import {
  compareBigInt,
  compareText,
  sortRows,
  useSortedRows,
  useTableSort,
  type SortDirection,
} from "./useSortableRows";
import {
  formatFundingPaymentAmount,
  getFundingDirectionFromAmount,
} from "./utils";
import { cn, getDisplaySymbol } from "@/lib/utils";
import { SymbolSelectorButton } from "./SymbolSelectorButton";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  MobileCardShell,
  type MobileSummaryField,
} from "./MobileSummaryRow";
import { buildTimestampedCsvFilename } from "./csvExport";

type FundingSortColumn = "time" | "coin" | "payment" | "direction";

const DEFAULT_FUNDING_SORT_DIRECTIONS: Record<
  FundingSortColumn,
  SortDirection
> = {
  time: "desc",
  coin: "asc",
  payment: "desc",
  direction: "asc",
};

const FUNDING_SORT_LABELS: Record<FundingSortColumn, string> = {
  time: "time",
  coin: "coin",
  payment: "payment",
  direction: "direction",
};

const FUNDING_COLUMNS: { column: FundingSortColumn; label: string }[] = [
  { column: "time", label: "Time" },
  { column: "coin", label: "Coin" },
  { column: "payment", label: "Payment" },
  { column: "direction", label: "Direction" },
];

const FUNDING_CELL_CLASS =
  "px-2 py-0 text-[12px] font-semibold text-content whitespace-nowrap";

function parseAmount(row: OrderHistoryItem) {
  try {
    return BigInt(row.amount || "0");
  } catch {
    return 0n;
  }
}

function directionLabel(row: OrderHistoryItem) {
  return getFundingDirectionFromAmount(row.amount) ?? row.side ?? "-";
}

function compareFundingRows(
  column: FundingSortColumn,
  left: OrderHistoryItem,
  right: OrderHistoryItem,
) {
  switch (column) {
    case "time":
      return left.timestamp - right.timestamp;
    case "coin":
      return (
        compareText(getDisplaySymbol(left.symbol), getDisplaySymbol(right.symbol)) ||
        compareText(left.symbol, right.symbol)
      );
    case "payment":
      return compareBigInt(parseAmount(left), parseAmount(right));
    case "direction":
      return compareText(directionLabel(left), directionLabel(right));
    default:
      return 0;
  }
}

function MobileFundingField({ field }: { field: MobileSummaryField }) {
  return (
    <div className={cn("min-w-0", field.className)}>
      <div className="text-[12px] leading-4 text-content-muted">
        {field.label}
      </div>
      <div
        className={cn(
          "mt-0.5 min-w-0 break-words text-[12px] font-semibold leading-[15px]",
          field.valueClassName ?? "text-content",
        )}
      >
        {field.value}
      </div>
    </div>
  );
}

export function MobileFundingCard({ row }: { row: OrderHistoryItem }) {
  const { t } = useTranslation();
  const direction = directionLabel(row);
  const isPay = direction === "PAY";
  const payment = parseAmount(row);
  const absPayment = payment < 0n ? -payment : payment;
  const paymentValue = formatFundingPaymentAmount(absPayment);
  const summaryFields: [
    MobileSummaryField,
    MobileSummaryField,
    MobileSummaryField,
  ] = [
    {
      label: t("Coin"),
      value: row.symbol ? (
        <SymbolSelectorButton
          symbol={row.symbol}
          isClose={isPay}
          className="text-[12px] font-bold leading-[15px]"
        >
          {getDisplaySymbol(row.symbol)}
        </SymbolSelectorButton>
      ) : (
        "--"
      ),
    },
    {
      label: t("Time"),
      value: formatTimestamp(row.timestamp),
    },
    {
      label: t("Payment"),
      value: paymentValue,
      valueClassName: isPay ? "text-down" : "text-up",
    },
  ];

  return (
    <MobileCardShell>
      <div className="grid min-h-[72px] grid-cols-3 items-center gap-x-4 px-3 py-2.5 text-left">
        {summaryFields.map((field, index) => (
          <MobileFundingField key={index} field={field} />
        ))}
      </div>
    </MobileCardShell>
  );
}

function FundingCells({ row }: { row: OrderHistoryItem }) {
  const direction = directionLabel(row);
  const isPay = direction === "PAY";
  const label = direction === "RECEIVE" ? "Receive" : direction === "PAY" ? "Pay" : "-";
  const payment = parseAmount(row);
  const absPayment = payment < 0n ? -payment : payment;
  return (
    <>
      <TableCell className={FUNDING_CELL_CLASS}>
        {formatTimestamp(row.timestamp)}
      </TableCell>
      <TableCell className={FUNDING_CELL_CLASS}>
        {row.symbol ? getDisplaySymbol(row.symbol) : "--"}
      </TableCell>
      <TableCell className={FUNDING_CELL_CLASS}>
        {formatFundingPaymentAmount(absPayment)}
      </TableCell>
      <TableCell className={FUNDING_CELL_CLASS}>
        <span className={isPay ? "text-down" : "text-up"}>{label}</span>
      </TableCell>
    </>
  );
}

export function FundingHistoryTable({
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
    data: funding,
    isInitialLoading,
    error,
    total,
    pageSize,
    fetchNextPage,
    hasNextPage,
    historyRowLimit,
    isFetchingNextPage,
  } = useFundingHistory(address ?? null, queryKeyScope);
  const {
    sort,
    setSortColumn,
    getNextDirection,
  } = useTableSort<FundingSortColumn>({
    initialSort: { column: "time", direction: "desc" },
    defaultDirections: DEFAULT_FUNDING_SORT_DIRECTIONS,
  });
  const sortedFunding = useSortedRows({
    rows: funding,
    sort,
    compareRows: compareFundingRows,
  });
  const fetchCsvRows = useCallback(async (signal?: AbortSignal) => {
    if (!address) return [];
    const rows = await getRecentUserFundingHistory(address, signal);
    return sortRows({
      rows,
      sort: {
        column: sort.column,
        direction: sort.direction,
      },
      compareRows: compareFundingRows,
    });
  }, [address, sort.column, sort.direction]);
  const csvExport = useMemo(
    () => ({
      filename: () =>
        buildTimestampedCsvFilename(["funding-history", address]),
      fetchRows: fetchCsvRows,
      columns: [
        { header: t("Time"), value: (row: OrderHistoryItem) => formatTimestamp(row.timestamp) },
        { header: t("Coin"), value: (row: OrderHistoryItem) => row.symbol ? getDisplaySymbol(row.symbol) : "--" },
        {
          header: t("Payment"),
          value: (row: OrderHistoryItem) => {
            const payment = parseAmount(row);
            return formatFundingPaymentAmount(payment < 0n ? -payment : payment);
          },
        },
        {
          header: t("Direction"),
          value: (row: OrderHistoryItem) => {
            const direction = directionLabel(row);
            return direction === "RECEIVE" ? t("Receive") : direction === "PAY" ? t("Pay") : "-";
          },
        },
      ],
    }),
    [address, fetchCsvRows, t],
  );

  return (
    <ActivityState
      address={address}
      icon={Landmark}
      emptyTitle="No Funding History"
      emptySubtitle="Funding Payments Will Appear Here"
      isLoading={isInitialLoading}
      isEmpty={total === 0}
      error={error}
      fillAvailableSpace={fillAvailableSpace}
      label="Funding History"
      data={sortedFunding}
      csvExport={csvExport}
      computeItemKey={(_, row) => `${row.id}-${row.timestamp}`}
      pageSize={pageSize}
      total={total}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      historyRowLimit={historyRowLimit}
      isFetchingNextPage={isFetchingNextPage}
      fixedHeaderContent={() => (
        <SortableHeaderRow
          columns={FUNDING_COLUMNS}
          sort={sort}
          sortLabels={FUNDING_SORT_LABELS}
          defaultDirections={DEFAULT_FUNDING_SORT_DIRECTIONS}
          onSort={setSortColumn}
          getNextDirection={getNextDirection}
        />
      )}
      itemContent={(_, row) => <FundingCells row={row} />}
      mobileItemContent={(_, row) => <MobileFundingCard row={row} />}
    />
  );
}

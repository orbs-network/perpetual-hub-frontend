import { useCallback, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<Column extends string> {
  column: Column;
  direction: SortDirection;
}

export type SortDirections<Column extends string> = Record<
  Column,
  SortDirection
>;

interface UseTableSortOptions<Column extends string> {
  initialSort: SortState<Column>;
  defaultDirections: SortDirections<Column>;
}

interface UseSortedRowsOptions<Row, Column extends string> {
  rows: Row[];
  sort: SortState<Column>;
  compareRows: (column: Column, left: Row, right: Row) => number;
}

const tableSortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareBigInt(left: bigint, right: bigint) {
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

export function compareText(left: string, right: string) {
  return tableSortCollator.compare(left, right);
}

export function getNextSortDirection<Column extends string>(
  sort: SortState<Column>,
  column: Column,
  defaultDirections: SortDirections<Column>,
) {
  if (sort.column !== column) return defaultDirections[column];
  return sort.direction === "desc" ? "asc" : "desc";
}

export function useTableSort<Column extends string>({
  initialSort,
  defaultDirections,
}: UseTableSortOptions<Column>) {
  const [sort, setSort] = useState<SortState<Column>>(initialSort);

  const getNextDirection = useCallback(
    (column: Column) => getNextSortDirection(sort, column, defaultDirections),
    [defaultDirections, sort],
  );

  const setSortColumn = useCallback(
    (column: Column) => {
      setSort((current) => ({
        column,
        direction: getNextSortDirection(current, column, defaultDirections),
      }));
    },
    [defaultDirections],
  );

  return {
    sort,
    setSortColumn,
    getNextDirection,
  };
}

export function sortRows<Row, Column extends string>({
  rows,
  sort,
  compareRows,
}: UseSortedRowsOptions<Row, Column>) {
  return rows
    .map((row, index) => ({ index, row }))
    .sort((left, right) => {
      const order = compareRows(sort.column, left.row, right.row);
      const directedOrder = sort.direction === "desc" ? -order : order;
      return directedOrder || left.index - right.index;
    })
    .map(({ row }) => row);
}

export function useSortedRows<Row, Column extends string>({
  rows,
  sort,
  compareRows,
}: UseSortedRowsOptions<Row, Column>) {
  const { column, direction } = sort;
  return useMemo(
    () => sortRows({ rows, sort: { column, direction }, compareRows }),
    [column, compareRows, direction, rows],
  );
}

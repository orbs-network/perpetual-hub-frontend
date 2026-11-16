import { TableRow } from "@/components/ui/table";
import { SortableColumnHead } from "./SortableColumnHead";
import { TABLE_HEADER_ROW_CLASS } from "./utils";
import type { SortDirection, SortState } from "./useSortableRows";

export interface SortableHeaderColumn<Column extends string> {
  column: Column;
  label: string;
  tooltip?: string;
}

interface SortableHeaderRowProps<Column extends string> {
  columns: SortableHeaderColumn<Column>[];
  sort: SortState<Column>;
  sortLabels: Record<Column, string>;
  defaultDirections: Record<Column, SortDirection>;
  onSort: (column: Column) => void;
  getNextDirection: (column: Column) => SortDirection;
  iconSize?: number;
}

export function SortableHeaderRow<Column extends string>({
  columns,
  sort,
  sortLabels,
  defaultDirections,
  onSort,
  getNextDirection,
  iconSize = 12,
}: SortableHeaderRowProps<Column>) {
  return (
    <TableRow className={TABLE_HEADER_ROW_CLASS}>
      {columns.map((column) => (
        <SortableColumnHead
          key={column.column}
          column={column.column}
          label={column.label}
          sort={sort}
          sortLabel={sortLabels[column.column]}
          onSort={onSort}
          defaultDirection={defaultDirections[column.column]}
          nextDirection={getNextDirection(column.column)}
          iconSize={iconSize}
          tooltip={column.tooltip}
        />
      ))}
    </TableRow>
  );
}

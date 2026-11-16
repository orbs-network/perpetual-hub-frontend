import * as React from "react";
import { useFillAvailableHeight } from "@/hooks/useFillAvailableHeight";
import { cn } from "@/lib/utils";
import {
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BottomTabsTableProps<T> {
  data: T[];
  fixedHeaderContent: () => React.ReactNode;
  itemContent: (index: number, item: T) => React.ReactNode;
  computeItemKey?: (index: number, item: T) => React.Key;
  className?: string;
  tableClassName?: string;
  rowClassName?: string | ((index: number, item: T) => string | undefined);
  emptyContent?: React.ReactNode;
  fillAvailableSpace?: boolean;
  footerContent?: React.ReactNode;
  maxHeight?: number;
  estimatedRowHeight?: number;
}

export function BottomTabsTable<T>({
  data,
  fixedHeaderContent,
  itemContent,
  computeItemKey,
  className,
  tableClassName,
  rowClassName,
  emptyContent,
  fillAvailableSpace = false,
  footerContent,
  maxHeight,
}: BottomTabsTableProps<T>) {
  const fillHeightProperty = "--bottom-tabs-table-fill-height";
  const tableRef = useFillAvailableHeight<HTMLDivElement>({
    cssProperty: fillHeightProperty,
    enabled: fillAvailableSpace,
  });
  const height = fillAvailableSpace
    ? `var(${fillHeightProperty})`
    : maxHeight ?? "calc(100% - 5px)";
  const style = {
    height,
    ...(fillAvailableSpace ? { [fillHeightProperty]: "100%" } : {}),
  } as React.CSSProperties;

  const getItemKey = (index: number, item: T) =>
    computeItemKey?.(index, item) ?? index;

  return (
    <div
      ref={tableRef}
      className={cn(
        "mt-[5px] flex min-h-0 w-full flex-col positions-table",
        fillAvailableSpace && "max-h-[var(--bottom-tabs-table-fill-height)] flex-none",
        className,
      )}
      data-bottom-tabs-table="true"
      style={style}
    >
      <div
        className="page-scrollbar min-h-0 flex-1 overflow-auto"
        data-bottom-tabs-table-scroll="true"
      >
        <table
          className={cn(
            "w-full caption-bottom table-auto border-separate border-spacing-0 text-[11px] tabular-nums [&_tbody_td]:h-[30px] [&_tbody_td]:py-0 [&_tbody_tr]:h-[30px] [&_thead_th]:m-0 [&_thead_th]:py-0 [&_thead_tr]:h-[30px]",
            tableClassName,
          )}
        >
          <TableHeader>{fixedHeaderContent()}</TableHeader>
          <TableBody>
            {data.map((item, index) => {
              const key = getItemKey(index, item);

              return (
                <TableRow
                  key={key}
                  className={cn(
                    "h-[30px]",
                    typeof rowClassName === "function"
                      ? rowClassName(index, item)
                      : rowClassName,
                  )}
                >
                  {itemContent(index, item)}
                </TableRow>
              );
            })}
          </TableBody>
        </table>
        {emptyContent}
      </div>
      {footerContent}
    </div>
  );
}

import {
  Children,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CsvExportButton } from "@/components/CsvExportButton";
import type { ResolvedCsvExportConfig } from "@/components/bottom-tabs/csvExport";
import { Skeleton } from "@/components/ui/skeleton";
import { useFillAvailableHeight } from "@/hooks/useFillAvailableHeight";
import { cn } from "@/lib/utils";

export type DashboardDataTableColumn = {
  cellClassName?: string;
  headerClassName?: string;
  key: string;
  label: ReactNode;
};

export type DashboardDataTablePagination = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLoading?: boolean;
  isVisible?: boolean;
  label: ReactNode;
  nextLabel: string;
  onNextPage: () => void;
  onPreviousPage: () => void;
  previousLabel: string;
};

type DashboardDataTableProps<T> = {
  bodyClassName?: string;
  bodyTestId?: string;
  className?: string;
  columns: DashboardDataTableColumn[];
  columnTemplate?: string;
  csvExport?: ResolvedCsvExportConfig<T>;
  emptyContent?: ReactNode;
  fillAvailableSpace?: boolean;
  headerAction?: ReactNode;
  isLoading?: boolean;
  loadingContent?: ReactNode;
  minWidth?: number;
  pagination?: DashboardDataTablePagination;
  panelTestId?: string;
  rows: ReactNode;
  title?: ReactNode;
  titleClassName?: string;
  viewportClassName?: string;
};

const BASE_CELL_CLASS_NAME =
  "flex min-w-0 items-center justify-start px-3 py-3 text-left";
const TABLE_COLUMN_TEMPLATE_VAR = "--dashboard-table-column-template";
const TABLE_FILL_HEIGHT_VAR = "--dashboard-table-fill-height";
const TABLE_ROW_STYLE = {
  gridTemplateColumns: `var(${TABLE_COLUMN_TEMPLATE_VAR})`,
} satisfies CSSProperties;

type DashboardDataTableStyle = CSSProperties & {
  "--dashboard-table-fill-height"?: string;
};

type DashboardDataTableScrollContentStyle = CSSProperties & {
  [TABLE_COLUMN_TEMPLATE_VAR]?: string;
};

export type DashboardDataTableCellProps = ComponentPropsWithoutRef<"div">;

export function DashboardDataTableCell({
  className,
  ...props
}: DashboardDataTableCellProps) {
  return (
    <div
      className={cn(
        BASE_CELL_CLASS_NAME,
        "text-[12px] text-content-secondary",
        className,
      )}
      {...props}
    />
  );
}

export type DashboardDataTableRowProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "onClick"
> & {
  onClick?: () => void;
};

export function DashboardDataTableRow({
  children,
  className,
  onClick,
  onKeyDown,
  role,
  style,
  tabIndex,
  ...props
}: DashboardDataTableRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !onClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick();
  };
  const isInteractive = Boolean(onClick);

  return (
    <div
      className={cn(
        "grid border-b border-edge-subtle last:border-b-0",
        isInteractive &&
          "cursor-pointer transition-colors hover:bg-hover/35 focus-visible:bg-hover/35 focus-visible:outline-none",
        className,
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={role ?? (isInteractive ? "button" : undefined)}
      style={{ ...TABLE_ROW_STYLE, ...style }}
      tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DashboardDataTable<T = unknown>({
  bodyClassName,
  bodyTestId,
  className,
  columns,
  columnTemplate,
  csvExport,
  emptyContent,
  fillAvailableSpace = true,
  headerAction,
  isLoading = false,
  loadingContent,
  minWidth,
  pagination,
  panelTestId,
  rows,
  title,
  titleClassName,
  viewportClassName,
}: DashboardDataTableProps<T>) {
  const tablePanelRef = useFillAvailableHeight<HTMLElement>({
    cssProperty: TABLE_FILL_HEIGHT_VAR,
    enabled: fillAvailableSpace,
  });
  const gridTemplateColumns =
    columnTemplate ?? `repeat(${columns.length}, minmax(120px, 1fr))`;
  const tableMinWidth = minWidth ?? Math.max(760, columns.length * 128);
  const panelStyle: DashboardDataTableStyle | undefined = fillAvailableSpace
    ? { "--dashboard-table-fill-height": "100%" }
    : undefined;
  const scrollContentStyle: DashboardDataTableScrollContentStyle = {
    [TABLE_COLUMN_TEMPLATE_VAR]: gridTemplateColumns,
    minWidth: tableMinWidth,
  };
  const rowCount = Children.count(rows);
  const shouldShowPagination = Boolean(
    pagination && pagination.isVisible !== false,
  );
  const shouldShowFooter = shouldShowPagination || Boolean(csvExport);

  return (
    <section
      ref={tablePanelRef}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-[8px] border border-edge bg-surface shadow-card",
        fillAvailableSpace
          ? "h-[var(--dashboard-table-fill-height)] max-h-[var(--dashboard-table-fill-height)] min-h-0 flex-none overscroll-contain"
          : "h-full min-h-[600px]",
        className,
      )}
      data-dashboard-table="true"
      data-testid={panelTestId}
      style={panelStyle}
    >
      {title ? (
        <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-edge px-3 py-1">
          <div
            className={cn(
              "flex h-10 min-w-0 items-center px-1 text-[12px] font-medium text-content",
              titleClassName,
            )}
          >
            {title}
          </div>
          {headerAction}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          viewportClassName,
        )}
        data-dashboard-table-viewport="true"
      >
        <div
          className={cn(
            "page-scrollbar min-h-0 h-full flex-1 overflow-x-auto overflow-y-auto overscroll-contain text-[12px] text-content [touch-action:pan-x_pan-y]",
            bodyClassName,
          )}
          data-dashboard-table-body="true"
          data-testid={bodyTestId}
        >
          <div
            className="flex min-h-full flex-col"
            data-dashboard-table-scroll-content="true"
            style={scrollContentStyle}
          >
            <div
              className="sticky top-0 z-10 grid shrink-0 border-b border-edge/80 bg-raised text-left"
              data-dashboard-table-header="true"
              style={TABLE_ROW_STYLE}
            >
              {columns.map((column) => (
                <div
                  className={cn(
                    BASE_CELL_CLASS_NAME,
                    "text-[10px] font-semibold uppercase tracking-[0.08em] text-content-muted",
                    column.headerClassName,
                  )}
                  key={column.key}
                >
                  {column.label}
                </div>
              ))}
            </div>
            {isLoading && loadingContent
              ? loadingContent
              : rowCount
                ? rows
                : emptyContent}
          </div>
        </div>
      </div>

      {shouldShowFooter ? (
        <div className="mt-auto flex h-11 shrink-0 items-center justify-between gap-5 border-t border-edge-subtle bg-surface/70 px-3 text-[12px] font-medium text-content-secondary">
          {csvExport ? (
            <CsvExportButton
              config={csvExport}
              disabled={isLoading || rowCount === 0}
            />
          ) : (
            <div />
          )}
          {shouldShowPagination && pagination ? (
            <div className="flex items-center gap-5">
              {pagination.isLoading ? (
                <Skeleton className="h-3 w-16 bg-content-muted/15" />
              ) : (
                <span>{pagination.label}</span>
              )}
              <button
                aria-label={pagination.previousLabel}
                className="text-content-muted disabled:opacity-50"
                disabled={pagination.isLoading || !pagination.canGoPrevious}
                onClick={pagination.onPreviousPage}
                type="button"
              >
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <button
                aria-label={pagination.nextLabel}
                className="text-content-muted disabled:opacity-50"
                disabled={pagination.isLoading || !pagination.canGoNext}
                onClick={pagination.onNextPage}
                type="button"
              >
                <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

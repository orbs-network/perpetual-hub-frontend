import { useCallback, useMemo, useReducer, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePortfolioAddress } from "@/hooks/usePortfolioAddress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ChevronsDown, ChevronsUp } from "lucide-react";
import { BottomTabsTable } from "./BottomTabsTable";
import { BottomTabsPagination } from "./BottomTabsPagination";
import { MobileCardList } from "./MobileCardList";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { resolveCsvFilename } from "./csvExport";
import type { CsvExportConfig } from "./csvExport";
import { isPartnerApprovalPending } from "@/config/partners/availability";

export function AuthPrompt({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  const { t } = useTranslation();
  const { isConnected, isAuthenticated } = useAuth();

  if (!isConnected || !isAuthenticated) {
    const translatedLabel = t(label);
    return (
      <div className="flex flex-row items-center justify-center text-content-muted gap-2 text-[11px]">
        <Icon size={24} className="text-content-muted/30" />
        {isPartnerApprovalPending() ? t("Trading is not available yet.") : !isConnected
          ? `${t("Connect wallet to view")} ${translatedLabel}`
          : `${t("Sign in to view")} ${translatedLabel}`}
      </div>
    );
  }

  return null;
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-start pt-2 text-content-muted md:pt-[50px]">
      <span className="text-[13px]">{t(title)}</span>
      <span className="text-[12px] text-content-muted/50 mt-0.5">
        {t(subtitle)}
      </span>
    </div>
  );
}

export interface ActivityPaginationProps {
  pageSize: number;
  total: number;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage: () => Promise<unknown> | unknown;
}

export interface MobileItemExpansionState {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export interface MobileExpansionLabels {
  expand: string;
  collapse: string;
}

export interface AddressScopedHistoryTableProps {
  address?: string | null;
  fillAvailableSpace?: boolean;
  queryKeyScope?: string;
}

interface MobileExpansionState {
  expandedKeys: Set<string>;
  expandNewItems: boolean;
  bulkExpanded: boolean;
}

type MobileExpansionAction =
  | {
      type: "set-item";
      key: string;
      expanded: boolean;
      visibleKeys: string[];
    }
  | {
      type: "set-all";
      expanded: boolean;
      visibleKeys: string[];
    };

function createMobileExpansionState(): MobileExpansionState {
  return {
    expandedKeys: new Set(),
    expandNewItems: false,
    bulkExpanded: false,
  };
}

function resolveBulkExpandedState(
  currentBulkExpanded: boolean,
  expandedKeys: Set<string>,
  visibleKeys: string[],
) {
  if (visibleKeys.length === 0) return currentBulkExpanded;
  if (visibleKeys.every((key) => expandedKeys.has(key))) return true;
  if (visibleKeys.every((key) => !expandedKeys.has(key))) return false;
  return currentBulkExpanded;
}

function mobileExpansionReducer(
  state: MobileExpansionState,
  action: MobileExpansionAction,
): MobileExpansionState {
  const nextKeys = state.expandNewItems
    ? new Set(action.visibleKeys)
    : new Set(state.expandedKeys);

  if (action.type === "set-all") {
    for (const key of action.visibleKeys) {
      if (action.expanded) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }
    }

    return {
      expandedKeys: nextKeys,
      expandNewItems: action.expanded,
      bulkExpanded: action.expanded,
    };
  }

  if (action.expanded) {
    nextKeys.add(action.key);
  } else {
    nextKeys.delete(action.key);
  }

  return {
    expandedKeys: nextKeys,
    expandNewItems: false,
    bulkExpanded: resolveBulkExpandedState(
      state.bulkExpanded,
      nextKeys,
      action.visibleKeys,
    ),
  };
}

interface ActivityStateProps<T> {
  address?: string | null;
  icon: React.ElementType;
  emptyTitle: string;
  emptySubtitle: string;
  label?: string;
  isLoading: boolean;
  isEmpty: boolean;
  error: string | null;
  fillAvailableSpace?: boolean;

  // Data
  data: T[];
  computeItemKey?: (index: number, item: T) => React.Key;
  csvExport?: CsvExportConfig<T>;
  pageSize?: number;
  total?: number;
  historyRowLimit?: number;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => Promise<unknown> | unknown;

  // Desktop table
  fixedHeaderContent: () => React.ReactNode;
  itemContent: (index: number, item: T) => React.ReactNode;
  estimatedRowHeight?: number;
  rowClassName?: string;

  // Mobile cards
  mobileItemContent: (
    index: number,
    item: T,
    expansion?: MobileItemExpansionState,
  ) => React.ReactNode;
  mobileExpansionLabels?: MobileExpansionLabels;

  // Extra content rendered after the list.
  footer?: React.ReactNode;

  // Keep the desktop table header visible when there are no rows.
  showTableHeaderWhenEmpty?: boolean;
}

export function ActivityState<T>({
  address: addressOverride,
  emptyTitle,
  emptySubtitle,
  label,
  isLoading,
  isEmpty,
  error,
  fillAvailableSpace = false,
  data,
  computeItemKey,
  csvExport,
  pageSize,
  total,
  historyRowLimit,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  fixedHeaderContent,
  itemContent,
  estimatedRowHeight,
  rowClassName,
  mobileItemContent,
  mobileExpansionLabels,
  footer,
  showTableHeaderWhenEmpty = false,
}: ActivityStateProps<T>) {
  const portfolioAddress = usePortfolioAddress();
  const address = addressOverride === undefined
    ? portfolioAddress
    : addressOverride;
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const historyLimited = historyRowLimit !== undefined && (total ?? 0) > historyRowLimit;
  const historyNotice = historyLimited ? (
    <p role="status" className="px-3 py-2 text-xs text-content-secondary">
      {t("Browsing and CSV exports include only the latest {{limit}} records. Older records are not included.", { limit: historyRowLimit.toLocaleString() })}
    </p>
  ) : null;
  const resolvedFooter = footer ?? null;
  const boundedCsvExport = csvExport && historyRowLimit !== undefined ? {
    ...csvExport,
    filename: () => resolveCsvFilename(csvExport.filename).replace(/\.csv$/, `_latest-${historyRowLimit}.csv`),
  } : csvExport;

  if (!address) {
    return <ConnectWalletState label={label ?? emptyTitle} />;
  }
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  if (isMobile) {
    return (
      <>
        {historyNotice}
        {isEmpty ? (
          <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
        ) : (
          <MobileActivityState
            data={data}
            computeItemKey={computeItemKey}
            mobileItemContent={mobileItemContent}
            mobileExpansionLabels={mobileExpansionLabels}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
          />
        )}
        {resolvedFooter}
      </>
    );
  }

  const hasPagination = Boolean(fetchNextPage);
  if (isEmpty && !showTableHeaderWhenEmpty && !hasPagination) {
    return (
      <>
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
        {resolvedFooter}
      </>
    );
  }

  return (
    <>
      {historyNotice}
      <DesktopActivityState
        emptyTitle={emptyTitle}
        emptySubtitle={emptySubtitle}
        isEmpty={isEmpty}
        data={data}
        computeItemKey={computeItemKey}
        csvExport={boundedCsvExport}
        fillAvailableSpace={fillAvailableSpace}
        pageSize={pageSize}
        total={historyRowLimit === undefined ? total : Math.min(total ?? data.length, historyRowLimit)}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        fixedHeaderContent={fixedHeaderContent}
        itemContent={itemContent}
        estimatedRowHeight={estimatedRowHeight}
        rowClassName={rowClassName}
        showTableHeaderWhenEmpty={showTableHeaderWhenEmpty}
      />
      {resolvedFooter}
    </>
  );
}

interface MobileActivityStateProps<T> {
  data: T[];
  computeItemKey?: (index: number, item: T) => React.Key;
  mobileItemContent: (
    index: number,
    item: T,
    expansion?: MobileItemExpansionState,
  ) => React.ReactNode;
  mobileExpansionLabels?: MobileExpansionLabels;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => Promise<unknown> | unknown;
}

function MobileActivityState<T>({
  data,
  computeItemKey,
  mobileItemContent,
  mobileExpansionLabels,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: MobileActivityStateProps<T>) {
  const [mobileExpansionState, dispatchMobileExpansion] = useReducer(
    mobileExpansionReducer,
    undefined,
    createMobileExpansionState,
  );
  const getMobileExpansionKey = useCallback(
    (index: number, item: T) => String(computeItemKey?.(index, item) ?? index),
    [computeItemKey],
  );
  const mobileExpansionKeys = useMemo(
    () => data.map((item, index) => getMobileExpansionKey(index, item)),
    [data, getMobileExpansionKey],
  );
  const isMobileKeyExpanded = useCallback(
    (key: string) =>
      mobileExpansionState.expandNewItems ||
      mobileExpansionState.expandedKeys.has(key),
    [mobileExpansionState.expandNewItems, mobileExpansionState.expandedKeys],
  );
  const isMobileItemExpanded = useCallback(
    (index: number) => isMobileKeyExpanded(mobileExpansionKeys[index] ?? ""),
    [isMobileKeyExpanded, mobileExpansionKeys],
  );
  const mobileExpansionEnabled = Boolean(
    mobileExpansionLabels && data.length > 0,
  );
  const areAllMobileItemsExpanded = useMemo(
    () => Boolean(
      mobileExpansionEnabled &&
        mobileExpansionKeys.every((key) => isMobileKeyExpanded(key)),
    ),
    [isMobileKeyExpanded, mobileExpansionEnabled, mobileExpansionKeys],
  );
  const areAllMobileItemsCollapsed = useMemo(
    () => Boolean(
      mobileExpansionEnabled &&
        mobileExpansionKeys.every((key) => !isMobileKeyExpanded(key)),
    ),
    [isMobileKeyExpanded, mobileExpansionEnabled, mobileExpansionKeys],
  );
  const mobileBulkButtonExpanded = areAllMobileItemsExpanded
    ? true
    : areAllMobileItemsCollapsed
      ? false
      : mobileExpansionState.bulkExpanded;
  const fetchNextPageIfNeeded = useCallback(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <MobileCardList
      data={data}
      computeItemKey={computeItemKey}
      itemContent={(index, item) => {
        if (!mobileExpansionLabels) {
          return mobileItemContent(index, item);
        }

        const key = mobileExpansionKeys[index] ?? "";
        return mobileItemContent(index, item, {
          expanded: isMobileItemExpanded(index),
          setExpanded: (expanded) => {
            dispatchMobileExpansion({
              type: "set-item",
              key,
              expanded,
              visibleKeys: mobileExpansionKeys,
            });
          },
        });
      }}
      header={
        mobileExpansionEnabled && mobileExpansionLabels ? (
          <MobileExpandAllButton
            expanded={mobileBulkButtonExpanded}
            labels={mobileExpansionLabels}
            onClick={() => {
              const nextExpanded = !mobileBulkButtonExpanded;
              dispatchMobileExpansion({
                type: "set-all",
                expanded: nextExpanded,
                visibleKeys: mobileExpansionKeys,
              });
            }}
          />
        ) : null
      }
      hasMore={Boolean(fetchNextPage && hasNextPage)}
      isLoadingMore={Boolean(fetchNextPage && isFetchingNextPage)}
      onEndReached={fetchNextPage ? fetchNextPageIfNeeded : undefined}
    />
  );
}

interface DesktopActivityStateProps<T> {
  emptyTitle: string;
  emptySubtitle: string;
  isEmpty: boolean;
  data: T[];
  computeItemKey?: (index: number, item: T) => React.Key;
  csvExport?: CsvExportConfig<T>;
  fillAvailableSpace?: boolean;
  pageSize?: number;
  total?: number;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => Promise<unknown> | unknown;
  fixedHeaderContent: () => React.ReactNode;
  itemContent: (index: number, item: T) => React.ReactNode;
  estimatedRowHeight?: number;
  rowClassName?: string;
  showTableHeaderWhenEmpty?: boolean;
}

function DesktopActivityState<T>({
  emptyTitle,
  emptySubtitle,
  isEmpty,
  data,
  computeItemKey,
  csvExport,
  fillAvailableSpace = false,
  pageSize,
  total,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  fixedHeaderContent,
  itemContent,
  estimatedRowHeight,
  rowClassName,
  showTableHeaderWhenEmpty = false,
}: DesktopActivityStateProps<T>) {
  const [page, setPage] = useState(0);
  const hasPagination = Boolean(fetchNextPage);
  const paginationPageSize = Math.max(1, pageSize ?? (data.length || 1));
  const paginationTotal = total ?? data.length;
  const totalPages = Math.max(
    1,
    Math.ceil(paginationTotal / paginationPageSize),
  );
  const visiblePage = hasPagination ? Math.min(page, totalPages - 1) : 0;
  const pageStart = hasPagination ? visiblePage * paginationPageSize : 0;
  const pageEnd = pageStart + paginationPageSize;
  // Desktop pagination slices the loaded infinite-query rows. If the target
  // slice has not arrived yet, we request the next backend page and show rows
  // only after that page is available.
  const pageData = useMemo(
    () => (hasPagination ? data.slice(pageStart, pageEnd) : data),
    [data, hasPagination, pageEnd, pageStart],
  );
  const isPageMissing = Boolean(
    hasPagination && pageStart < paginationTotal && pageData.length === 0,
  );
  const isPageLoading = Boolean(
    isPageMissing && (isFetchingNextPage || hasNextPage),
  );
  const visibleData = useMemo(
    () => (isPageLoading ? [] : pageData),
    [isPageLoading, pageData],
  );
  const resolvedCsvExport = useMemo(
    () => csvExport ? { ...csvExport, rows: data } : undefined,
    [csvExport, data],
  );
  const fetchNextPageIfNeeded = useCallback(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const paginationControls = useMemo(() => {
    if (!hasPagination && !resolvedCsvExport) return null;

    return (
      <BottomTabsPagination
        pagination={{
          page: hasPagination ? visiblePage : 0,
          pageSize: paginationPageSize,
          total: paginationTotal,
          canPreviousPage: hasPagination && visiblePage > 0,
          canNextPage: hasPagination && visiblePage + 1 < totalPages,
          isPageLoading,
          onPreviousPage: () => setPage(Math.max(0, visiblePage - 1)),
          onNextPage: () => {
            const nextPage = Math.min(visiblePage + 1, totalPages - 1);
            if (nextPage === visiblePage) return;

            setPage(nextPage);

            const nextPageStart = nextPage * paginationPageSize;
            const nextPageHasRows =
              data.slice(nextPageStart, nextPageStart + paginationPageSize)
                .length > 0;
            if (!nextPageHasRows && nextPageStart < paginationTotal) {
              fetchNextPageIfNeeded();
            }
          },
        }}
        csvExport={resolvedCsvExport}
      />
    );
  }, [
    data,
    fetchNextPageIfNeeded,
    hasPagination,
    isPageLoading,
    paginationPageSize,
    paginationTotal,
    resolvedCsvExport,
    totalPages,
    visiblePage,
  ]);
  const shouldKeepEmptyTable =
    isEmpty && (showTableHeaderWhenEmpty || hasPagination);
  const emptyTableContent =
    isPageLoading ? (
      <LoadingSpinner />
    ) : shouldKeepEmptyTable && visibleData.length === 0 ? (
      <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
    ) : null;

  return (
    <BottomTabsTable<T>
      data={visibleData}
      computeItemKey={computeItemKey}
      fixedHeaderContent={fixedHeaderContent}
      itemContent={itemContent}
      estimatedRowHeight={estimatedRowHeight}
      fillAvailableSpace={fillAvailableSpace}
      rowClassName={rowClassName}
      emptyContent={emptyTableContent}
      footerContent={paginationControls}
    />
  );
}

function MobileExpandAllButton({
  expanded,
  labels,
  onClick,
}: {
  expanded: boolean;
  labels: MobileExpansionLabels;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const Icon = expanded ? ChevronsUp : ChevronsDown;
  const label = expanded ? labels.collapse : labels.expand;

  return (
    <button
      type="button"
      aria-pressed={expanded}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded border border-edge bg-base px-2.5 text-[11px] font-semibold text-content-secondary transition-colors hover:border-content-muted/50 hover:text-content"
    >
      <Icon size={15} strokeWidth={2} />
      {t(label)}
    </button>
  );
}

export const ConnectWalletState = ({ label }: { label: string }) => {
  return (
    <div className="mt-2 md:mt-8">
      <AuthPrompt icon={BarChart3} label={label} />
    </div>
  );
};

export function LoadingSpinner() {
  return (
    <div className="overflow-hidden pt-2">
      <TableSkeletonRows rows={8} />
    </div>
  );
}

function TableSkeletonRows({
  rows,
  className,
}: {
  rows: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr_1fr] gap-3 px-2 py-2"
        >
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3 justify-self-end" />
          <Skeleton className="h-3 w-1/2 justify-self-end" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-content-muted">
      <span className="text-[11px] text-down">{message}</span>
    </div>
  );
}

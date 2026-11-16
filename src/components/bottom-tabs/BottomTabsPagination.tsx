import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { CsvExportButton } from "@/components/CsvExportButton";
import type { ResolvedCsvExportConfig } from "./csvExport";

export interface ResolvedBottomTabsPaginationState {
  page: number;
  pageSize: number;
  total: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  isPageLoading?: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

interface BottomTabsPaginationProps<T> {
  pagination: ResolvedBottomTabsPaginationState;
  csvExport?: ResolvedCsvExportConfig<T>;
}

export function BottomTabsPagination<T>({
  pagination,
  csvExport,
}: BottomTabsPaginationProps<T>) {
  const { t } = useTranslation();
  const start = pagination.total === 0
    ? 0
    : pagination.page * pagination.pageSize + 1;
  const end = Math.min(
    (pagination.page + 1) * pagination.pageSize,
    pagination.total,
  );
  return (
    <div className="flex h-11 w-full shrink-0 items-center justify-between border-t border-edge/60 bg-surface px-2 text-[12px]">
      {csvExport ? (
        <CsvExportButton
          config={csvExport}
          disabled={pagination.total === 0 || pagination.isPageLoading}
        />
      ) : (
        <div />
      )}

      <div className="flex h-full items-center justify-center">
        <span className="px-3 font-semibold text-content">
          {start}-{end} {t("of")} {pagination.total}
        </span>
        <button
          type="button"
          aria-label={t("Prev")}
          onClick={pagination.onPreviousPage}
          disabled={!pagination.canPreviousPage || pagination.isPageLoading}
          className="flex h-full w-8 items-center justify-center bg-transparent text-content transition-colors hover:text-content-secondary disabled:cursor-not-allowed disabled:text-content-muted/35 disabled:hover:text-content-muted/35"
        >
          <ChevronLeft size={17} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label={t("Next")}
          onClick={pagination.onNextPage}
          disabled={!pagination.canNextPage || pagination.isPageLoading}
          className="flex h-full w-8 items-center justify-center bg-transparent text-content transition-colors hover:text-content-secondary disabled:cursor-not-allowed disabled:text-content-muted/35 disabled:hover:text-content-muted/35"
        >
          <ChevronRight size={17} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

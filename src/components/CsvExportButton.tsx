import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  downloadCsv,
  type ResolvedCsvExportConfig,
} from "@/components/bottom-tabs/csvExport";

export function CsvExportButton<T>({
  config,
  disabled = false,
}: {
  config: ResolvedCsvExportConfig<T>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const abortControllerRef = useRef<AbortController | null>(null);
  const canExport = !disabled && config.rows.length > 0;
  const { isPending, mutate: exportCsv } = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;
      try {
        const rows = config.fetchRows
          ? await config.fetchRows(controller.signal)
          : config.rows;
        if (!downloadCsv({ ...config, rows })) {
          throw new Error(t("No data to export"));
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    onMutate: () => toast.loading(t("Preparing CSV export")),
    onSuccess: (_data, _variables, toastId) => {
      toast.success(t("CSV export downloaded"), {
        id: toastId,
        duration: 3000,
      });
    },
    onError: (_error: unknown, _variables, toastId) => {
      toast.error(t("CSV export failed"), {
        id: toastId,
        duration: 5000,
      });
    },
  });
  useEffect(
    () => () => abortControllerRef.current?.abort(),
    [],
  );
  const handleCsvExport = useCallback(() => {
    if (!canExport || isPending) return;
    exportCsv();
  }, [canExport, exportCsv, isPending]);

  return (
    <Button
      aria-label={t("Export as CSV")}
      className="h-6 items-center px-1.5 py-0 text-[11px] font-semibold leading-none text-content-secondary hover:bg-transparent hover:text-content [&_svg]:block"
      disabled={!canExport || isPending}
      loading={isPending}
      onClick={handleCsvExport}
      size="xs"
      type="button"
      variant="ghost"
    >
      {isPending ? null : <Download size={13} strokeWidth={2} />}
      {t("Export as CSV")}
    </Button>
  );
}

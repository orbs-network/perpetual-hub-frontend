import { partner } from "@/config/partners";
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getRollupDetail, type RollupDetailResponse } from '../api/explorer';
import type { OperationItem } from '../types';
import {
  OperationRow,
  StatusBadge,
} from '@/components/explorer/shared';
import { formatExplorerTimestamp } from '@/components/explorer/utils';
import { useTranslation } from "@/hooks/useSafeTranslation";
import { appRoutes } from "@/routes";
import { PageHeader } from "@/components/PageHeader";

export function RollupDetailPage() {
  const { t } = useTranslation();
  const { rollupId } = useParams<{ rollupId: string }>();
  const [result, setResult] = useState<RollupDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!rollupId) return;
    try {
      setError(null);
      const data = await getRollupDetail(Number(rollupId));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rollup details');
    } finally {
      setLoading(false);
    }
  }, [rollupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rollup = result?.rollup;
  const operations: OperationItem[] = result?.operations ?? [];

  return (
    <div className="rollup-page min-h-screen">
      <header className="bg-surface px-4 pt-3">
        <PageHeader
          breadcrumbItems={[
            { label: partner.name, href: appRoutes.home() },
            { label: t("Explorer"), href: appRoutes.explorer() },
            { label: `${t("Rollup #")}${rollupId ?? ""}` },
          ]}
          title={`${t("Rollup #")}${rollupId ?? ""}`}
        />
      </header>

      {/* Main content */}
      <main className="p-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-short/10 border border-short/30 rounded-lg">
            <p className="text-sm text-down">{error}</p>
          </div>
        )}

        {loading && !result && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full" />
          </div>
        )}

        {rollup && (
          <>
            {/* Rollup Header Card */}
            <div className="border border-edge rounded-lg overflow-hidden mb-6">
              <div className="px-4 py-3 bg-surface border-b border-edge flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-primary" />
                  <span className="text-sm font-medium text-content">
                    {t("Rollup Details")}</span>
                </div>
                <StatusBadge status={rollup.status} />
              </div>

              <div className="p-4 space-y-4">
                {/* State Transition Visual */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] uppercase text-content-muted mb-1">{t("Old State Root")}</div>
                    <div className="px-3 py-2 bg-surface rounded  text-[11px] text-content-secondary break-all">
                      {rollup.oldStateRoot}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 pt-4">
                    <svg className="w-6 h-6 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="text-[9px] text-content-muted">{rollup.operationsCount} {t("ops")}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase text-content-muted mb-1">{t("New State Root")}</div>
                    <div className="px-3 py-2 bg-up/5 border border-up/20 rounded  text-[11px] text-up break-all">
                      {rollup.newStateRoot}
                    </div>
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div>
                    <div className="text-[10px] uppercase text-content-muted mb-1">{t("Tx Hash")}</div>
                    <div className=" text-xs text-accent-primary break-all">
                      {rollup.txHash || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-content-muted mb-1">{t("Block Number")}</div>
                    <div className=" text-xs text-content-secondary">
                      {rollup.blockNumber || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-content-muted mb-1">{t("Sequence Range")}</div>
                    <div className=" text-xs text-accent-secondary">
                      {rollup.oldSequence} - {rollup.newSequence}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-content-muted mb-1">{t("Submitted At")}</div>
                    <div className="text-xs text-content-secondary">
                      {formatExplorerTimestamp(rollup.submittedAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operations Table */}
            <div className="border border-edge rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-surface border-b border-edge flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-secondary" />
                <span className="text-sm font-medium text-content">
                  {t("Operations (")}{operations.length})
                </span>
              </div>

              {operations.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="text-sm text-content-muted">{t("No Operations In This Rollup")}</span>
                </div>
              ) : (
                <div className="page-scrollbar overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-content-muted text-left border-b border-edge bg-surface/30">
                        <th className="px-4 py-3 font-medium">{t("Seq #")}</th>
                        <th className="px-4 py-3 font-medium">{t("Type")}</th>
                        <th className="px-4 py-3 font-medium">{t("User")}</th>
                        <th className="px-4 py-3 font-medium">{t("Symbol")}</th>
                        <th className="px-4 py-3 font-medium">{t("Side")}</th>
                        <th className="px-4 py-3 font-medium">{t("Qty")}</th>
                        <th className="px-4 py-3 font-medium">{t("Price")}</th>
                        <th className="px-4 py-3 font-medium">{t("Fee")}</th>
                        <th className="px-4 py-3 font-medium">PnL</th>
                        <th className="px-4 py-3 font-medium">{t("Status")}</th>
                        <th className="px-4 py-3 font-medium">{t("State Root")}</th>
                        <th className="px-4 py-3 font-medium">{t("Time")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.map((op) => (
                        <OperationRow key={op.id} operation={op} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

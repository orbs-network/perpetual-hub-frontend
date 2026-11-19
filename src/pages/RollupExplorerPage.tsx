import { partner } from "@/config/partners";
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRollups, type RollupListResponse } from '../api/explorer';
import {
  ExplorerPagination,
  HashTransition,
  StatusBadge,
} from '@/components/explorer/shared';
import { formatExplorerTimestamp, truncateHash } from '@/components/explorer/utils';
import { useTranslation } from "@/hooks/useSafeTranslation";
import { appRoutes } from "@/routes";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";

export function RollupExplorerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [result, setResult] = useState<RollupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await getRollups(limit, offset);
      setResult(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rollups');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const stats = result?.stats;
  const rollups = result?.rollups ?? [];
  const total = result?.total ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="rollup-page min-h-screen">
      <header className="bg-surface px-4 pt-3">
        <PageHeader
          breadcrumbItems={[
            { label: partner.name, href: appRoutes.home() },
            { label: t("Rollup Explorer") },
          ]}
          title={t("Rollup Explorer")}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <Switch
                  aria-label={t("Auto-Refresh")}
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  className="data-[state=unchecked]:bg-input-bg data-[state=checked]:bg-long data-[state=checked]:hover:bg-long-hover"
                  thumbClassName="data-[state=checked]:bg-content-on-long"
                />
                <span className="text-xs text-content-secondary">{t("Auto-Refresh")}</span>
              </label>

              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-edge bg-input-bg px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-raised disabled:opacity-50"
              >
                <svg
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {t("Refresh")}
              </button>

              {lastRefresh && (
                <span className="text-[10px] text-content-muted">
                  {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          }
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

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border border-edge rounded-lg p-4 bg-surface/50">
              <div className="text-[10px] uppercase text-content-muted mb-1">{t("Total Rollups")}</div>
              <div className="text-xl font-bold  text-content">
                {stats.totalRollups.toLocaleString()}
              </div>
            </div>
            <div className="border border-edge rounded-lg p-4 bg-surface/50">
              <div className="text-[10px] uppercase text-content-muted mb-1">{t("Total Operations")}</div>
              <div className="text-xl font-bold  text-accent-primary">
                {stats.totalOps.toLocaleString()}
              </div>
            </div>
            <div className="border border-edge rounded-lg p-4 bg-surface/50">
              <div className="text-[10px] uppercase text-content-muted mb-1">{t("Latest Sequence")}</div>
              <div className="text-xl font-bold  text-accent-secondary">
                #{stats.latestSequence.toLocaleString()}
              </div>
            </div>
            <div className="border border-edge rounded-lg p-4 bg-surface/50">
              <div className="text-[10px] uppercase text-content-muted mb-1">{t("Avg Ops / Rollup")}</div>
              <div className="text-xl font-bold  text-up">
                {Number(stats.avgOpsPerRollup).toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* Rollups Table */}
        {result && rollups.length === 0 ? (
          <div className="border border-edge rounded-lg p-12 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-content-muted/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <span className="text-sm text-content-muted">{t("No Rollups Submitted Yet")}</span>
            <p className="text-xs text-content-muted/50 mt-1">
              {t("Rollups Will Appear Here Once The System Begins Submitting State To The Chain")}</p>
          </div>
        ) : (
          <div className="border border-edge rounded-lg overflow-hidden">
            <div className="page-scrollbar overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-content-muted text-left border-b border-edge bg-surface/50">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">{t("Time")}</th>
                    <th className="px-4 py-3 font-medium">{t("Tx Hash")}</th>
                    <th className="px-4 py-3 font-medium">{t("State Root Transition")}</th>
                    <th className="px-4 py-3 font-medium">{t("Seq Range")}</th>
                    <th className="px-4 py-3 font-medium">{t("Ops")}</th>
                    <th className="px-4 py-3 font-medium">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rollups.map((rollup) => (
                    <tr
                      key={rollup.id}
                      onClick={() => navigate(appRoutes.explorerRollup(rollup.id))}
                      className="border-b border-edge/30 hover:bg-hover/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3  text-content-secondary">
                        {rollup.id}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">
                        {formatExplorerTimestamp(rollup.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className=" text-accent-primary">
                          {truncateHash(rollup.txHash)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <HashTransition
                          from={rollup.oldStateRoot}
                          to={rollup.newStateRoot}
                        />
                      </td>
                      <td className="px-4 py-3  text-content-secondary">
                        {rollup.oldSequence} - {rollup.newSequence}
                      </td>
                      <td className="px-4 py-3  text-accent-secondary font-medium">
                        {rollup.operationsCount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={rollup.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ExplorerPagination
              offset={offset}
              limit={limit}
              total={total}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={() => setOffset((prev) => Math.max(0, prev - limit))}
              onNext={() => setOffset((prev) => prev + limit)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

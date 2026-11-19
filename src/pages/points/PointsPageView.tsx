import type { RefObject } from "react";
import { Download } from "lucide-react";
import {
  DashboardDataTable,
  DashboardDataTableCell,
  DashboardDataTableRow,
} from "@/components/DashboardDataTable";
import { PageHeader } from "@/components/PageHeader";
import { PublicDashboardShell } from "@/components/PublicDashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { partner } from "@/config/partners";
import { isPartnerApprovalPending } from "@/config/partners/availability";
import { useAuth } from "@/hooks/useAuth";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { formatInteger, type CampaignPointPeriodRow } from "./pointsUtils";

type PointsPageViewProps = {
  hasUserError: boolean;
  isSavingImage: boolean;
  isTableLoading: boolean;
  needsWalletConnection: boolean;
  pointRows: CampaignPointPeriodRow[];
  shareCardRef: RefObject<HTMLDivElement | null>;
  totalPoints: bigint;
  onSaveImage: () => void;
};

const POINTS_TABLE_PAGE_SIZE = 10;
const POINTS_TABLE_SKELETON_ROWS = 10;

function PointsBackground() {
  return (
    <>
      <div className="absolute inset-0 bg-base" />
      <div className="pointer-events-none absolute -right-[432px] top-[94px] h-[930px] w-[930px] rounded-full border border-accent-primary/20" />
      <div className="pointer-events-none absolute -right-[486px] top-[156px] h-[1030px] w-[1030px] rounded-full border border-accent-primary/15" />
      <div className="pointer-events-none absolute -right-[540px] top-[222px] h-[1130px] w-[1130px] rounded-full border border-accent-primary/10" />
    </>
  );
}

function PointsTableSkeletonRows() {
  return (
    <div
      className="mt-3"
      data-testid="points-table-skeleton"
    >
      {Array.from({ length: POINTS_TABLE_SKELETON_ROWS }, (_, index) => (
        <DashboardDataTableRow
          className="min-h-[50px] text-[13px] font-medium text-content"
          key={`points-table-skeleton-${index}`}
        >
          <DashboardDataTableCell className="text-content-muted">
            <Skeleton className="h-3 w-[clamp(116px,28%,180px)] bg-content-muted/15" />
          </DashboardDataTableCell>
          <DashboardDataTableCell className="justify-end text-right">
            <Skeleton className="h-3 w-16 bg-content-muted/15" />
          </DashboardDataTableCell>
          <DashboardDataTableCell className="justify-end text-right">
            <Skeleton className="h-3 w-16 bg-content-muted/15" />
          </DashboardDataTableCell>
        </DashboardDataTableRow>
      ))}
    </div>
  );
}

function PointsTable({
  hasError,
  isLoading,
  needsWalletConnection,
  rows,
}: {
  hasError: boolean;
  isLoading: boolean;
  needsWalletConnection: boolean;
  rows: CampaignPointPeriodRow[];
}) {
  const { t } = useTranslation();
  const { connect, isConnecting } = useAuth();
  const {
    canGoNext,
    canGoPrevious,
    goToNextPage,
    goToPreviousPage,
    paginationLabel: resultRange,
    visibleItems: pageRows,
  } = useClientPagination(rows, POINTS_TABLE_PAGE_SIZE, {
    emptyLabel: "1-0 of 0",
  });
  const emptyContent = hasError ? (
    <div className="flex min-h-[470px] min-w-[360px] items-center justify-center text-[13px] font-medium text-down">
      {t("Points unavailable")}
    </div>
  ) : needsWalletConnection ? (
    <div className="flex min-h-[470px] min-w-[360px] flex-col items-center justify-center gap-3 px-6 text-center text-[13px] font-medium text-content-muted">
      <span>{t(isPartnerApprovalPending() ? "Trading is not available yet." : "Connect your wallet to view your points.")}</span>
      {!isPartnerApprovalPending() && <Button
        className="h-8 rounded-[7px] bg-button-primary px-4 text-[12px] font-medium text-content hover:bg-button-primary-hover"
        loading={isConnecting}
        onClick={connect}
        type="button"
      >
        {t("Connect")}
      </Button>}
    </div>
  ) : (
    <div className="flex min-h-[470px] min-w-[360px] items-center justify-center px-6 text-center text-[13px] font-medium text-content-muted">
      {t("No points yet")}
    </div>
  );

  return (
    <DashboardDataTable
      bodyTestId="points-table-body"
      columns={[
        {
          cellClassName: "text-content-muted",
          key: "period",
          label: (
            <div className="flex items-center gap-2">
              <span>{t("Period")}</span>
            </div>
          ),
        },
        {
          cellClassName: "justify-end text-right",
          headerClassName: "justify-end text-right",
          key: "referral-points",
          label: t("Referral Points"),
        },
        {
          cellClassName: "justify-end text-right",
          headerClassName: "justify-end text-right",
          key: "points",
          label: (
            <button
              className="inline-flex w-fit items-center justify-self-end text-right text-content-muted"
              type="button"
            >
              {t("Points")}
            </button>
          ),
        },
      ]}
      columnTemplate="minmax(180px,1fr) minmax(116px,0.45fr) minmax(90px,0.35fr)"
      emptyContent={emptyContent}
      fillAvailableSpace={false}
      isLoading={isLoading}
      loadingContent={<PointsTableSkeletonRows />}
      minWidth={520}
      pagination={{
        canGoNext,
        canGoPrevious,
        isLoading,
        label: resultRange,
        nextLabel: t("Next page"),
        onNextPage: goToNextPage,
        onPreviousPage: goToPreviousPage,
        previousLabel: t("Previous page"),
      }}
      rows={pageRows.map((row) => (
        <DashboardDataTableRow
          className="min-h-[50px] text-[13px] font-medium text-content"
          key={`${row.periodStartMs}-${row.periodEndMs}`}
        >
          <DashboardDataTableCell className="text-content-muted">
            {row.periodLabel}
          </DashboardDataTableCell>
          <DashboardDataTableCell className="justify-end text-right">
            {formatInteger(row.referralPoints)}
          </DashboardDataTableCell>
          <DashboardDataTableCell className="justify-end text-right">
            {formatInteger(row.points)}
          </DashboardDataTableCell>
        </DashboardDataTableRow>
      ))}
    />
  );
}

function ShareImageCard({
  cardRef,
  isLoading,
  totalPoints,
}: {
  cardRef: RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  totalPoints: bigint;
}) {
  const { t } = useTranslation();

  return (
    <div
      ref={cardRef}
      className="relative flex h-full min-h-[260px] w-full flex-col overflow-hidden rounded-[7px] border border-edge bg-base p-5"
      data-testid="points-share-card"
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "repeating-radial-gradient(ellipse at 30% 52%, rgb(var(--color-edge) / 0.78) 0 1px, transparent 1px 15px), repeating-radial-gradient(ellipse at 66% 52%, rgb(var(--color-accent-primary) / 0.2) 0 1px, transparent 1px 15px)",
        }}
      />
      <div className="absolute -bottom-16 left-1/2 h-[270px] w-[270px] -translate-x-1/2 rounded-full border border-accent-primary/20" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <img src={partner.logoUrl} alt="" className="mb-10 h-12 w-12 object-contain" />
        {isLoading ? (
          <div
            className="flex flex-col items-center"
            data-testid="points-share-skeleton"
          >
            <Skeleton className="h-5 w-36 bg-content-muted/15" />
            <Skeleton className="mt-1 h-5 w-24 bg-content-muted/15" />
            <Skeleton className="mt-6 h-9 w-32 bg-content-muted/15" />
          </div>
        ) : (
          <>
            <div className="w-full text-[18px] font-semibold leading-[1.25] text-content">
              <div>{t("My total points")}</div>
              <div>{partner.name}</div>
            </div>
            <div className="mt-5 w-full text-[36px] font-light leading-none text-accent-primary">
              {formatInteger(totalPoints)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SharePanel({
  isLoading,
  isSaving,
  needsWalletConnection,
  shareCardRef,
  totalPoints,
  onSaveImage,
}: {
  isLoading: boolean;
  isSaving: boolean;
  needsWalletConnection: boolean;
  shareCardRef: RefObject<HTMLDivElement | null>;
  totalPoints: bigint;
  onSaveImage: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside
      className="flex h-full min-h-[600px] rounded-[8px] bg-surface p-3 lg:min-h-0 lg:w-[322px] lg:shrink-0"
      data-testid="points-share-panel"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="px-0.5 pt-2 text-[15px] font-medium leading-none text-content-muted">
          {t("Share")}
        </div>
        <div className="mt-6 flex min-h-0 flex-1 justify-center">
          <div className="min-h-0 w-full">
            <ShareImageCard
              cardRef={shareCardRef}
              isLoading={isLoading}
              totalPoints={totalPoints}
            />
          </div>
        </div>
        <Button
          className="mt-3 h-[34px] w-full shrink-0 rounded-[7px] bg-button-primary text-[12px] font-medium text-content hover:bg-button-primary-hover"
          disabled={needsWalletConnection}
          loading={isSaving}
          onClick={onSaveImage}
          type="button"
        >
          <Download size={13} strokeWidth={1.8} />
          {t("Save Image")}
        </Button>
      </div>
    </aside>
  );
}

export function PointsPageView({
  hasUserError,
  isSavingImage,
  isTableLoading,
  needsWalletConnection,
  pointRows,
  shareCardRef,
  totalPoints,
  onSaveImage,
}: PointsPageViewProps) {
  const { t } = useTranslation();

  return (
    <div className="relative isolate min-h-[calc(100dvh-54px)] overflow-hidden text-content lg:h-[calc(100dvh-114px)] lg:min-h-0">
      <PointsBackground />
      <PublicDashboardShell
        className="relative z-10 h-full"
        testId="points-page-content"
      >
        <PageHeader title={t("Points")} />

        <div className="grid min-h-0 items-stretch gap-2 lg:h-[70vh] lg:min-h-[400px] lg:max-h-[600px] lg:grid-cols-[minmax(0,982px)_322px]">
          <div className="flex min-h-0 min-w-0">
            <PointsTable
              hasError={hasUserError}
              isLoading={isTableLoading}
              needsWalletConnection={needsWalletConnection}
              rows={pointRows}
            />
          </div>

          <SharePanel
            isLoading={isTableLoading}
            isSaving={isSavingImage}
            needsWalletConnection={needsWalletConnection}
            shareCardRef={shareCardRef}
            totalPoints={totalPoints}
            onSaveImage={onSaveImage}
          />
        </div>
      </PublicDashboardShell>
    </div>
  );
}

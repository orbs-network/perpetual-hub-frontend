import { useMemo, useState } from "react";
import { SearchX, UserRoundPlus } from "lucide-react";
import type { UserReferralSummaryResponse } from "@/api/referrals";
import {
  DashboardDataTable,
  DashboardDataTableCell,
  DashboardDataTableRow,
} from "@/components/DashboardDataTable";
import { DashboardSearchInput } from "@/components/DashboardSearchInput";
import { WalletExplorerLink } from "@/components/WalletExplorerLink";
import { useCurrentPartnerChain } from "@/hooks/useCurrentPartnerChain";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { shortenAddress } from "@/utils/formatting";
import {
  REFERRALS_TABLE_COLUMNS,
  REFERRALS_TABLE_COLUMN_TEMPLATE,
  REFERRALS_TABLE_MIN_WIDTH,
  REFERRALS_TABLE_PAGE_SIZE,
} from "./constants";
import { ReferralsTableSkeletonRows } from "./ReferralsTableSkeletonRows";
import type { ReferralTableUser } from "./types";
import { formatReferralDateTime } from "./utils";

const EMPTY_REFERRED_USERS: ReferralTableUser[] = [];

function ReferralsEmptyState({
  hasActiveSearch,
}: {
  hasActiveSearch: boolean;
}) {
  const { t } = useTranslation();
  const Icon = hasActiveSearch ? SearchX : UserRoundPlus;

  return (
    <div className="flex min-h-[260px] min-w-[360px] flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-edge/80 bg-raised/55 text-accent-primary shadow-glow">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-content">
          {t(hasActiveSearch ? "No referrals found" : "No referrals yet")}
        </div>
        <div className="max-w-[300px] text-[12px] leading-5 text-content-muted">
          {t(
            hasActiveSearch
              ? "Try a different wallet address."
              : "Linked traders will appear here as soon as they join with your code.",
          )}
        </div>
      </div>
    </div>
  );
}

export function ReferralsTable({
  summary,
  isLoading,
}: {
  summary?: UserReferralSummaryResponse;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const currentChain = useCurrentPartnerChain();
  const [searchQuery, setSearchQuery] = useState("");
  const realUsers = summary?.referredUsers ?? EMPTY_REFERRED_USERS;
  const users = useMemo<ReferralTableUser[]>(
    () => realUsers.map((user) => ({ ...user })),
    [realUsers],
  );
  const filteredUsers = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    if (!normalizedSearchQuery) return users;

    return users.filter((user) =>
      user.userAddress.toLowerCase().includes(normalizedSearchQuery),
    );
  }, [searchQuery, users]);
  const hasActiveSearch = searchQuery.trim().length > 0;
  const {
    canGoNext,
    canGoPrevious,
    goToNextPage,
    goToPreviousPage,
    paginationLabel,
    visibleItems: visibleUsers,
  } = useClientPagination(filteredUsers, REFERRALS_TABLE_PAGE_SIZE, {
    resetKey: `${currentChain.chainId}:${searchQuery.trim().toLowerCase()}`,
  });
  const renderAddress = (user: ReferralTableUser) => {
    const addressLabel = shortenAddress(user.userAddress);

    return (
      <WalletExplorerLink
        address={user.userAddress}
        chainId={currentChain.chainId}
        className="truncate text-accent-primary underline-offset-4 hover:underline"
        fallbackClassName="truncate text-content-secondary"
        showIcon={false}
      >
        {addressLabel}
      </WalletExplorerLink>
    );
  };

  return (
    <DashboardDataTable
      bodyTestId="referrals-table-body"
      columns={REFERRALS_TABLE_COLUMNS.map((column) => ({
        ...column,
        label: t(column.label),
      }))}
      columnTemplate={REFERRALS_TABLE_COLUMN_TEMPLATE}
      emptyContent={
        <ReferralsEmptyState hasActiveSearch={hasActiveSearch} />
      }
      fillAvailableSpace
      headerAction={
        <DashboardSearchInput
          ariaLabel={t("Search referrals")}
          className="sm:w-[320px] lg:w-[360px]"
          disabled={isLoading}
          placeholder={t("Search address")}
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
      }
      isLoading={isLoading}
      loadingContent={<ReferralsTableSkeletonRows />}
      minWidth={REFERRALS_TABLE_MIN_WIDTH}
      pagination={{
        canGoNext,
        canGoPrevious,
        isLoading,
        label: paginationLabel,
        nextLabel: t("Next page"),
        onNextPage: goToNextPage,
        onPreviousPage: goToPreviousPage,
        previousLabel: t("Previous page"),
      }}
      panelTestId="referrals-table-panel"
      rows={visibleUsers.map((user) => (
        <DashboardDataTableRow
          className="bg-raised/35"
          key={`${user.userAddress}-${user.linkedAt}`}
        >
          {REFERRALS_TABLE_COLUMNS.map((column) => {
            const value =
              column.key === "address"
                ? renderAddress(user)
                : column.key === "dateJoined"
                  ? formatReferralDateTime(user.linkedAt)
                  : column.key === "totalVolume"
                    ? (user.totalVolume ?? "-")
                    : column.key === "feesPaid"
                      ? (user.feesPaid ?? "-")
                      : (user.yourRewards ?? "-");

            return (
              <DashboardDataTableCell
                className={column.cellClassName}
                key={`${user.userAddress}-${column.key}`}
              >
                {value}
              </DashboardDataTableCell>
            );
          })}
        </DashboardDataTableRow>
      ))}
      title={t("Referrals")}
    />
  );
}

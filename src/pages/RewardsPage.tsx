import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PublicDashboardShell } from "@/components/PublicDashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  CreateReferralCodeModal,
  EnterReferralCodeModal,
} from "./rewards/ReferralCodeModals";
import { ReferralsTable } from "./rewards/ReferralsTable";
import { RewardsActionButton } from "./rewards/RewardsActionButton";
import { RewardsStatsGrid } from "./rewards/RewardsStatsGrid";
import type { ReferralDialog } from "./rewards/types";
import { useInitialReferralCode } from "./rewards/useInitialReferralCode";
import { useReferralSummary } from "./rewards/useReferralSummary";

export function RewardsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [createCode, setCreateCode] = useState("");
  const [activeDialog, setActiveDialog] = useState<ReferralDialog>(null);
  const [mustEnableTrading, setMustEnableTrading] = useState(false);
  const initialCode = useInitialReferralCode();
  const { refreshSummary, summaryQuery, walletAddress } = useReferralSummary();
  const createdCode = summaryQuery.data?.createdCode;
  const linkedCode = summaryQuery.data?.linkedCode;
  const referredUsersCount = summaryQuery.data?.referredUsers.length ?? 0;

  return (
    <div
      className="flex min-h-[calc(100dvh-54px)] w-full flex-col text-content"
      data-testid="rewards-page"
    >
      <PublicDashboardShell className="bg-base" testId="rewards-page-content">
        <PageHeader
          title={t("Referrals")}
          action={
            <>
              <RewardsActionButton
                disabled={!walletAddress}
                onClick={() => setActiveDialog("enter")}
              >
                {t("Enter Code")}
              </RewardsActionButton>
              <RewardsActionButton
                disabled={!walletAddress}
                onClick={() => setActiveDialog("create")}
              >
                {createdCode ? t("Share Code") : t("Create Code")}
              </RewardsActionButton>
            </>
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <RewardsStatsGrid
            isLoading={summaryQuery.isLoading}
            referredUsersCount={referredUsersCount}
          />
          <ReferralsTable
            summary={summaryQuery.data}
            isLoading={summaryQuery.isLoading}
          />
        </div>
      </PublicDashboardShell>

      <CreateReferralCodeModal
        code={createCode}
        createdCode={createdCode}
        isAuthenticated={isAuthenticated}
        mustEnableTrading={mustEnableTrading}
        open={activeDialog === "create"}
        setCode={setCreateCode}
        summary={summaryQuery.data}
        walletAddress={walletAddress}
        onCreated={() => {
          refreshSummary();
          setActiveDialog(null);
        }}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
        onTradingEnabled={() => setMustEnableTrading(false)}
        onTradingNotEnabled={() => setMustEnableTrading(true)}
      />

      <EnterReferralCodeModal
        initialCode={initialCode}
        linkedCode={linkedCode}
        open={activeDialog === "enter"}
        walletAddress={walletAddress}
        onLinked={() => {
          refreshSummary();
          setActiveDialog(null);
        }}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      />
    </div>
  );
}

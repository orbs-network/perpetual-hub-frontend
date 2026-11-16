import { ReferralStat } from "./ReferralStat";

export function RewardsStatsGrid({
  isLoading,
  referredUsersCount,
}: {
  isLoading: boolean;
  referredUsersCount: number;
}) {
  return (
    <div className="grid shrink-0 gap-2 md:grid-cols-3">
      <ReferralStat
        isLoading={isLoading}
        label="Traders Referred"
        value={referredUsersCount}
      />
      <ReferralStat isLoading={isLoading} label="Rewards Earned" value="$0" />
      <ReferralStat isLoading={isLoading} label="Claimable Rewards" value="$0" />
    </div>
  );
}

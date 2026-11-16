import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function ReferralStat({
  isLoading,
  label,
  value,
  detail,
}: {
  isLoading?: boolean;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-[82px] min-w-0 rounded-[8px] border border-edge bg-surface px-4 py-3 shadow-card">
      <div className="truncate text-[13px] font-medium text-content-muted">
        {t(label)}
      </div>
      {isLoading ? (
        <Skeleton
          className="mt-3 h-7 w-24 bg-content-muted/15"
          data-testid="referral-stat-value-skeleton"
        />
      ) : (
        <div className="mt-2 truncate text-[26px] font-medium leading-none text-content">
          {value}
        </div>
      )}
      {!isLoading && detail ? (
        <div className="mt-2 truncate text-[11px] font-medium text-accent-primary">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

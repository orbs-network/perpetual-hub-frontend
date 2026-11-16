import { Skeleton } from "@/components/ui/skeleton";
import {
  DashboardDataTableCell,
  DashboardDataTableRow,
} from "@/components/DashboardDataTable";
import {
  REFERRALS_TABLE_SKELETON_ROWS,
} from "./constants";

export function ReferralsTableSkeletonRows() {
  return (
    <div data-testid="referrals-table-skeleton">
      {Array.from({ length: REFERRALS_TABLE_SKELETON_ROWS }, (_, rowIndex) => (
        <DashboardDataTableRow key={`referrals-table-skeleton-${rowIndex}`}>
          <DashboardDataTableCell>
            <Skeleton className="h-3 w-32 bg-content-muted/15" />
          </DashboardDataTableCell>
          <DashboardDataTableCell>
            <Skeleton className="h-3 w-28 bg-content-muted/15" />
          </DashboardDataTableCell>
          <DashboardDataTableCell>
            <Skeleton className="h-3 w-10 bg-content-muted/15" />
          </DashboardDataTableCell>
          <DashboardDataTableCell>
            <Skeleton className="h-3 w-10 bg-content-muted/15" />
          </DashboardDataTableCell>
          <DashboardDataTableCell>
            <Skeleton className="h-3 w-10 bg-content-muted/15" />
          </DashboardDataTableCell>
        </DashboardDataTableRow>
      ))}
    </div>
  );
}

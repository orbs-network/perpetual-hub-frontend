import { ArrowRight } from "lucide-react";
import type { OperationItem } from "@/types";
import { formatExplorerTimestamp, truncateHash } from "./utils";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { safeUpperCase } from "@/lib/utils";
import { useUserPreferencesStore } from "@/stores/userPreferencesStore";
import { useTranslation } from "@/hooks/useSafeTranslation";

export function StatusBadge({ status }: { status: string }) {
  const upper = safeUpperCase(status);
  let colorClasses = "bg-badge-bg text-content-muted";

  if (upper === "CONFIRMED" || upper === "SUCCESS") {
    colorClasses = "bg-up/20 text-up";
  } else if (upper === "SUBMITTED" || upper === "PENDING") {
    colorClasses = "bg-warning/20 text-warning";
  } else if (upper === "FAILED" || upper === "REJECTED") {
    colorClasses = "bg-down/20 text-down";
  }

  return (
    <span
      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${colorClasses}`}
    >
      {status || "UNKNOWN"}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const upper = safeUpperCase(type);
  let colorClasses = "bg-accent-primary/20 text-accent-primary";

  if (upper.includes("DEPOSIT")) {
    colorClasses = "bg-up/20 text-up";
  } else if (upper.includes("WITHDRAW")) {
    colorClasses = "bg-warning/20 text-warning";
  } else if (upper.includes("LIQUIDAT")) {
    colorClasses = "bg-down/20 text-down";
  } else if (
    upper.includes("OPEN") ||
    upper.includes("LIMIT") ||
    upper.includes("STOP") ||
    upper.includes("ORDER")
  ) {
    colorClasses = "bg-accent-secondary/20 text-accent-secondary";
  } else if (upper.includes("CLOSE")) {
    colorClasses = "bg-accent-tertiary/20 text-accent-tertiary";
  } else if (upper.includes("FILL")) {
    colorClasses = "bg-long/20 text-long";
  } else if (upper.includes("CANCEL")) {
    colorClasses = "bg-content-muted/20 text-content-muted";
  } else if (upper.includes("LEVERAGE")) {
    colorClasses = "bg-accent-tertiary/20 text-accent-tertiary";
  } else if (upper.includes("FUNDING")) {
    colorClasses = "bg-accent-secondary/20 text-accent-secondary";
  } else if (upper.includes("CONFIG")) {
    colorClasses = "bg-accent-primary/20 text-accent-primary";
  }

  return (
    <span
      className={`px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap ${colorClasses}`}
    >
      {type || "UNKNOWN"}
    </span>
  );
}

export function SideBadge({ side }: { side: string }) {
  return (
    <span
      className={`px-2 py-1 rounded text-[10px] font-bold ${
        safeUpperCase(side) === "BUY" ? "bg-up/20 text-up" : "bg-down/20 text-down"
      }`}
    >
      {side}
    </span>
  );
}

export function PnlValue({ value }: { value: string }) {
  const hidePnl = useUserPreferencesStore((state) => state.hidePnl);
  if (!value || value === "0" || value === "0.00") {
    return <span className=" text-content-muted">-</span>;
  }
  if (hidePnl) {
    return <span className=" font-medium text-content-muted">{HIDDEN_PNL_TEXT}</span>;
  }
  const num = parseFloat(value);
  const isPositive = num >= 0;
  return (
    <span
      className={` font-medium ${isPositive ? "text-up" : "text-down"}`}
    >
      {isPositive ? "+" : ""}
      {value}
    </span>
  );
}

export function HashTransition({
  from,
  to,
}: {
  from?: string | null;
  to?: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className=" text-content-muted">{truncateHash(from)}</span>
      <ArrowRight className="w-3 h-3 text-content-muted flex-shrink-0" />
      <span className=" text-up">{truncateHash(to)}</span>
    </div>
  );
}

export function ExplorerPagination({
  offset,
  limit,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  offset: number;
  limit: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-edge bg-surface/30">
      <span className="text-xs text-content-muted">
        {t("Showing ")}{total === 0 ? 0 : offset + 1}-{Math.min(offset + limit, total)} {t("of")}{" "}
        {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="rounded-lg border border-edge bg-input-bg px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-30"
        >
          {t("Prev")}</button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="rounded-lg border border-edge bg-input-bg px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-30"
        >
          {t("Next")}</button>
      </div>
    </div>
  );
}

export function OperationRow({ operation }: { operation: OperationItem }) {
  return (
    <tr className="border-b border-edge/30 hover:bg-hover/50 transition-colors">
      <td className="px-4 py-3  text-accent-secondary">
        {operation.teeSequence != null ? `#${operation.teeSequence}` : "-"}
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={operation.operationType} />
      </td>
      <td className="px-4 py-3">
        <span className=" text-accent-primary">
          {truncateHash(operation.userAddress)}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-content">
        {operation.symbol || "-"}
      </td>
      <td className="px-4 py-3">
        {operation.side ? (
          <SideBadge side={operation.side} />
        ) : (
          <span className="text-content-muted">-</span>
        )}
      </td>
      <td className="px-4 py-3  text-content-secondary">
        {operation.quantity || "-"}
      </td>
      <td className="px-4 py-3  text-content-secondary">
        {operation.price ? `$${operation.price}` : "-"}
      </td>
      <td className="px-4 py-3  text-content-muted">
        {operation.fee ? `$${operation.fee}` : "-"}
      </td>
      <td className="px-4 py-3">
        <PnlValue value={operation.realizedPnl} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={operation.status} />
      </td>
      <td className="px-4 py-3  text-content-secondary">
        {operation.stateRoot ? truncateHash(operation.stateRoot) : "-"}
      </td>
      <td className="px-4 py-3 text-content-muted whitespace-nowrap">
        {formatExplorerTimestamp(operation.timestamp)}
      </td>
    </tr>
  );
}

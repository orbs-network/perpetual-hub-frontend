import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";

export type StepStatus = "pending" | "active" | "done";

export interface SignStep {
  label: string;
  status: StepStatus;
}

interface SignTransactionOverlayProps {
  steps: SignStep[];
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <CheckCircle size={16} className="text-up" />;
  if (status === "active") return <Loader2 size={16} className="text-content animate-spin" />;
  return <Circle size={16} className="text-content-secondary" />;
}

function StepLabel({ status }: { status: StepStatus }) {
  const { t } = useTranslation();
  if (status === "done") return <span className="text-[12px] text-up">{t("Signed")}</span>;
  if (status === "active") return <span className="text-[12px] text-content">{t("Signing...")}</span>;
  return <span className="text-[12px] text-content-secondary">{t("Not signed")}</span>;
}

export function SignTransactionOverlay({ steps }: SignTransactionOverlayProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center space-y-5">
      <Loader2 size={50} className="text-content-muted animate-spin" />

      <div className="text-center space-y-1">
        <h3 className="text-base font-semibold text-content">
          {t(steps.length > 1 ? "Sign Transactions" : "Sign Transaction")}
        </h3>
        <p className="text-[13px] text-content-muted">
          {t("You will need to sign this transaction in your wallet.")}</p>
      </div>

      <div className="w-full space-y-1.5">
        {steps.map((step) => (
          <div
            key={step.label}
            className="flex items-center justify-between px-4 py-2.5 bg-edge rounded-xl border border-edge"
          >
            <div className="flex items-center gap-2">
              <StepIcon status={step.status} />
              <span className="text-[13px] text-content font-medium">
                {t(step.label)}
              </span>
            </div>
            <StepLabel status={step.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useAccount } from "wagmi";
import { Plus } from "lucide-react";
import { AuthGuardButton } from "./AuthGuardButton";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalTrigger,
} from "./ui/responsive-modal";
import { useTargetChain } from "@/hooks/useTargetChain";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";
import { DepositForm } from "./deposit/DepositForm";

interface DepositModalProps {
  trigger?: ReactNode;
}

export function DepositModal({ trigger }: DepositModalProps) {
  const { t } = useTranslation();
  const { address: walletAddress } = useAccount();
  const { sharedSession, viewerAddress } = useAppQueryParams();
  const [open, setOpen] = useState(false);
  const targetChain = useTargetChain();
  const renderSubmit = useCallback(
    (button: ReactNode) => <AuthGuardButton>{button}</AuthGuardButton>,
    [],
  );

  // Deposits require an on-chain wallet — not available in shared session mode.
  if (sharedSession || (!walletAddress && viewerAddress)) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger asChild>
        {trigger ?? (
          <button className="flex h-full items-center gap-1 rounded-lg border border-[var(--color-button-primary-border)] bg-[var(--color-button-primary-bg)] px-2.5 py-1.5 text-xs font-medium text-content-inverse transition-all hover:bg-[var(--color-button-primary-bg-hover)]">
            <Plus size={12} />
            {t("Deposit")}
          </button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {t("Deposit {{collateralSymbol}} from", { collateralSymbol: getCollateralSymbol() })} {targetChain?.name}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {t("Deposit {{collateralSymbol}} into the trading platform", { collateralSymbol: getCollateralSymbol() })}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <DepositForm
          onDepositSuccess={() => setOpen(false)}
          renderSubmit={renderSubmit}
        />
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

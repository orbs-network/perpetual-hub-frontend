import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useAccount } from "wagmi";
import { ArrowLeftRight, Plus } from "lucide-react";
import { AuthGuardButton } from "./AuthGuardButton";
import { Button } from "./ui/button";
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
import { useBridgeEnabled } from "@/hooks/useBridgeEnabled";
import { useNavigateWithQuery } from "@/hooks/useNavigation";
import { ROUTE_PATHS } from "@/routes";
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
  const navigateWithQuery = useNavigateWithQuery();
  const bridgeEnabled = useBridgeEnabled();
  const renderSubmit = useCallback(
    (button: ReactNode) => <AuthGuardButton>{button}</AuthGuardButton>,
    [],
  );

  // `useNavigateWithQuery` appends the app's sanitized query string, so
  // The supported ?chain= selection survives while read-only and deprecated params are
  // stripped the same way every other navigation strips them.
  const handleBridgeClick = useCallback(() => {
    setOpen(false);
    navigateWithQuery(ROUTE_PATHS.bridge);
  }, [navigateWithQuery]);

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
          {/*
            When bridging is off, the title is rendered exactly as it was before
            this feature — no wrapper or extra classes — preserving its layout.

            When it is on, a two-column grid gives the button its own track. The
            title keeps its centered text within the remaining column rather
            than being centered on the modal; an absolutely-positioned button
            would overlap longer chain names, and reserving space with symmetric
            padding squeezed the title to three lines on mobile.
          */}
          {bridgeEnabled ? (
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <ResponsiveModalTitle className="min-w-0">
                {t("Deposit {{collateralSymbol}} from", { collateralSymbol: getCollateralSymbol() })} {targetChain?.name}
              </ResponsiveModalTitle>
              <Button
                type="button"
                variant="themedSecondary"
                size="xs"
                data-testid="deposit-bridge-button"
                onClick={handleBridgeClick}
                className="shrink-0 gap-1"
              >
                <ArrowLeftRight size={12} />
                {t("Bridge")}
              </Button>
            </div>
          ) : (
            <ResponsiveModalTitle>
              {t("Deposit {{collateralSymbol}} from", { collateralSymbol: getCollateralSymbol() })} {targetChain?.name}
            </ResponsiveModalTitle>
          )}
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

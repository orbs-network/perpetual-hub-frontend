import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useTranslation } from "@/hooks/useSafeTranslation";
import {
  useBridgeDestinationChainId,
  useBridgeEnabled,
} from "@/hooks/useBridgeEnabled";
import { useAppQueryParams } from "@/hooks/useAppQueryParams";
import { useTargetChain } from "@/hooks/useTargetChain";
import { usePath } from "@/hooks/useNavigation";
import { PageHeader } from "@/components/PageHeader";
import { PublicDashboardShell } from "@/components/PublicDashboardLayout";
import { BridgeWidget } from "@/components/bridge/BridgeWidget";
import { appRoutes } from "@/routes";

export function BridgePage() {
  const { t } = useTranslation();
  const bridgeEnabled = useBridgeEnabled();
  const { sharedSession, viewerAddress } = useAppQueryParams();
  const { address: walletAddress, isConnecting, isReconnecting } = useAccount();
  const destinationChainId = useBridgeDestinationChainId();
  const targetChain = useTargetChain();
  const tradePath = usePath(appRoutes.trade());

  // Bridging is only useful if the user can then deposit, so this must match
  // DepositModal's own condition EXACTLY. Blocking on `viewerAddress` alone
  // would bounce someone who opened a viewer link and then connected a wallet —
  // they still see the Bridge button, so the button would loop back to trade.
  // While wagmi is (re)connecting, `address` is briefly undefined. Treating
  // that as "no wallet" would bounce a viewer-link user who does have one,
  // before their state settles — the same deep-link failure this page already
  // fixed once. Only judge once the wallet has actually settled.
  const walletSettled = !isConnecting && !isReconnecting;
  const canDeposit =
    !sharedSession && !(walletSettled && !walletAddress && viewerAddress);

  // The flag gate resolves synchronously from partner config, so this decision
  // is stable from the first render and across wallet connect/disconnect — no
  // loading window in which a deep link could be bounced, and no state change
  // that would tear the widget down mid-bridge.
  if (!bridgeEnabled || !canDeposit) {
    return <Navigate to={tradePath} replace />;
  }

  return (
    <PublicDashboardShell
      testId="bridge-page-content"
      innerClassName="max-w-2xl"
    >
      <PageHeader
        title={
          targetChain?.name
            ? `${t("Bridge to")} ${targetChain.name}`
            : t("Bridge")
        }
        description={t(
          "Move funds from another chain into {{collateralSymbol}} here, then deposit into the platform.",
          { collateralSymbol: getCollateralSymbol() },
        )}
      />
      <BridgeWidget destinationChainId={destinationChainId} />
    </PublicDashboardShell>
  );
}

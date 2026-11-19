import { useTranslation } from "@/hooks/useSafeTranslation";
import { AuthGuardButton } from "@/components/AuthGuardButton";
import { DepositModal } from "@/components/DepositModal";
import { LanguagePopover } from "@/components/LanguagePopover";
import { SettingsPopover } from "@/components/SettingsPopover";
import { Button } from "@/components/ui/button";
import { HeaderChainSelector } from "./HeaderChainSelector";
import { HeaderTradeOnMobileButton } from "./HeaderTradeOnMobileButton";
import { HeaderWalletPopover } from "./HeaderWalletPopover";
import { useAuth } from "@/hooks/useAuth";
import { useActiveAddress } from "@/hooks/useActiveAddress";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAccount } from "wagmi";
import { isPartnerApprovalPending } from "@/config/partners/availability";

export function HeaderActions() {
  const { t } = useTranslation();
  const { isAuthenticated, isConnected, isDisconnecting, logout } = useAuth();
  const isMobile = useIsMobile();
  const { address: walletAddress } = useAccount();
  const activeAddress = useActiveAddress();
  return (
    <div
      className={`flex h-8 min-w-0 shrink-0 items-center justify-end ${
        isMobile ? "gap-1" : "gap-2"
      }`}
    >
      {isPartnerApprovalPending() ? <LanguagePopover /> : !isConnected ? (
        <>
          <HeaderChainSelector />
          <LanguagePopover />
          <AuthGuardButton
            variant="themed"
            className={isMobile ? "h-full px-2.5 text-[12px]" : "h-full"}
            showMobileQrRescanMessage={false}
          />
        </>
      ) : (
        <>
          {isAuthenticated && !isMobile && (
            <DepositModal
              trigger={
                <Button
                  variant="default"
                  className="h-full px-7 text-[12px] font-medium"
                >
                  {t("header.deposit")}
                </Button>
              }
            />
          )}
          <HeaderWalletPopover
            walletAddress={activeAddress ?? walletAddress}
            logout={logout}
            isDisconnecting={isDisconnecting}
          />
          <HeaderChainSelector />
          {!isMobile && <HeaderTradeOnMobileButton />}
          <LanguagePopover />
          {isAuthenticated && <SettingsPopover />}
        </>
      )}
    </div>
  );
}

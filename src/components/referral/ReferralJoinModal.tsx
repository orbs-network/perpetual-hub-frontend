import { Gift } from "lucide-react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { Button } from "@/components/ui/button";
import { useIsWalletChainResolving } from "@/hooks/useSupportedChainId";
import { useSwitchToSupportedChain } from "@/hooks/useSwitchToSupportedChain";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";

interface ReferralJoinModalProps {
  code: string;
  isJoining?: boolean;
  linkedCode?: string;
  onJoin?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function ReferralJoinModal({
  code,
  isJoining = false,
  linkedCode,
  onJoin,
  onOpenChange,
  open,
}: ReferralJoinModalProps) {
  const { t } = useTranslation();
  const isResolvingChain = useIsWalletChainResolving();
  const {
    isSwitching,
    shouldSwitchChain,
    switchChainName,
    switchToSupportedChain,
  } = useSwitchToSupportedChain();
  const isBusy = isJoining || isResolvingChain || isSwitching;
  const isAlreadyLinked = !!linkedCode;

  const handleJoin = () => {
    if (isResolvingChain) return;
    if (shouldSwitchChain) {
      void switchToSupportedChain();
      return;
    }
    onJoin?.();
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {isAlreadyLinked ? t("Referral Code") : t("Join Now")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center">
            {isAlreadyLinked
              ? t("You are using the code: {{code}}", { code: linkedCode })
              : t("Confirm This Referral Code For Your Account.")}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {!isAlreadyLinked ? (
          <ResponsiveModalFooter>
            <Button
              type="button"
              className="w-full"
              loading={isBusy}
              onClick={handleJoin}
            >
              {isResolvingChain
                ? t("Checking Network")
                : shouldSwitchChain
                  ? `${t("Switch to")} ${switchChainName}`
                  : (
                      <>
                        <Gift size={15} />
                        {t("Join With Code: {{code}}", { code })}
                      </>
                    )}
            </Button>
          </ResponsiveModalFooter>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

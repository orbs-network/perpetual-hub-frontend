import type { UserReferralSummaryResponse } from "@/api/referrals";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { partner } from "@/config/partners";
import { CreateCodeForm } from "./CreateCodeForm";
import { EnableTradingToCreateCode } from "./EnableTradingToCreateCode";
import { LinkCodeForm } from "./LinkCodeForm";
import { ShareCodeCard } from "./ShareCodeCard";
import type { WalletAddress } from "./types";

type CreateReferralCodeModalProps = {
  code: string;
  createdCode?: UserReferralSummaryResponse["createdCode"];
  isAuthenticated: boolean;
  mustEnableTrading: boolean;
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  onTradingEnabled: () => void;
  onTradingNotEnabled: () => void;
  open: boolean;
  setCode: (code: string) => void;
  summary?: UserReferralSummaryResponse;
  walletAddress?: WalletAddress;
};

export function CreateReferralCodeModal({
  code,
  createdCode,
  isAuthenticated,
  mustEnableTrading,
  onCreated,
  onOpenChange,
  onTradingEnabled,
  onTradingNotEnabled,
  open,
  setCode,
  summary,
  walletAddress,
}: CreateReferralCodeModalProps) {
  const { t } = useTranslation();
  const isSharingCode = Boolean(createdCode);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        className={
          isSharingCode
            ? "!max-w-[612px] rounded-[14px] bg-surface/95 pb-0 pt-8"
            : undefined
        }
      >
        <ResponsiveModalHeader
          className={isSharingCode ? "!px-8 !pb-0 !pt-7" : undefined}
        >
          <ResponsiveModalTitle
            className={isSharingCode ? "!text-[22px] !leading-7" : undefined}
          >
            {isSharingCode ? t("Share Code") : t("Create Code")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription
            className={
              isSharingCode
                ? "text-center text-[13px] leading-5"
                : "text-center"
            }
          >
            {createdCode
              ? t("Your code is {{code}}", { code: createdCode.code })
              : partner.featureFlags?.autoGenerateReferralCode
                ? t("A referral code will be generated for you.")
                : t("Choose a referral code to share with traders.")}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {!walletAddress ? null : createdCode ? (
          <ShareCodeCard summary={summary} />
        ) : !isAuthenticated || mustEnableTrading ? (
          <EnableTradingToCreateCode
            forceLogin={mustEnableTrading}
            onEnabled={onTradingEnabled}
          />
        ) : (
          <CreateCodeForm
            address={walletAddress}
            code={code}
            setCode={setCode}
            onCreated={onCreated}
            onTradingNotEnabled={onTradingNotEnabled}
          />
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

type EnterReferralCodeModalProps = {
  initialCode: string;
  linkedCode?: UserReferralSummaryResponse["linkedCode"];
  onLinked: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  walletAddress?: WalletAddress;
};

export function EnterReferralCodeModal({
  initialCode,
  linkedCode,
  onLinked,
  onOpenChange,
  open,
  walletAddress,
}: EnterReferralCodeModalProps) {
  const { t } = useTranslation();

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{t("Enter Code")}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-center">
            {linkedCode
              ? t("You are using the code: {{code}}", {
                  code: linkedCode.code,
                })
              : t("Link an invite code to your account.")}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {!walletAddress || linkedCode ? null : (
          <LinkCodeForm
            key={initialCode || "manual"}
            address={walletAddress}
            initialCode={initialCode}
            onLinked={onLinked}
          />
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

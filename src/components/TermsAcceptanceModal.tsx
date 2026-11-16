import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { toast } from "sonner";
import { useAccount, useConfig } from "wagmi";
import type { Hex } from "viem";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { useSupportedChainId } from "@/hooks/useSupportedChainId";
import { useSwitchToSupportedChain } from "@/hooks/useSwitchToSupportedChain";
import { useTargetChain } from "@/hooks/useTargetChain";
import { useAuth } from "@/hooks/useAuth";
import { partner } from "@/config/partners";
import { signTermsAcceptance } from "@/utils/signing";
import {
  hasAcceptedTermsInState,
  useFirstInteractionStore,
} from "@/stores/firstInteractionStore";
import { ReferralAutoLink } from "./ReferralAutoLink";

interface AcceptTermsResult {
  address: string;
  chainId: number;
  signature: Hex;
  timestamp: number;
}

function PolicyLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-content"
    >
      {children}
    </a>
  );
}

export function TermsAcceptanceModal() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const accepted = useFirstInteractionStore((state) =>
    hasAcceptedTermsInState(state.termsAcceptances, address),
  );

  const open =
    !!address &&
    isConnected &&
    !isConnecting &&
    !isReconnecting &&
    !accepted;

  return (
    <>
      <Dialog open={open}>
        <TermsAcceptanceDialog key={address} />
      </Dialog>
      <ReferralAutoLink />
    </>
  );
}

function TermsAcceptanceDialog() {
  const { t } = useTranslation();
  const config = useConfig();
  const { address, isConnected } = useAccount();
  const chainId = useSupportedChainId();
  const targetChain = useTargetChain();
  const {
    isSwitching,
    shouldSwitchChain,
    switchChainName,
    switchToSupportedChain,
  } = useSwitchToSupportedChain();
  const { logout, isDisconnecting } = useAuth();
  const markTermsAccepted = useFirstInteractionStore(
    (state) => state.markTermsAccepted,
  );
  const [termsChecked, setTermsChecked] = useState(false);
  const [cookiesChecked, setCookiesChecked] = useState(false);
  const acceptTermsMutation = useMutation<
    AcceptTermsResult,
    Error,
    void
  >({
    mutationFn: async () => {
      if (!address || !isConnected) {
        throw new Error(t("Connect wallet"));
      }
      if (shouldSwitchChain) {
        throw new Error(t("Switch to supported chain first"));
      }
      if (!chainId) {
        throw new Error(t("Wallet chain is still loading"));
      }

      const timestamp = Date.now();
      const signature = await signTermsAcceptance({
        config,
        chainId,
        chainName: targetChain?.name ?? "Mainnet",
        timestamp: BigInt(timestamp),
      });

      return {
        address,
        chainId,
        signature,
        timestamp,
      };
    },
    onSuccess: (acceptedTerms) => {
      markTermsAccepted(acceptedTerms);
      toast.success(t("Terms accepted"), {
        duration: 5000,
      });
    },
    onError: () => {
      toast.error(t("Terms acceptance failed"), {
        duration: 5000,
      });
    },
  });
  const isSigning = acceptTermsMutation.isPending;
  const isAcceptActionPending = isSigning || isSwitching || isDisconnecting;
  const canAcceptTerms =
    !!address &&
    isConnected &&
    (shouldSwitchChain || !!chainId) &&
    termsChecked &&
    cookiesChecked &&
    !isAcceptActionPending;

  const handleAccept = () => {
    if (shouldSwitchChain) {
      void switchToSupportedChain();
      return;
    }

    acceptTermsMutation.mutate();
  };

  return (
    <DialogContent
      showCloseButton={false}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onEscapeKeyDown={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
      className="w-[min(calc(100vw-32px),560px)] max-w-none rounded-xl px-5 py-6 outline-none focus:outline-none focus-visible:outline-none sm:px-8 sm:py-8"
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <DialogTitle>
            {t("Terms of Use, Privacy Policy, and Cookie Policy")}
          </DialogTitle>
          <DialogDescription>
            {t("To proceed, review and accept the following:")}
          </DialogDescription>
        </div>

        <div className="space-y-4 text-[13px] font-medium leading-relaxed text-content-secondary sm:text-[14px]">
          <label className="flex items-start gap-3">
            <Checkbox
              aria-label={t("Accept Terms of Use and Privacy Policy")}
              checked={termsChecked}
              onCheckedChange={(checked) => setTermsChecked(checked === true)}
              className="relative top-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span>
              {t("You acknowledge that you have read, understood, and agreed to the")}{" "}
              <PolicyLink href={partner.policyUrls.termsOfUse}>
                {t("Terms of Use")}
              </PolicyLink>{" "}
              {t("and")}{" "}
              <PolicyLink href={partner.policyUrls.privacyPolicy}>
                {t("Privacy Policy")}
              </PolicyLink>
              .
            </span>
          </label>

          <label className="flex items-start gap-3">
            <Checkbox
              aria-label={t("Accept Cookie Policy")}
              checked={cookiesChecked}
              onCheckedChange={(checked) => setCookiesChecked(checked === true)}
              className="relative top-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span>
              {t("This site uses cookies to ensure the best user experience. These cookies are strictly necessary or essential for optimal functionality. By using this site, you agree to the cookie policy.")}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => { void logout(); }}
            disabled={isAcceptActionPending}
          >
            {t("Decline")}
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            loading={isAcceptActionPending}
            disabled={!canAcceptTerms}
          >
            {shouldSwitchChain ? (
              <>
                {t("Switch to")} {switchChainName}
              </>
            ) : (
              t("Accept")
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

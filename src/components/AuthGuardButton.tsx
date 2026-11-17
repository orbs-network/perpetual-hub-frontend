import { getCollateralSymbol } from "@/utils/collateralDisplay";
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { Button, type ButtonProps } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { useAuth } from "../hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "./ui/responsive-modal";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useShouldLogin } from "@/hooks/useIsSessionExpired";
import { DEFAULT_STAY_CONNECTED } from "@/lib/authSession";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { useAccount } from "wagmi";
import { useIsWalletChainResolving } from "@/hooks/useSupportedChainId";
import { useShouldShowMobileQrRescanPrompt } from "@/hooks/useShouldShowMobileQrRescanPrompt";
import { useSwitchToSupportedChain } from "@/hooks/useSwitchToSupportedChain";
import { useTargetChain } from "@/hooks/useTargetChain";
import { DepositForm } from "./deposit/DepositForm";
import { useFirstInteractionStore } from "@/stores/firstInteractionStore";

const MOBILE_QR_RESCAN_TEXT = "Enable Trading On Desktop And Scan QR Again";

interface AuthGuardButtonProps {
  children?: ReactNode;
  className?: string;
  variant?: ButtonProps["variant"];
  /** Overrides only Connect and Enable Trading without recoloring other guard states. */
  connectOrEnableVariant?: ButtonProps["variant"];
  /** When true, always renders children but intercepts clicks to trigger auth if not authenticated. */
  passthrough?: boolean;
  showMobileQrRescanMessage?: boolean;
  /** Forces the enable-trading flow even when a local session already exists. */
  forceLogin?: boolean;
  onAuthenticated?: () => void;
}

interface AuthActionButtonProps {
  className: string;
  variant: ButtonProps["variant"];
}

type AuthGuardState =
  | "ready"
  | "hidden-mobile-rescan"
  | "mobile-rescan"
  | "resolving-chain"
  | "switch-chain"
  | "connect"
  | "enable-trading";

function isBlockingAuthGuardState(state: AuthGuardState) {
  return state !== "ready" && state !== "hidden-mobile-rescan";
}

function useAuthGuardState(showMobileQrRescanMessage: boolean): AuthGuardState {
  const isResolvingChain = useIsWalletChainResolving();
  const { isConnected, hasSharedSession } = useAuth();
  const { isAuthenticated } = useAuthSession();
  const shouldLogin = useShouldLogin();
  const mobileQrSessionNeedsRescan = useShouldShowMobileQrRescanPrompt();
  const { shouldSwitchChain } = useSwitchToSupportedChain();

  if (mobileQrSessionNeedsRescan && !showMobileQrRescanMessage) {
    return "hidden-mobile-rescan";
  }

  if (mobileQrSessionNeedsRescan) {
    return "mobile-rescan";
  }

  if (isResolvingChain && !hasSharedSession) {
    return "resolving-chain";
  }

  if (shouldSwitchChain && !hasSharedSession) {
    return "switch-chain";
  }

  if (!isConnected) {
    return "connect";
  }

  if (!isAuthenticated || shouldLogin === true) {
    return "enable-trading";
  }

  return "ready";
}

function MobileQrRescanButton({ className }: { className: string }) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      disabled
      variant="secondary"
      className={cn(
        "mt-5 inline-flex min-h-[33px] items-center justify-center rounded-lg border border-edge bg-hover px-3 py-2 text-center text-[12px] font-medium leading-tight text-content-muted disabled:cursor-not-allowed disabled:opacity-100",
        className,
        "h-auto whitespace-normal",
        className.includes("h-full") && "max-w-60",
      )}
    >
      {t(MOBILE_QR_RESCAN_TEXT)}
    </Button>
  );
}

function ConnectingButton({ className, variant }: AuthActionButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant={variant}
      loading
      className={cn("py-2 font-bold text-sm", className)}
    >
      {t("Connecting...")}
    </Button>
  );
}

function SwitchChainButton({ className, variant }: AuthActionButtonProps) {
  const { t } = useTranslation();
  const { isSwitching, switchChainName, switchToSupportedChain } =
    useSwitchToSupportedChain();

  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => {
        void switchToSupportedChain();
      }}
      loading={isSwitching}
      className={cn("py-2 font-bold text-sm", className)}
    >
      {t("Switch to")} {switchChainName}
    </Button>
  );
}

function ConnectButton({ className, variant }: AuthActionButtonProps) {
  const { t } = useTranslation();
  const { connect, isConnecting } = useAuth();

  return (
    <Button
      type="button"
      variant={variant}
      onClick={connect}
      loading={isConnecting}
      className={cn("py-2 font-bold text-sm", className)}
    >
      {t("Connect")}
    </Button>
  );
}

function EnableTradingButton({
  className,
  onOpen,
  variant,
}: AuthActionButtonProps & {
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { isLoggingIn } = useAuth();

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onOpen}
      loading={isLoggingIn}
      className={cn("py-2 font-bold text-sm", className)}
    >
      {isLoggingIn ? t("Confirm in Wallet") : t("Enable Trading")}
    </Button>
  );
}

/** The deposit prompt shown after a user first enables trading. */
function FirstEnableDepositContent({
  onDepositSuccess,
}: {
  onDepositSuccess: () => void;
}) {
  const { t } = useTranslation();
  const targetChain = useTargetChain();

  return (
    <>
      <ResponsiveModalHeader>
        <ResponsiveModalTitle className="text-center">
          {t("Deposit {{collateralSymbol}} from", { collateralSymbol: getCollateralSymbol() })} {targetChain?.name}
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="sr-only">
          {t("Deposit {{collateralSymbol}} into the trading platform", { collateralSymbol: getCollateralSymbol() })}
        </ResponsiveModalDescription>
      </ResponsiveModalHeader>

      <DepositForm onDepositSuccess={onDepositSuccess} />
    </>
  );
}

function EstablishConnectionContent({
  onStayConnectedChange,
  onSubmit,
  stayConnected,
  isLoggingIn,
}: {
  onStayConnectedChange: (value: boolean) => void;
  onSubmit: () => void;
  stayConnected: boolean;
  isLoggingIn: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <ResponsiveModalHeader>
        <ResponsiveModalTitle className="text-center">
          {t("Establish Connection")}
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="text-center text-sm text-content-muted">
          {t(
            "This signature is gas-free to send. It opens a decentralized channel for gas-free and instantaneous trading.",
          )}
        </ResponsiveModalDescription>
      </ResponsiveModalHeader>

      <div className="p-5 pb-0 space-y-4">
        <label className="flex items-center justify-center gap-2 cursor-pointer">
          <Checkbox
            checked={stayConnected}
            onCheckedChange={(value) => onStayConnectedChange(value === true)}
          />
          <span className="text-sm text-content-muted">
            {t("Stay Connected For 7 Days")}
          </span>
        </label>

        <Button
          variant="default"
          className="w-full"
          loading={isLoggingIn}
          onClick={onSubmit}
        >
          {isLoggingIn ? t("Confirm in Wallet") : t("Establish Connection")}
        </Button>
      </div>
    </>
  );
}

function AuthModal({
  modalOpen,
  onDepositSuccess,
  onEstablishConnection,
  onOpenChange,
  onStayConnectedChange,
  showDepositAfterEnable,
  stayConnected,
  isLoggingIn,
}: {
  modalOpen: boolean;
  onDepositSuccess: () => void;
  onEstablishConnection: () => void;
  onOpenChange: (open: boolean) => void;
  onStayConnectedChange: (value: boolean) => void;
  showDepositAfterEnable: boolean;
  stayConnected: boolean;
  isLoggingIn: boolean;
}) {
  return (
    <ResponsiveModal open={modalOpen} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-lg">
        {showDepositAfterEnable ? (
          <FirstEnableDepositContent
            onDepositSuccess={onDepositSuccess}
          />
        ) : (
          <EstablishConnectionContent
            onStayConnectedChange={onStayConnectedChange}
            onSubmit={onEstablishConnection}
            stayConnected={stayConnected}
            isLoggingIn={isLoggingIn}
          />
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function useEnableTradingModal(onAuthenticated?: () => void) {
  const { address } = useAccount();
  const { login, isLoggingIn } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [showDepositAfterEnable, setShowDepositAfterEnable] = useState(false);
  const [stayConnected, setStayConnected] = useState(DEFAULT_STAY_CONNECTED);
  const shouldShowFirstEnableDepositPrompt = useFirstInteractionStore(
    (state) => state.shouldShowFirstEnableDepositPrompt,
  );
  const markFirstEnableDepositPromptShown = useFirstInteractionStore(
    (state) => state.markFirstEnableDepositPromptShown,
  );

  const handleModalOpenChange = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setTimeout(() => {
        setShowDepositAfterEnable(false);
      }, 1000);
    }
  }, []);

  const handleEnableTradingSuccess = useCallback(() => {
    onAuthenticated?.();

    if (shouldShowFirstEnableDepositPrompt(address)) {
      markFirstEnableDepositPromptShown(address);
      setShowDepositAfterEnable(true);
      return;
    }

    setModalOpen(false);
  }, [
    address,
    markFirstEnableDepositPromptShown,
    onAuthenticated,
    shouldShowFirstEnableDepositPrompt,
  ]);

  const openEnableTradingModal = useCallback(() => {
    setShowDepositAfterEnable(false);
    setModalOpen(true);
  }, []);

  const establishConnection = useCallback(() => {
    login({
      stayConnected,
      onSuccess: handleEnableTradingSuccess,
    });
  }, [handleEnableTradingSuccess, login, stayConnected]);

  return {
    establishConnection,
    handleModalOpenChange,
    isLoggingIn,
    modalOpen,
    openEnableTradingModal,
    setStayConnected,
    showDepositAfterEnable,
    stayConnected,
  };
}

function useAuthPassthroughClick({
  guardState,
  openEnableTradingModal,
}: {
  guardState: AuthGuardState;
  openEnableTradingModal: () => void;
}) {
  const { connect } = useAuth();
  const { switchToSupportedChain } = useSwitchToSupportedChain();

  return useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      switch (guardState) {
        case "switch-chain":
          void switchToSupportedChain();
          break;
        case "connect":
          connect();
          break;
        case "enable-trading":
          openEnableTradingModal();
          break;
        default:
          break;
      }
    },
    [connect, guardState, openEnableTradingModal, switchToSupportedChain],
  );
}

function AuthPassthrough({
  authModal,
  children,
  onClick,
}: {
  authModal: ReactNode;
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const { t } = useTranslation();
  const mobileQrSessionNeedsRescan = useShouldShowMobileQrRescanPrompt();

  return (
    <>
      <div
        onClick={onClick}
        className={
          mobileQrSessionNeedsRescan ? "cursor-not-allowed" : "cursor-pointer"
        }
        title={
          mobileQrSessionNeedsRescan ? t(MOBILE_QR_RESCAN_TEXT) : undefined
        }
      >
        {children}
      </div>
      {authModal}
    </>
  );
}

function AuthGuardAction({
  className,
  connectOrEnableVariant,
  guardState,
  onEnableTradingOpen,
  variant,
}: AuthActionButtonProps & {
  connectOrEnableVariant?: ButtonProps["variant"];
  guardState: AuthGuardState;
  onEnableTradingOpen: () => void;
}) {
  switch (guardState) {
    case "mobile-rescan":
      return <MobileQrRescanButton className={className} />;
    case "resolving-chain":
      return <ConnectingButton className={className} variant={variant} />;
    case "switch-chain":
      return <SwitchChainButton className={className} variant={variant} />;
    case "connect":
      return (
        <ConnectButton
          className={className}
          variant={connectOrEnableVariant ?? variant}
        />
      );
    case "enable-trading":
      return (
        <EnableTradingButton
          className={className}
          onOpen={onEnableTradingOpen}
          variant={connectOrEnableVariant ?? variant}
        />
      );
    case "hidden-mobile-rescan":
    case "ready":
      return null;
  }
}

/**
 * Guards on wallet connection and authentication.
 * - QR-linked mobile session missing → rescan instruction
 * - Not connected → "Connect" button
 * - Not authenticated → "Enable Trading" button + modal
 * - Authenticated → renders children
 */
export function AuthGuardButton({
  children,
  className = "w-full",
  variant = "default",
  connectOrEnableVariant,
  passthrough = false,
  showMobileQrRescanMessage = true,
  forceLogin = false,
  onAuthenticated,
}: AuthGuardButtonProps) {
  const resolvedGuardState = useAuthGuardState(showMobileQrRescanMessage);
  const guardState = forceLogin ? "enable-trading" : resolvedGuardState;
  const needsAuth = isBlockingAuthGuardState(guardState);
  const enableTradingModal = useEnableTradingModal(onAuthenticated);
  const handlePassthroughClick = useAuthPassthroughClick({
    guardState,
    openEnableTradingModal: enableTradingModal.openEnableTradingModal,
  });
  const authModal = (
    <AuthModal
      modalOpen={enableTradingModal.modalOpen}
      onDepositSuccess={() => enableTradingModal.handleModalOpenChange(false)}
      onEstablishConnection={enableTradingModal.establishConnection}
      onOpenChange={enableTradingModal.handleModalOpenChange}
      onStayConnectedChange={enableTradingModal.setStayConnected}
      showDepositAfterEnable={enableTradingModal.showDepositAfterEnable}
      stayConnected={enableTradingModal.stayConnected}
      isLoggingIn={enableTradingModal.isLoggingIn}
    />
  );

  if (passthrough && needsAuth) {
    return (
      <AuthPassthrough authModal={authModal} onClick={handlePassthroughClick}>
        {children}
      </AuthPassthrough>
    );
  }

  return (
    <>
      {needsAuth ? (
        <AuthGuardAction
          className={className}
          connectOrEnableVariant={connectOrEnableVariant}
          guardState={guardState}
          onEnableTradingOpen={enableTradingModal.openEnableTradingModal}
          variant={variant}
        />
      ) : (
        children
      )}
      {authModal}
    </>
  );
}

import { useAccount } from "wagmi";
import { isMobile as isMobileDevice } from "@/config/wagmi";
import { shouldShowMobileQrRescanPrompt } from "@/lib/mobileQrSession";
import { useAppQueryParams } from "./useAppQueryParams";
import { useAuth } from "./useAuth";

export function useShouldShowMobileQrRescanPrompt() {
  const { address: walletAddress } = useAccount();
  const { hasSharedSession } = useAuth();
  const { sharedSession, viewerAddress } = useAppQueryParams();

  return shouldShowMobileQrRescanPrompt({
    hasSharedSession,
    isMobileDevice,
    sharedSession,
    viewerAddress,
    walletAddress,
  });
}

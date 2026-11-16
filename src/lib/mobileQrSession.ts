import type { SharedSession } from "./appQueryParams";

export function shouldShowMobileQrRescanPrompt({
  hasSharedSession,
  isMobileDevice,
  sharedSession,
  viewerAddress,
  walletAddress,
}: {
  hasSharedSession: boolean;
  isMobileDevice: boolean;
  sharedSession: SharedSession | null;
  viewerAddress?: string;
  walletAddress?: string;
}) {
  return (
    isMobileDevice &&
    !walletAddress &&
    !!viewerAddress &&
    !hasSharedSession &&
    !sharedSession
  );
}

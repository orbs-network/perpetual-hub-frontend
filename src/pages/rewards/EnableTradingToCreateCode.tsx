import { AuthGuardButton } from "@/components/AuthGuardButton";

export function EnableTradingToCreateCode({
  forceLogin,
  onEnabled,
}: {
  forceLogin?: boolean;
  onEnabled: () => void;
}) {
  return (
    <div className="p-4">
      <AuthGuardButton
        className="w-full"
        forceLogin={forceLogin}
        onAuthenticated={onEnabled}
      />
    </div>
  );
}

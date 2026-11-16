import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function RewardsActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="h-10 rounded-[8px] px-5 text-[12px] font-semibold"
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant="themedSecondary"
    >
      {children}
    </Button>
  );
}

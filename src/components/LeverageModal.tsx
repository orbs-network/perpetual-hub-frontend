import { useState } from "react";
import { useTranslation } from "@/hooks/useSafeTranslation";
import { Button } from "./ui/button";
import { AuthGuardButton } from "./AuthGuardButton";
import { Slider } from "./ui/slider";
import { NumericInput } from "./ui/numeric-input";
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "./ui/responsive-modal";
import { MIN_LEVERAGE } from "../config/constants";
import { useUpdatePositionLeverage } from "@/hooks/mutations/useUpdatePositionLeverage";
import { useSymbolConfig } from "@/hooks/useSymbolConfig";
import { getDisplaySymbol } from "@/lib/utils";

interface LeverageModalProps {
  leverage: number;
  label?: string;
  trigger?: React.ReactNode;
  symbol?: string | null;
}

export function LeverageModal({
  leverage,
  trigger,
  symbol,
}: LeverageModalProps) {
  const { t } = useTranslation();
  const [internalLev, setInternalLev] = useState(leverage);
  const [open, setOpen] = useState(false);
  const { mutate: changeLeverageForSymbol, isPending } =
    useUpdatePositionLeverage();

  const { maxLeverage } = useSymbolConfig(symbol ?? "");


  const handleChange = (v: number) => {
    setInternalLev(Math.max(MIN_LEVERAGE, Math.min(maxLeverage ?? 0, v)));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setInternalLev(leverage);
    setOpen(nextOpen);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      {trigger && (
        <ResponsiveModalTrigger asChild>{trigger}</ResponsiveModalTrigger>
      )}
      <ResponsiveModalContent className="max-w-[530px]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{t("Adjust Leverage")}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            <p className="text-[13px] text-center mt-2 w-full" >
              {t("Control the leverage used for")} {getDisplaySymbol(symbol || "")}{" "}
              {t("positions. The maximum leverage is")} <strong>{maxLeverage}{t("x.")}</strong>
            </p>
            <p className="text-[13px] text-center mt-2 w-full" >
              {t("Max position size decreases the higher your leverage.")}
            </p>
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="p-4 space-y-7">
          <div className="flex items-center gap-2">
            <Slider
              min={MIN_LEVERAGE}
              max={maxLeverage}
              step={1}
              value={[internalLev]}
              onValueChange={([v]) => handleChange(v)}
              showDots
              className="flex-1"
            />
            <NumericInput
              size="sm"
              value={internalLev}
              onValueChange={(values, sourceInfo) => {
                if (sourceInfo.source !== "event") return;
                handleChange(Math.round(values.floatValue ?? MIN_LEVERAGE));
              }}
              decimalScale={0}
              suffix="x"
              className={`px-1.5 text-center w-[68px] h-[32px] !text-[14px] md:!text-[14px]`}
            />
          </div>

          <AuthGuardButton className="w-full">
            <Button
              type="button"
              variant="default"
              loading={isPending}
              className="w-full"
              onClick={() =>
                changeLeverageForSymbol({
                  symbol,
                  leverage: internalLev,
                  onSuccess: () => setOpen(false),
                })
              }
            >
              {t("Confirm")}</Button>
          </AuthGuardButton>
        </div>
        <ResponsiveModalFooter>
        <div className="w-full rounded-xl border border-warning/40 bg-warning/10 p-3 text-center text-[13px] text-content-muted">
          <p className="w-full text-center text-warning">
            {t("Note That Setting A Higher Leverage Increases The Risk Of Liquidation.")}
          </p>
        </div>

        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAccount } from "wagmi";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "./ui/responsive-modal";
import { SessionParam } from "@/lib/appQueryParams";
import { useAuthSession } from "@/hooks/useAuthSession";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useTranslation } from "@/hooks/useSafeTranslation";

const REVEAL_HOLD_MS = 4000;

function buildSessionUrl(
  address: string,
  sessionKey: string,
  sessionPublicKey: string,
  sessionExpiresAt: number,
  loginSignature?: string | null,
  loginTimestamp?: number | null,
) {
  const encoded = SessionParam.encode({
    address,
    sessionKey,
    sessionPublicKey,
    sessionExpiresAt,
    loginSignature: loginSignature ?? undefined,
    loginTimestamp: loginTimestamp ?? undefined,
  });
  const url = new URL(window.location.href);
  // Remove existing viewer / session params
  url.searchParams.delete("v");
  url.searchParams.delete("s");
  url.searchParams.delete("address");
  url.searchParams.delete("user");
  url.searchParams.set("s", encoded as string);
  return url.toString();
}

export function ShareQRModal({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation();
  const { address } = useAccount();
  const {
    loginSignature,
    loginTimestamp,
    sessionKey,
    sessionPublicKey,
    sessionExpiresAt,
  } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [holding, setHolding] = useState(false);
  const revealTimerRef = useRef<number | null>(null);

  const sessionUrl = useMemo(() => {
    if (
      !address ||
      !sessionKey ||
      !sessionPublicKey ||
      sessionExpiresAt == null
    )
      return null;
    return buildSessionUrl(
      address,
      sessionKey,
      sessionPublicKey,
      sessionExpiresAt,
      loginSignature,
      loginTimestamp,
    );
  }, [
    address,
    loginSignature,
    loginTimestamp,
    sessionKey,
    sessionPublicKey,
    sessionExpiresAt,
  ]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    setTimeout(() => {
      if (!nextOpen) {
        clearRevealTimer();
        setHolding(false);
        setRevealed(false);
      }
    }, 1000);
  }, [clearRevealTimer]);

  const startRevealHold = useCallback(() => {
    if (revealed) return;
    clearRevealTimer();
    setHolding(true);
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      setHolding(false);
      setRevealed(true);
    }, REVEAL_HOLD_MS);
  }, [clearRevealTimer, revealed]);

  const cancelRevealHold = useCallback(() => {
    clearRevealTimer();
    setHolding(false);
  }, [clearRevealTimer]);

  useEffect(() => {
    return () => {
      clearRevealTimer();
    };
  }, [clearRevealTimer]);

  if (!address || !sessionUrl) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalTrigger asChild>{trigger}</ResponsiveModalTrigger>
      <ResponsiveModalContent className="max-w-[520px] border-edge bg-modal-bg px-6 py-7">
        <ResponsiveModalHeader className="space-y-3 text-center">
          <ResponsiveModalTitle className="text-lg font-semibold text-content">
            {t("Link Mobile Device")}</ResponsiveModalTitle>
          <p className="mx-auto text-[12px] leading-4 text-content-muted">
            {t("Scan the QR code with your mobile device to link your account.")}
          </p>
        </ResponsiveModalHeader>

        <div className="flex flex-col gap-6 pt-2">
          {revealed && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-white p-3 shadow-lg shadow-black/20">
                <QRCodeSVG value={sessionUrl} size={200} level="M" />
              </div>
            </div>
          )}

          {!revealed && (
            <Button
              variant="default"
              aria-pressed={holding}
              aria-label={t("Hold for 4 seconds to reveal QR code")}
              className={cn(
                "relative flex h-10 w-full select-none items-center justify-center gap-2 overflow-hidden rounded-lg text-[12px] font-medium  transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99]",
              )}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                startRevealHold();
              }}
              onPointerUp={cancelRevealHold}
              onPointerCancel={cancelRevealHold}
              onPointerLeave={cancelRevealHold}
              onBlur={cancelRevealHold}
              onKeyDown={(event) => {
                if (event.repeat) return;
                if (event.key === " " || event.key === "Enter") {
                  startRevealHold();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  cancelRevealHold();
                }
              }}
            >
              <span
                className="absolute inset-y-0 left-0 w-full origin-left bg-content-inverse/25"
                style={{
                  transform: holding ? "scaleX(1)" : "scaleX(0)",
                  transition: holding
                    ? `transform ${REVEAL_HOLD_MS}ms linear`
                    : "transform 120ms ease-out",
                }}
              />
              <span
                className={cn(
                  "relative z-10 h-4 w-4 rounded-full border-2 border-content-inverse bg-transparent transition-colors",
                  holding && "bg-content-inverse/50",
                )}
              />
              <span className="relative z-10">{t("Hold 4s To Reveal")}</span>
            </Button>
          )}

          <section className="rounded border border-edge bg-base/60 px-4 py-3 text-left">
            <h3 className="text-[12px] font-semibold text-content">
              {t("Disconnecting mobile access")}
            </h3>
            <p className="mt-1 text-[12px] leading-4 text-content-secondary">
              {t("To disconnect this mobile trading session, disconnect your wallet on desktop and connect again. Reveal and scan a new QR code if you want to use mobile trading again.")}
            </p>
          </section>

          <ResponsiveModalFooter>
            <p className="text-center text-[12px] text-content-secondary">
              {t("The QR code enables mobile trading, but not deposits and withdrawals. Do not share this QR code or screenshots of it with others. Make sure you are not sharing your screen.")}
            </p>
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { snapdom } from "@zumer/snapdom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { partner } from "@/config/partners";
import type { Position } from "@/types";
import { HIDDEN_PNL_TEXT } from "@/lib/pnlPrivacy";
import { cn, safeUpperCase } from "@/lib/utils";
import { useFormatSymbolAmount } from "@/hooks/useFormatting";
import { useIsMobile } from "@/hooks/useIsMobile";
import { toast } from "sonner";
import { TokenLogo } from "@/components/ui/token-logo";
import { useTranslation } from "@/hooks/useSafeTranslation";

interface PositionShareModalProps {
  trigger: ReactNode;
  position: Position;
  isLong: boolean;
  leverage: number;
  symbolShort: string;
  markPrice?: number;
  pnl: {
    formatted: string;
    pctStr: string;
    isPositive: boolean;
  } | null;
  hidePnl: boolean;
}

type ShareArrowDirection = "up" | "down" | "neutral";

function stripPairLabel(symbol: string) {
  return symbol.replace(/USDT$|USDC$/i, "");
}

function getReferralUrl() {
  if (typeof window === "undefined") return "/join/";
  return `${window.location.origin}/join/`;
}

function getShareUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

function getShareArrowDirection(
  hidePnl: boolean,
  pnl: PositionShareModalProps["pnl"],
): ShareArrowDirection {
  if (hidePnl || !pnl) return "neutral";
  return pnl.isPositive ? "up" : "down";
}

function ShareCardBackground({ direction }: { direction: ShareArrowDirection }) {
  const arrowPath =
    "M555 170 L623 250 C632 261 625 278 610 278 H580 V320 C580 329 573 336 564 336 H546 C537 336 530 329 530 320 V278 H500 C485 278 478 261 487 250 Z";
  const strokeColor =
    direction === "down"
      ? "rgb(var(--color-down))"
      : direction === "up"
        ? "rgb(var(--color-up))"
        : "rgb(var(--color-accent-primary))";
  const arrowTransform = direction === "down" ? "rotate(180 555 260)" : undefined;
  const contourScales = [1, 1.12, 1.24, 1.36, 1.48, 1.6, 1.72, 1.84];
  const ringRadii = [92, 116, 140, 164, 188, 212, 236, 260, 284, 308];

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 760 520"
    >
      <defs>
        <linearGradient id="share-card-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--color-base))" />
          <stop offset="56%" stopColor="rgb(var(--color-surface))" />
          <stop offset="100%" stopColor="rgb(var(--color-raised))" />
        </linearGradient>
        <radialGradient id="share-card-glow" cx="74%" cy="50%" r="54%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.16" />
          <stop offset="55%" stopColor={strokeColor} stopOpacity="0.05" />
          <stop offset="100%" stopColor="rgb(var(--color-base))" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="760" height="520" fill="url(#share-card-bg)" />
      <rect width="760" height="520" fill="url(#share-card-glow)" />

      <g opacity="0.42">
        {ringRadii.map((radius, index) => (
          <ellipse
            key={radius}
            cx="555"
            cy="260"
            rx={radius * 1.08}
            ry={radius}
            fill="none"
            stroke={strokeColor}
            strokeOpacity={0.38 - index * 0.024}
            strokeWidth="1"
          />
        ))}
      </g>

      {direction !== "neutral" ? (
        <g data-testid={`position-share-arrow-${direction}`} transform={arrowTransform}>
          {contourScales.map((scale, index) => (
            <path
              key={scale}
              d={arrowPath}
              fill="none"
              stroke={strokeColor}
              strokeOpacity={0.52 - index * 0.045}
              strokeWidth="1.2"
              transform={`translate(555 260) scale(${scale}) translate(-555 -260)`}
            />
          ))}
          <path
            d={arrowPath}
            fill="none"
            stroke={strokeColor}
            strokeOpacity="0.92"
            strokeWidth="1.8"
          />
        </g>
      ) : null}
    </svg>
  );
}

async function renderElementToPng(element: HTMLElement) {
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    throw new Error("Share card is not visible");
  }

  const scale = Math.max(2, window.devicePixelRatio || 1);
  return snapdom.toBlob(element, {
    backgroundColor: partner.theme.surface,
    embedFonts: true,
    height: Math.round(height * scale),
    type: "png",
    width: Math.round(width * scale),
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function PositionShareModal({
  trigger,
  position,
  isLong,
  leverage,
  symbolShort,
  markPrice,
  pnl,
  hidePnl,
}: PositionShareModalProps) {
  const { t } = useTranslation();
  const isSavingImageRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const formatSymbolAmount = useFormatSymbolAmount();
  const referralUrl = useMemo(() => getReferralUrl(), []);
  const shareUrl = getShareUrl();
  const side = isLong ? "Long" : "Short";
  const translatedSide = safeUpperCase(t(side));
  const sideBadge = `${translatedSide} ${leverage}x`;
  const displaySymbol = stripPairLabel(symbolShort || position.symbol);
  const entryPrice = formatSymbolAmount(position.entryPrice, position.symbol, "domainPrice");
  const displayMarkPrice =
    markPrice === undefined ? "--" : formatSymbolAmount(markPrice, position.symbol);
  const arrowDirection = getShareArrowDirection(hidePnl, pnl);
  const pnlText = hidePnl
    ? HIDDEN_PNL_TEXT
    : pnl?.pctStr.replace(/[()]/g, "").replace(/^\+/, "").trim() || "--";
  const pnlColor = hidePnl
    ? "text-content-muted"
    : pnl?.isPositive
    ? "text-up"
    : "text-down";
  const defaultShareText = t("Trade {{symbol}} perps on @{{partner}} using my link", {
    symbol: `$${displaySymbol}`,
    partner: partner.name.replace(/\s+/g, ""),
  });
  const [shareText, setShareText] = useState(defaultShareText);
  const previousDefaultShareTextRef = useRef(defaultShareText);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (shareText === previousDefaultShareTextRef.current) {
      setShareText(defaultShareText);
    }
    previousDefaultShareTextRef.current = defaultShareText;
  }, [defaultShareText, shareText]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl || referralUrl);
      toast.success(t("Link copied"));
    } catch {
      toast.error(t("Failed to copy link"));
    }
  };

  const shareOnX = () => {
    const url = new URL("https://twitter.com/intent/tweet");
    url.searchParams.set("text", shareText);
    url.searchParams.set("url", shareUrl || referralUrl);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const saveImage = async () => {
    if (!cardRef.current || isSavingImageRef.current) return;

    isSavingImageRef.current = true;
    try {
      const blob = await renderElementToPng(cardRef.current);
      downloadBlob(blob, `${displaySymbol.toLowerCase()}-position-share.png`);
      toast.success(t("Image saved"));
    } catch {
      toast.error(t("Failed to save image"));
    } finally {
      isSavingImageRef.current = false;
    }
  };

  const shareContent = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,760px)_328px] lg:gap-8">
      <div
        ref={cardRef}
        data-testid="position-share-card"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-accent-primary/20 bg-surface p-4 sm:aspect-[760/520] sm:rounded-2xl sm:p-8"
      >
        <ShareCardBackground direction={arrowDirection} />

        <div className="relative z-10 flex items-center gap-2 text-[18px] font-semibold text-content sm:gap-3 sm:text-[28px]">
          <img
            src={partner.wordmarkUrl ?? partner.logoUrl}
            alt={partner.wordmarkUrl ? partner.name : ""}
            className={partner.wordmarkUrl
              ? "h-6 w-auto max-w-full object-contain sm:h-8"
              : "h-6 w-6 sm:h-8 sm:w-8"}
          />
          {!partner.wordmarkUrl && <span>{partner.name}</span>}
        </div>

        <div className="relative z-10 mt-8 flex items-center gap-2 sm:mt-20 sm:gap-3">
          <TokenLogo
            symbol={displaySymbol}
            className="h-6 w-6 sm:h-8 sm:w-8"
            fallbackClassName="text-[12px] sm:text-[14px]"
            backgroundMode="auto"
          />
          <span className="text-[16px] font-semibold text-content sm:text-[22px]">
            {displaySymbol}
          </span>
          <span className="rounded bg-accent-primary/25 px-2 py-0.5 text-[13px] font-semibold text-accent-primary sm:px-2.5 sm:py-1 sm:text-[18px]">
            {sideBadge}
          </span>
        </div>

        <div className={cn("relative z-10 mt-4 text-[42px] font-light leading-none sm:mt-8 sm:text-[76px]", pnlColor)}>
          {pnlText}
        </div>

        <div className="relative z-10 mt-6 grid max-w-[330px] grid-cols-2 gap-4 sm:mt-12 sm:gap-8">
          <div>
            <div className="text-[11px] font-semibold text-content-muted sm:text-[18px]">{t("Entry Price")}</div>
            <div className="mt-1 text-[13px] font-semibold text-content sm:mt-2 sm:text-[20px]">{entryPrice}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-content-muted sm:text-[18px]">{t("Mark Price")}</div>
            <div className="mt-1 text-[13px] font-semibold text-content sm:mt-2 sm:text-[20px]">{displayMarkPrice}</div>
          </div>
        </div>

        <div className="relative z-10 mt-6 hidden sm:block">
          <div className="text-[18px] font-semibold text-content-muted">{t("Referral Code:")}</div>
          <div className="mt-2 max-w-[420px] truncate text-[20px] font-medium text-content">
            {referralUrl}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-lg border border-edge/70 bg-raised/30 p-3 lg:min-h-[520px] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
        <div>
          <div className="text-[12px] font-semibold text-content-muted">{t("Referral Code:")}</div>
          <div className="mt-1 break-all text-[12px] font-semibold text-content">{referralUrl}</div>
        </div>

        <label className="mt-4 block lg:mt-8">
          <span className="text-[12px] font-semibold text-content-muted">{t("Customize your text")}</span>
          <input
            value={shareText}
            onChange={(event) => setShareText(event.target.value)}
            className="mt-2 h-10 w-full rounded border border-edge bg-transparent px-3 text-[12px] font-semibold text-content outline-none transition-colors focus:border-accent-primary"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:mt-auto lg:pt-8">
          <Button type="button" onClick={saveImage} className="w-full">
            <Download size={14} />
            {t("Save Image")}
          </Button>
          <Button type="button" onClick={copyLink} className="w-full">
            <Link2 size={14} />
            {t("Copy Link")}
          </Button>
          <Button type="button" onClick={shareOnX} className="col-span-2 w-full">
            <Share2 size={14} />
            {t("Share on X")}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer shouldScaleBackground={false}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          showBottomInset={false}
          className="max-h-[calc(100dvh-8px)] overflow-y-auto bg-modal-bg p-0"
        >
          <DrawerTitle className="sr-only">{t("Share Position")}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {t("Share a visual summary of this open position.")}
          </DrawerDescription>
          <div className="px-3 pb-3">
            {shareContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
        className="max-h-[calc(100dvh-32px)] max-w-[1180px] overflow-y-auto bg-modal-bg p-6 pt-12 sm:pt-8"
      >
        <DialogTitle className="sr-only">{t("Share Position")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("Share a visual summary of this open position.")}
        </DialogDescription>
        {shareContent}
      </DialogContent>
    </Dialog>
  );
}

/* eslint-disable react-hooks/set-state-in-effect */
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getCryptoLogoPlaceholderUrl, getCryptoLogoUrls } from "@/utils/config";
import { Avatar, AvatarFallback } from "./avatar";
import { cn, safeUpperCase } from "@/lib/utils";

interface TokenLogoProps {
  symbol?: string;
  className?: string;
  fallbackClassName?: string;
  backgroundMode?: "none" | "auto" | "light";
  preloadedSrc?: string;
}

const lightLogoImageStyle = {
  objectFit: "contain",
  transform: "scale(0.86)",
} as const;

const DARK_LOGO_LUMINANCE_THRESHOLD = 0.48;
const DARK_PIXEL_LUMINANCE_THRESHOLD = 0.38;

const knownDarkLogoSymbols = new Set([
  "APT",
  "ATOM",
  "ETH",
  "ETC",
  "ETHFI",
  "ETHW",
  "HBAR",
  "IOTA",
  "LTC",
  "MKR",
  "NEAR",
  "QNT",
  "STX",
  "TAO",
  "XLM",
  "XMR",
  "XRP",
  "ZEC",
  "ZEN",
  "ZK",
  "ZRO",
]);

const logoBackgroundCache = new Map<
  string,
  Promise<boolean | null> | boolean | null
>();

function normalizeLogoSymbol(symbol?: string) {
  return safeUpperCase(symbol).replace(/[^A-Z0-9]/g, "");
}

function getKnownDarkLogoFallback(symbol?: string) {
  return knownDarkLogoSymbols.has(normalizeLogoSymbol(symbol));
}

function getLogoPixelLuminance(red: number, green: number, blue: number) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function imageDataNeedsLightBackground(imageData: ImageData) {
  const { data } = imageData;
  let visibleWeight = 0;
  let weightedLuminance = 0;
  let darkWeight = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 24) continue;

    const weight = alpha / 255;
    const luminance = getLogoPixelLuminance(
      data[index],
      data[index + 1],
      data[index + 2],
    );

    visibleWeight += weight;
    weightedLuminance += luminance * weight;
    if (luminance < DARK_PIXEL_LUMINANCE_THRESHOLD) {
      darkWeight += weight;
    }
  }

  if (visibleWeight < 4) return false;

  const averageLuminance = weightedLuminance / visibleWeight;
  const darkPixelShare = darkWeight / visibleWeight;

  return (
    averageLuminance < DARK_LOGO_LUMINANCE_THRESHOLD &&
    darkPixelShare >= 0.35
  );
}

function canInspectLogoPixels(src: string) {
  if (typeof window === "undefined") return false;
  if (src.startsWith("data:") || src.startsWith("blob:")) return true;

  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function detectImageNeedsLightBackground(src: string) {
  if (!src || typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  if (!canInspectLogoPixels(src)) {
    return Promise.resolve(null);
  }

  const cached = logoBackgroundCache.get(src);
  if (cached instanceof Promise) return cached;
  if (cached !== undefined) return Promise.resolve(cached);

  const detection = new Promise<boolean | null>((resolve) => {
    const image = new Image();
    image.decoding = "async";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(
          imageDataNeedsLightBackground(
            context.getImageData(0, 0, canvas.width, canvas.height),
          ),
        );
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = src;
  }).then((result) => {
    logoBackgroundCache.set(src, result);
    return result;
  });

  logoBackgroundCache.set(src, detection);
  return detection;
}

function isGeneratedLogoSource(src: string) {
  return src.startsWith("data:image/svg+xml,");
}

function getLogoSourceKey(logoSources: readonly string[]) {
  return logoSources.join("\n");
}

function getImageEventSrc(event: SyntheticEvent<HTMLImageElement>) {
  return (
    event.currentTarget.getAttribute("src") ||
    event.currentTarget.currentSrc ||
    event.currentTarget.src
  );
}

function useAutoLightBackground({
  backgroundMode,
  symbol,
  src,
}: {
  backgroundMode: TokenLogoProps["backgroundMode"];
  symbol?: string;
  src: string;
}) {
  const [autoLightBackground, setAutoLightBackground] = useState(
    () => backgroundMode === "auto" && getKnownDarkLogoFallback(symbol),
  );

  useEffect(() => {
    if (backgroundMode !== "auto") {
      setAutoLightBackground(false);
      return;
    }

    let active = true;
    const fallback = getKnownDarkLogoFallback(symbol);
    setAutoLightBackground(fallback);

    void detectImageNeedsLightBackground(src).then((needsLightBackground) => {
      if (!active || needsLightBackground === null) return;
      setAutoLightBackground(needsLightBackground);
    });

    return () => {
      active = false;
    };
  }, [backgroundMode, src, symbol]);

  return autoLightBackground;
}

type LogoSourceState = {
  preloadedSrc?: string;
  sourceIndex: number;
  sourceKey: string;
};

function getPreferredLogoSourceIndex(
  logoSources: readonly string[],
  preloadedSrc?: string,
) {
  if (!preloadedSrc) return 0;
  const index = logoSources.indexOf(preloadedSrc);
  return index >= 0 ? index : 0;
}

function useResolvedLogoSource(symbol?: string, preloadedSrc?: string) {
  const logoSources = useMemo(() => getCryptoLogoUrls(symbol ?? ""), [symbol]);
  const sourceKey = useMemo(() => getLogoSourceKey(logoSources), [logoSources]);
  const preferredSourceIndex = useMemo(
    () => getPreferredLogoSourceIndex(logoSources, preloadedSrc),
    [logoSources, preloadedSrc],
  );
  const [sourceState, setSourceState] = useState<LogoSourceState>(() => ({
    preloadedSrc,
    sourceIndex: preferredSourceIndex,
    sourceKey,
  }));
  const sourceIndex =
    sourceState.sourceKey === sourceKey &&
    sourceState.preloadedSrc === preloadedSrc
      ? sourceState.sourceIndex
      : preferredSourceIndex;
  const src = logoSources[sourceIndex] ?? "";
  const imageUnavailable = sourceIndex >= logoSources.length;
  const [loadedSrc, setLoadedSrc] = useState(() =>
    isGeneratedLogoSource(src) || src === preloadedSrc ? src : "",
  );
  const isImageVisible =
    !!src && (loadedSrc === src || isGeneratedLogoSource(src));

  useEffect(() => {
    setSourceState({
      preloadedSrc,
      sourceIndex: preferredSourceIndex,
      sourceKey,
    });
  }, [preloadedSrc, preferredSourceIndex, sourceKey]);

  useEffect(() => {
    if (!src) {
      setLoadedSrc("");
      return;
    }

    setLoadedSrc(isGeneratedLogoSource(src) || src === preloadedSrc ? src : "");
  }, [preloadedSrc, src]);

  const markSourceFailed = useCallback(
    (failedSrc: string) => {
      if (src && failedSrc && failedSrc !== src) return;

      setSourceState((current) => {
        const currentIndex =
          current.sourceKey === sourceKey &&
          current.preloadedSrc === preloadedSrc
            ? current.sourceIndex
            : preferredSourceIndex;
        const nextIndex =
          currentIndex < logoSources.length - 1
            ? currentIndex + 1
            : logoSources.length;

        return { preloadedSrc, sourceIndex: nextIndex, sourceKey };
      });

      setLoadedSrc("");
    },
    [logoSources.length, preferredSourceIndex, preloadedSrc, sourceKey, src],
  );

  const markSourceLoaded = useCallback(
    (loadedImageSrc: string) => {
      if (!src || loadedImageSrc !== src) return;

      setLoadedSrc(src);
    },
    [src],
  );

  return {
    imageUnavailable,
    isImageVisible,
    markSourceFailed,
    markSourceLoaded,
    sourceIndex,
    src,
  };
}

export function TokenLogo({
  symbol,
  className,
  fallbackClassName,
  backgroundMode = "none",
  preloadedSrc,
}: TokenLogoProps) {
  const placeholderSrc = useMemo(
    () => getCryptoLogoPlaceholderUrl(symbol ?? ""),
    [symbol],
  );
  const {
    imageUnavailable,
    isImageVisible,
    markSourceFailed,
    markSourceLoaded,
    sourceIndex,
    src,
  } = useResolvedLogoSource(symbol, preloadedSrc);
  const autoLightBackground = useAutoLightBackground({
    backgroundMode,
    symbol,
    src,
  });
  const useLightBackground =
    backgroundMode === "light" ||
    (backgroundMode === "auto" &&
      (autoLightBackground || sourceIndex > 0 || imageUnavailable));
  const showPlaceholder = !isImageVisible;
  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      markSourceLoaded(getImageEventSrc(event));
    },
    [markSourceLoaded],
  );
  const handleError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      markSourceFailed(getImageEventSrc(event));
    },
    [markSourceFailed],
  );

  return (
    <Avatar
      className={cn(
        "shrink-0",
        useLightBackground && "bg-white ring-1 ring-black/10",
        className,
      )}
    >
      {src && (
        <img
          key={src}
          src={src}
          alt={symbol ?? ""}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "absolute inset-0 z-10 aspect-square h-full w-full rounded-full transition-opacity duration-100",
            isImageVisible ? "opacity-100" : "opacity-0",
          )}
          style={useLightBackground ? lightLogoImageStyle : undefined}
        />
      )}
      <AvatarFallback
        className={cn(
          useLightBackground ? "bg-white text-black" : "bg-active text-content",
          "absolute inset-0 z-0 font-bold transition-opacity duration-100",
          showPlaceholder ? "opacity-100" : "opacity-0",
          placeholderSrc && "p-0",
          fallbackClassName,
        )}
      >
        {placeholderSrc ? (
          <img
            src={placeholderSrc}
            alt=""
            aria-hidden="true"
            className="h-full w-full"
            style={useLightBackground ? lightLogoImageStyle : undefined}
          />
        ) : (
          symbol?.charAt(0)
        )}
      </AvatarFallback>
    </Avatar>
  );
}

import { useLayoutEffect, useRef } from "react";

type FillAvailableHeightOptions = {
  bottomOffset?: number;
  cssProperty: `--${string}`;
  enabled: boolean;
  minHeight?: number;
};

export function useFillAvailableHeight<T extends HTMLElement>({
  bottomOffset = 50,
  cssProperty,
  enabled,
  minHeight = 260,
}: FillAvailableHeightOptions) {
  const elementRef = useRef<T | null>(null);

  useLayoutEffect(() => {
    if (!enabled) return;

    const element = elementRef.current;
    if (!element || typeof window === "undefined") return;

    let lastPhysicalViewportHeight = -1;
    let lastElementTop = Number.NaN;
    let lastFillHeight = -1;
    const measureFillHeight = () => {
      const elementTop = element.getBoundingClientRect().top;
      const physicalViewportHeight =
        window.innerHeight * window.devicePixelRatio;
      if (
        physicalViewportHeight === lastPhysicalViewportHeight &&
        elementTop === lastElementTop
      ) {
        return;
      }
      lastPhysicalViewportHeight = physicalViewportHeight;
      lastElementTop = elementTop;
      const fillHeight = Math.max(
        minHeight,
        Math.floor(window.innerHeight - elementTop - bottomOffset),
      );
      if (fillHeight === lastFillHeight) return;
      lastFillHeight = fillHeight;
      element.style.setProperty(cssProperty, `${fillHeight}px`);
    };
    const updateFillHeight = () => measureFillHeight();

    measureFillHeight();
    window.addEventListener("resize", updateFillHeight);
    window.addEventListener("orientationchange", updateFillHeight);

    return () => {
      window.removeEventListener("resize", updateFillHeight);
      window.removeEventListener("orientationchange", updateFillHeight);
    };
  }, [bottomOffset, cssProperty, enabled, minHeight]);

  return elementRef;
}

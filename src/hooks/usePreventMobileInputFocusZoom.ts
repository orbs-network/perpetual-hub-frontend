import { useEffect } from "react";

const MIN_FOCUS_ZOOM_FONT_SIZE_PX = 16;
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isMobileViewport() {
  return (
    window.innerWidth <= 1000 ||
    window.navigator.maxTouchPoints > 0 ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches)
  );
}

function getEditableControl(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const element = target.closest("input, select, textarea");
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    )
  ) {
    return null;
  }

  if (element.disabled) {
    return null;
  }

  if (
    (element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement) &&
    element.readOnly
  ) {
    return null;
  }

  if (
    element instanceof HTMLInputElement &&
    NON_TEXT_INPUT_TYPES.has(element.type)
  ) {
    return null;
  }

  return element;
}

function hasSmallFont(element: HTMLElement) {
  const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
  return Number.isFinite(fontSize) && fontSize < MIN_FOCUS_ZOOM_FONT_SIZE_PX;
}

function getViewportMeta() {
  return document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
}

function withViewportZoomGuard(content: string) {
  const overrides = new Map([
    ["maximum-scale", "1"],
    ["user-scalable", "no"],
  ]);
  const seen = new Set<string>();
  const parts = content
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [rawKey] = part.split("=");
      const key = rawKey.trim().toLowerCase();
      const nextValue = overrides.get(key);
      if (nextValue === undefined) {
        return part;
      }

      seen.add(key);
      return `${rawKey.trim()}=${nextValue}`;
    });

  for (const [key, value] of overrides) {
    if (!seen.has(key)) {
      parts.push(`${key}=${value}`);
    }
  }

  return parts.join(", ");
}

export function usePreventMobileInputFocusZoom() {
  useEffect(() => {
    let originalViewportContent: string | null = null;
    let restoreTimeout: number | null = null;

    const shouldGuardControl = (target: EventTarget | null) => {
      const element = getEditableControl(target);
      return Boolean(element && isMobileViewport() && hasSmallFont(element));
    };

    const applyGuard = (event: Event) => {
      if (!shouldGuardControl(event.target)) {
        return;
      }

      const viewportMeta = getViewportMeta();
      if (!viewportMeta) {
        return;
      }

      if (restoreTimeout !== null) {
        window.clearTimeout(restoreTimeout);
        restoreTimeout = null;
      }

      if (originalViewportContent === null) {
        originalViewportContent = viewportMeta.content;
      }

      viewportMeta.content = withViewportZoomGuard(originalViewportContent);
    };

    const restoreGuard = () => {
      if (restoreTimeout !== null) {
        window.clearTimeout(restoreTimeout);
      }

      restoreTimeout = window.setTimeout(() => {
        if (shouldGuardControl(document.activeElement)) {
          return;
        }

        const viewportMeta = getViewportMeta();
        if (viewportMeta && originalViewportContent !== null) {
          viewportMeta.content = originalViewportContent;
        }

        originalViewportContent = null;
        restoreTimeout = null;
      }, 0);
    };

    document.addEventListener("pointerdown", applyGuard, true);
    document.addEventListener("touchstart", applyGuard, true);
    document.addEventListener("focusin", applyGuard, true);
    document.addEventListener("focusout", restoreGuard, true);

    return () => {
      document.removeEventListener("pointerdown", applyGuard, true);
      document.removeEventListener("touchstart", applyGuard, true);
      document.removeEventListener("focusin", applyGuard, true);
      document.removeEventListener("focusout", restoreGuard, true);

      if (restoreTimeout !== null) {
        window.clearTimeout(restoreTimeout);
      }

      const viewportMeta = getViewportMeta();
      if (viewportMeta && originalViewportContent !== null) {
        viewportMeta.content = originalViewportContent;
      }
    };
  }, []);
}

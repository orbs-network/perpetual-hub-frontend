import { useEffect } from "react";

const EDGE_SWIPE_GUARD_PX = 28;
const MIN_VERTICAL_INTENT_DELTA_PX = 12;
const MIN_HORIZONTAL_DELTA_PX = 18;
const HORIZONTAL_DOMINANCE_RATIO = 2;

type EdgeSwipeSide = "left" | "right" | null;
type GestureIntent = "horizontal" | "vertical" | null;

function isIosLikeNavigator(navigatorLike: Navigator) {
  const userAgent = navigatorLike.userAgent || "";
  const platform = navigatorLike.platform || "";

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && navigatorLike.maxTouchPoints > 1)
  );
}

export function usePreventIosSwipeNavigation() {
  useEffect(() => {
    if (!isIosLikeNavigator(window.navigator)) {
      return;
    }

    let startX = 0;
    let startY = 0;
    let edgeSwipeSide: EdgeSwipeSide = null;
    let gestureIntent: GestureIntent = null;

    const reset = () => {
      edgeSwipeSide = null;
      gestureIntent = null;
    };

    const getViewportWidth = () =>
      window.visualViewport?.width ||
      window.innerWidth ||
      document.documentElement.clientWidth;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }

      const touch = event.touches[0];
      const viewportWidth = getViewportWidth();
      startX = touch.clientX;
      startY = touch.clientY;
      gestureIntent = null;
      edgeSwipeSide =
        startX <= EDGE_SWIPE_GUARD_PX
          ? "left"
          : startX >= viewportWidth - EDGE_SWIPE_GUARD_PX
            ? "right"
            : null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!edgeSwipeSide || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absoluteDeltaX = Math.abs(deltaX);
      const absoluteDeltaY = Math.abs(deltaY);
      const isHistorySwipeDirection =
        edgeSwipeSide === "left" ? deltaX > 0 : deltaX < 0;

      if (
        gestureIntent === "vertical" ||
        (absoluteDeltaY >= MIN_VERTICAL_INTENT_DELTA_PX &&
          absoluteDeltaY >= absoluteDeltaX)
      ) {
        gestureIntent = "vertical";
        return;
      }

      if (!isHistorySwipeDirection) {
        return;
      }

      if (
        gestureIntent === "horizontal" ||
        absoluteDeltaX >= MIN_HORIZONTAL_DELTA_PX &&
          absoluteDeltaX > absoluteDeltaY * HORIZONTAL_DOMINANCE_RATIO
      ) {
        gestureIntent = "horizontal";
        if (event.cancelable) {
          event.preventDefault();
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", reset, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", reset);
      window.removeEventListener("touchcancel", reset);
    };
  }, []);
}

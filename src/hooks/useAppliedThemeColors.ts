import { useSyncExternalStore } from "react";
import {
  getAppliedThemeColors,
  subscribeAppliedThemeColors,
  type ThemeColors,
} from "@/config/partners";

/** React to the active checked-in or locally previewed partner theme. */
export function useAppliedThemeColors(): ThemeColors {
  return useSyncExternalStore(
    subscribeAppliedThemeColors,
    getAppliedThemeColors,
    getAppliedThemeColors,
  );
}

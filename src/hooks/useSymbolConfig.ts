import { useMemo } from "react";
import { useTeeConfig } from "./useTeeConfig";
import { getDisplaySymbol } from "@/lib/utils";
import type { SymbolConfig } from "@/api/tee";

type SymbolConfigResult = Partial<SymbolConfig> & {
  isLoading: boolean;
  isLoaded: boolean;
};

export function useSymbolConfig(symbol = ""): SymbolConfigResult {
  const { data: config, isLoading } = useTeeConfig();

  return useMemo(() => {
    if (!symbol) {
      return { isLoading, isLoaded: !!config };
    }

    const target = getDisplaySymbol(symbol);
    const entry = Object.entries(config?.symbolConfigs ?? {}).find(
      ([key]) => getDisplaySymbol(key) === target,
    );

    return {
      ...(entry?.[1] ?? {}),
      isLoading,
      isLoaded: !!config,
    };
  }, [symbol, config, isLoading]);
}

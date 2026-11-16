import { BINANCE_CONFIG, DEFAULT_PRICE_SOURCE } from "@/config/constants";

export const useBinanceApiUrls = () => {
  return BINANCE_CONFIG[DEFAULT_PRICE_SOURCE];
};

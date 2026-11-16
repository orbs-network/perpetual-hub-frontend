import { getAppPartnerChain } from "./config";

export function getCollateralSymbol(): string {
  return getAppPartnerChain().collateralSymbol;
}

const collateralLogos: Readonly<Record<string, string>> = {
  USDC: "/usdc.svg",
  USDT: "/usdt.svg",
  USDT0: "/usdt0.png",
};

export function getCollateralLogoUrl(symbol: string): string | undefined {
  return collateralLogos[symbol];
}

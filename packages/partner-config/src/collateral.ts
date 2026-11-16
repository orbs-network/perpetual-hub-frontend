export const PROTOCOL_COLLATERAL_DECIMALS = 6;

export type SupportedCollateralDecimals = 6 | 18;

export function collateralScale(collateralDecimals: number): bigint {
  if (collateralDecimals !== 6 && collateralDecimals !== 18) {
    throw new Error(`Unsupported collateral decimals: ${collateralDecimals}`);
  }
  return 10n ** BigInt(collateralDecimals - PROTOCOL_COLLATERAL_DECIMALS);
}

export function protocolToCollateralAmount(
  amount: bigint,
  collateralDecimals: number,
): bigint {
  return amount * collateralScale(collateralDecimals);
}

export function collateralToProtocolAmount(
  amount: bigint,
  collateralDecimals: number,
): bigint {
  return amount / collateralScale(collateralDecimals);
}

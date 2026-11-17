const PROTOCOL_COLLATERAL_DECIMALS = 6;

function collateralScale(collateralDecimals: number): bigint {
  if (collateralDecimals !== 6 && collateralDecimals !== 18) {
    throw new Error(`Unsupported collateral decimals: ${collateralDecimals}`);
  }
  return 10n ** BigInt(collateralDecimals - PROTOCOL_COLLATERAL_DECIMALS);
}

export function protocolToTokenAmount(
  amount: bigint,
  collateralDecimals: number,
): bigint {
  return amount * collateralScale(collateralDecimals);
}

export function tokenToProtocolAmount(
  amount: bigint,
  collateralDecimals: number,
): bigint {
  return amount / collateralScale(collateralDecimals);
}

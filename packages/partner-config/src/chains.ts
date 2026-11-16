export interface PartnerChainMetadata {
  chainId: number;
  chainName: string;
  collateralDecimals: 6 | 18;
  collateralAddress: string;
  collateralSymbol: string;
}

export interface PartnerChainConfig extends PartnerChainMetadata {
  contractAddress: string;
}

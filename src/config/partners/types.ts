import type {
  PartnerChainConfig,
  PartnerChainMetadata,
  PartnerId as SharedPartnerId,
} from '@perpetual-hub/partner-config';

export type { PartnerChainConfig, PartnerChainMetadata };
export type PartnerId = SharedPartnerId;

export interface ThemeColors {
  // Backgrounds
  base: string;
  surface: string;
  raised: string;
  hover: string;
  active: string;

  // Component backgrounds
  'input-bg': string;
  'tooltip-bg': string;
  'modal-bg': string;
  'badge-bg': string;
  'tab-active': string;
  'tab-inactive': string;
  'scrollbar': string;
  'scrollbar-hover': string;

  // Borders
  edge: string;
  'edge-subtle': string;

  // Trading
  long: string;
  'long-hover': string;
  short: string;
  'short-hover': string;
  'order-book-bid-depth': string;
  'order-book-ask-depth': string;

  // PnL
  up: string;
  'up-light': string;
  down: string;
  'down-light': string;

  // Status
  warning: string;

  // Accents
  'accent-primary': string;
  'accent-secondary': string;
  'accent-tertiary': string;

  // Interactive
  'button-primary': string;
  'button-primary-hover': string;
  'button-primary-bg': string;
  'button-primary-bg-hover': string;
  'button-primary-border': string;
  'button-primary-disabled-bg': string;
  'button-primary-disabled-border': string;
  'button-secondary': string;
  'button-secondary-hover': string;
  'button-secondary-border': string;
  'trade-long-active-bg': string;
  'trade-long-active-border': string;
  'trade-long-text': string;
  'trade-short-active-bg': string;
  'trade-short-active-border': string;
  'trade-short-text': string;
  'trade-side-inactive-bg': string;
  'trade-side-inactive-border': string;
  'trade-side-long-text': string;
  'trade-side-short-text': string;
  'slider-active': string;
  link: string;
  focus: string;
  overlay: string;
  spinner: string;
  selection: string;

  // Branding
  'logo-color': string;

  // Text
  content: string;
  'content-secondary': string;
  'content-muted': string;
  'content-inverse': string;

  // Shadows (not RGB-converted — used directly as box-shadow values)
  'shadow-card': string;
  'shadow-modal': string;
  'shadow-glow': string;
}

export interface PartnerFeatureFlags {
  /** Generate referral codes instead of asking the user to choose one. */
  autoGenerateReferralCode?: boolean;
  orderSizeInlineCounterpart?: boolean;
  pillTradingAccountActions?: boolean;
  themedOrderButtons?: boolean;
}

export interface PartnerComponentClassNames {
  tradeSideButtonRadius?: string;
}

export interface PartnerMarketPreferences {
  defaultSymbol: string;
  prioritySymbols: readonly string[];
}

export interface PartnerConfig {
  id: PartnerId;
  name: string;
  logoUrl: string;
  /** Full brand lockup for headers; logoUrl remains the compact icon. */
  wordmarkUrl?: string;
  chains: readonly PartnerChainConfig[];
  docsUrl: string;
  supportUrl: string;
  policyUrls: {
    termsOfUse: string;
    privacyPolicy: string;
  };
  favicon?: string;
  previewImageType?: string;
  previewImageUrl?: string;
  featureFlags?: PartnerFeatureFlags;
  componentClassNames?: PartnerComponentClassNames;
  marketPreferences?: PartnerMarketPreferences;
  theme: ThemeColors;
}

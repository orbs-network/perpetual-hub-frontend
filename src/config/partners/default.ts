import type { PartnerConfig } from './types';

export const defaultPartner: Omit<PartnerConfig, 'id'> = {
  name: 'Perpetual Hub',
  logoUrl: '/logo.svg',
  favicon: '/logo.svg',
  chains: [],
  docsUrl: 'https://docs.orbs.network/v3/protocols/perpetual-hub',
  supportUrl: 'https://www.orbs.com/contact/',
  policyUrls: {
    termsOfUse: '',
    privacyPolicy: '',
  },
  theme: {
    // Backgrounds - default dark violet palette
    base: '#07050d',
    surface: '#0d0a13',
    raised: '#17121f',
    hover: '#1d1727',
    active: '#241d30',

    // Component backgrounds
    'input-bg': '#0a0710',
    'tooltip-bg': '#17121f',
    'modal-bg': '#100c17',
    'badge-bg': '#17121f',
    'tab-active': '#191421',
    'tab-inactive': '#0d0a13',
    scrollbar: '#2a2335',
    'scrollbar-hover': '#3a3048',

    // Borders
    edge: '#211a2b',
    'edge-subtle': '#15101d',

    // Trading
    long: '#22c978',
    'long-hover': '#2bd987',
    short: '#f05c55',
    'short-hover': '#ff6b62',
    'order-book-bid-depth': '#22c978',
    'order-book-ask-depth': '#f05c55',

    // PnL
    up: '#22c978',
    'up-light': '#43df91',
    down: '#f05c55',
    'down-light': '#ff7b73',

    // Status
    warning: '#f4b94a',

    // Accents
    'accent-primary': '#6675f7',
    'accent-secondary': '#7a6df8',
    'accent-tertiary': '#a99cff',

    // Interactive
    'button-primary': '#6675f7',
    'button-primary-hover': '#7583ff',
    'button-primary-bg': '#6675f7',
    'button-primary-bg-hover': '#7583ff',
    'button-primary-border': '#6675f7',
    'button-primary-disabled-bg': 'rgba(102, 117, 247, 0.30)',
    'button-primary-disabled-border': 'rgba(102, 117, 247, 0.38)',
    'button-secondary': '#17121f',
    'button-secondary-hover': '#211a2b',
    'button-secondary-border': '#2a2234',
    'trade-long-active-bg': '#0d4a34',
    'trade-long-active-border': '#176344',
    'trade-long-text': '#2bd987',
    'trade-short-active-bg': '#3b1c22',
    'trade-short-active-border': '#642a31',
    'trade-short-text': '#ff766d',
    'trade-side-inactive-bg': '#17121f',
    'trade-side-inactive-border': '#211a2b',
    'trade-side-long-text': '#2bd987',
    'trade-side-short-text': '#ff766d',
    'slider-active': '#6675f7',
    link: '#7c88ff',
    focus: '#7c88ff',
    overlay: 'rgba(4, 2, 9, 0.78)',
    spinner: '#6675f7',
    selection: 'rgba(102, 117, 247, 0.55)',

    // Branding
    'logo-color': '#ffffff',

    // Text
    content: '#f5f3f8',
    'content-secondary': '#918b9d',
    'content-muted': 'rgba(245, 243, 248, 0.38)',
    'content-inverse': '#ffffff',

    // Shadows
    'shadow-card':
      '0 1px 0 rgba(255, 255, 255, 0.015), 0 10px 28px rgba(0, 0, 0, 0.24)',
    'shadow-modal': '0 24px 80px rgba(0, 0, 0, 0.62)',
    'shadow-glow': '0 0 18px rgba(102, 117, 247, 0.18)',
  },
};

/** The backend partner identity is supplied explicitly by the build environment. */
export function createPartnerConfig(id: string): PartnerConfig {
  return { ...defaultPartner, id };
}

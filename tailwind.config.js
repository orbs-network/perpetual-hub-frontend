/** @type {import('tailwindcss').Config} */

/** Helper: create a Tailwind color value that supports opacity modifiers */
const c = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // shadcn/ui tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        // Theme-driven colors — backgrounds
        base: c('base'),
        surface: c('surface'),
        raised: c('raised'),
        hover: c('hover'),
        active: c('active'),

        // Component backgrounds
        'input-bg': c('input-bg'),
        'tooltip-bg': c('tooltip-bg'),
        'modal-bg': c('modal-bg'),
        'badge-bg': c('badge-bg'),
        'tab-active': c('tab-active'),
        'tab-inactive': c('tab-inactive'),
        'scrollbar': c('scrollbar'),
        'scrollbar-hover': c('scrollbar-hover'),

        // Borders
        edge: c('edge'),
        'edge-subtle': c('edge-subtle'),

        // Trading
        long: c('long'),
        'long-hover': c('long-hover'),
        short: c('short'),
        'short-hover': c('short-hover'),
        'order-book-bid-depth': c('order-book-bid-depth'),
        'order-book-ask-depth': c('order-book-ask-depth'),

        // PnL
        up: c('up'),
        'up-light': c('up-light'),
        down: c('down'),
        'down-light': c('down-light'),

        // Status
        warning: c('warning'),

        // Accents
        'accent-primary': c('accent-primary'),
        'accent-secondary': c('accent-secondary'),
        'accent-tertiary': c('accent-tertiary'),

        // Interactive
        'button-primary': c('button-primary'),
        'button-primary-hover': c('button-primary-hover'),
        'button-secondary': c('button-secondary'),
        'button-secondary-hover': c('button-secondary-hover'),
        'button-secondary-border': c('button-secondary-border'),
        'trade-long-text': c('trade-long-text'),
        'trade-short-text': c('trade-short-text'),
        'trade-side-long-text': c('trade-side-long-text'),
        'trade-side-short-text': c('trade-side-short-text'),
        'slider-active': c('slider-active'),
        link: c('link'),
        focus: c('focus'),
        overlay: 'var(--color-overlay)',
        spinner: c('spinner'),
        selection: c('selection'),

        // Branding
        'logo-color': c('logo-color'),

        // Text
        content: c('content'),
        'content-secondary': c('content-secondary'),
        'content-muted': c('content-muted'),
        'content-inverse': c('content-inverse'),
        'content-on-up': c('content-on-up'),
        'content-on-down': c('content-on-down'),
        'content-on-warning': c('content-on-warning'),
        'content-on-long': c('content-on-long'),
      },
      boxShadow: {
        'glow-up': '0 0 10px rgb(var(--color-up) / 0.15)',
        'glow-down': '0 0 10px rgb(var(--color-down) / 0.15)',
        'card': 'var(--color-shadow-card)',
        'modal': 'var(--color-shadow-modal)',
        'glow': 'var(--color-shadow-glow)',
      },
      animation: {
        'toast-slide-in': 'toast-slide-in 0.3s ease-out forwards',
        'toast-slide-out': 'toast-slide-out 0.2s ease-in forwards',
      },
      keyframes: {
        'toast-slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-slide-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

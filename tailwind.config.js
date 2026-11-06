/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // KILN — the deep furnace-charcoal base. Not generic slate/zinc; warmed slightly
        // toward brown to read as "fired clay" rather than "tech dashboard."
        kiln: {
          950: 'rgb(var(--c-kiln-950) / <alpha-value>)',
          900: 'rgb(var(--c-kiln-900) / <alpha-value>)',
          800: 'rgb(var(--c-kiln-800) / <alpha-value>)',
          700: 'rgb(var(--c-kiln-700) / <alpha-value>)',
          600: 'rgb(var(--c-kiln-600) / <alpha-value>)',
          500: 'rgb(var(--c-kiln-500) / <alpha-value>)',
        },
        // EMBER — the signature accent. A muted brick-ember orange-red, never neon.
        ember: {
          400: 'rgb(var(--c-ember-400) / <alpha-value>)',
          500: 'rgb(var(--c-ember-500) / <alpha-value>)',
          600: 'rgb(var(--c-ember-600) / <alpha-value>)',
          700: 'rgb(var(--c-ember-700) / <alpha-value>)',
          glow: 'rgb(var(--c-ember-glow) / <alpha-value>)',
        },
        // CLAY — secondary warm neutral for cards/text-on-dark
        clay: {
          50: 'rgb(var(--c-clay-50) / <alpha-value>)',
          100: 'rgb(var(--c-clay-100) / <alpha-value>)',
          200: 'rgb(var(--c-clay-200) / <alpha-value>)',
          300: 'rgb(var(--c-clay-300) / <alpha-value>)',
          400: 'rgb(var(--c-clay-400) / <alpha-value>)',
          // Darker clay shades were referenced across the app but never
          // defined, so `text-clay-500` etc. silently rendered nothing.
          500: 'rgb(var(--c-clay-500) / <alpha-value>)',
          600: 'rgb(var(--c-clay-600) / <alpha-value>)',
          700: 'rgb(var(--c-clay-700) / <alpha-value>)',
          800: 'rgb(var(--c-clay-800) / <alpha-value>)',
        },
        glass: {
          panel: 'var(--glass-panel)',
          border: 'var(--glass-border)',
        },
        // LEDGER — status colors, desaturated to stay premium not candy-bright
        ledger: {
          paid: 'rgb(var(--c-ledger-paid) / <alpha-value>)',
          partial: 'rgb(var(--c-ledger-partial) / <alpha-value>)',
          overdue: 'rgb(var(--c-ledger-overdue) / <alpha-value>)',
          credit: 'rgb(var(--c-ledger-credit) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass-sm': '0 2px 12px -2px rgba(0,0,0,0.35)',
        'glass-md': '0 8px 32px -4px rgba(0,0,0,0.45)',
        'glass-lg': '0 16px 48px -8px rgba(0,0,0,0.55)',
        'ember-glow': '0 0 24px -2px rgba(242,112,61,0.45)',
        'inner-glass': 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'tap': '48px',
      },
      keyframes: {
        emberPulse: {
          '0%, 100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
        riseIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        emberPulse: 'emberPulse 2.4s ease-in-out infinite',
        riseIn: 'riseIn 0.4s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
};

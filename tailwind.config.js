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
          950: '#0E0B08',
          900: '#15110D',
          800: '#1D1712',
          700: '#28201A',
          600: '#372C23',
          500: '#4A3B2F',
        },
        // EMBER — the signature accent. A muted brick-ember orange-red, never neon.
        ember: {
          400: '#FF8B5E',
          500: '#F2703D',
          600: '#D9572A',
          700: '#B3441F',
          glow: '#FF7A45',
        },
        // CLAY — secondary warm neutral for cards/text-on-dark
        clay: {
          50: '#FBF7F2',
          100: '#F2E9DD',
          200: '#E3D3BE',
          300: '#C9AD8C',
          400: '#A88B68',
        },
        // LEDGER — status colors, desaturated to stay premium not candy-bright
        ledger: {
          paid: '#5FAE7E',
          partial: '#E0A23B',
          overdue: '#D9534F',
          credit: '#7C8FB0',
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

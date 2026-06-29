/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // These map to CSS variables set from window.Telegram.WebApp.themeParams
        // They automatically follow Telegram's dark/light mode.
        tg: {
          bg:           'var(--tg-bg)',
          'bg-secondary':'var(--tg-secondary-bg)',
          text:         'var(--tg-text)',
          hint:         'var(--tg-hint)',
          link:         'var(--tg-link)',
          button:       'var(--tg-button)',
          'button-text':'var(--tg-button-text)',
          accent:       'var(--tg-accent)',
          border:       'var(--tg-border)',
          card:         'var(--tg-card)',
          danger:       'var(--tg-danger)',
          success:      'var(--tg-success)',
          warning:      'var(--tg-warning)',
        },
      },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
          // Amharic fallbacks
          'Noto Sans Ethiopic', 'Abyssinica SIL',
        ],
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      minHeight: {
        touch: '44px', // Minimum touch target per Apple HIG
      },
      borderRadius: {
        tg: '12px',
      },
      animation: {
        'slide-in-left':  'slideInLeft 0.25s ease-out',
        'slide-out-left': 'slideOutLeft 0.2s ease-in',
        'fade-in':        'fadeIn 0.15s ease-out',
        'spin-slow':      'spin 1.5s linear infinite',
      },
      keyframes: {
        slideInLeft:  { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        slideOutLeft: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-100%)' } },
        fadeIn:       { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
};

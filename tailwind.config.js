/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  '#09090F',
          card:     '#111120',
          elevated: '#181829',
          hover:    '#1E1E32',
        },
        accent: {
          DEFAULT: '#5B8DF7',
          hover:   '#7AA3FF',
          muted:   'rgba(91,141,247,0.15)',
        },
        success: {
          DEFAULT: '#22D3A5',
          muted:   'rgba(34,211,165,0.15)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          muted:   'rgba(245,158,11,0.15)',
        },
        danger: {
          DEFAULT: '#F87171',
          muted:   'rgba(248,113,113,0.15)',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong:  'rgba(255,255,255,0.14)',
        },
        text: {
          1: '#EEF2FF',
          2: '#8892B0',
          3: '#565F7E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'slide-up':    'slideUp 0.2s ease-out',
        'slide-down':  'slideDown 0.2s ease-out',
        'fade-in':     'fadeIn 0.15s ease-out',
        'scale-in':    'scaleIn 0.15s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
        'cart-pop':    'cartPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        slideUp:    { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideDown:  { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:     { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:    { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        pulseSoft:  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        cartPop:    { from: { transform: 'scale(0.8)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

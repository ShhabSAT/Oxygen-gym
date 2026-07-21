    import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'oxygen-red': {
          DEFAULT: '#E53E3E',
          dark: '#C53030',
          light: '#FC8181',
        },
        'oxygen-black': {
          DEFAULT: '#1A1A1A',
          deep: '#121212',
        },
        'oxygen-silver': {
          DEFAULT: '#A0AEC0',
          light: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
} satisfies Config

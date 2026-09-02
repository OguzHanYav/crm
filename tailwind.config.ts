import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12151C',
        body: '#3C4257',
        muted: '#6B7280',
        bg: '#F5F6F8',
        surface: '#FFFFFF',
        line: '#E3E6EB',
        accent: {
          DEFAULT: '#3452FF',
          ink: '#1F35B3',
          soft: '#EEF1FF',
        },
        success: '#16A34A',
        danger: '#DC2626',
      },
      borderRadius: {
        md: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config

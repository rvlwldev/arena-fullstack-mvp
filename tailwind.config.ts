import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sideA: '#dc2626',
        sideB: '#2563eb',
      },
    },
  },
  plugins: [],
}

export default config

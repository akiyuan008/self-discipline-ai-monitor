/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 仿智谱清言设计语言
        brand: {
          DEFAULT: '#2454FF',
          50: '#EDF8FC',
          100: '#DCE6FF',
          200: '#B8CDFF',
          300: '#94B4FF',
          400: '#709BFF',
          500: '#2454FF',
          600: '#1E47DB',
          700: '#1738A8',
          800: '#0F286F',
          900: '#0A1A47'
        },
        ink: {
          1: '#1A2029',
          2: '#4F5866',
          3: '#838A95',
          4: '#B0B7C0'
        },
        bg: {
          page: '#F6F7F9',
          card: '#FFFFFF',
          soft: '#F2F7FF',
          grey: '#F3F8FC'
        },
        stroke: {
          DEFAULT: '#EEEEEE',
          soft: '#F5F5F5',
          strong: '#D3D7DD'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 16px rgba(26, 32, 41, 0.04)',
        float: '0 8px 32px rgba(36, 84, 255, 0.12)'
      },
      borderRadius: {
        card: '16px',
        pill: '999px'
      }
    }
  },
  plugins: []
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Public Sans', 'system-ui', 'sans-serif'],
      },

      colors: {
        brand: {
          50: '#ecfaf7',
          100: '#d6f4ef',
          500: '#0fa39a',
          600: '#0b8780',
          700: '#0b6d70',
          900: '#173a3d',
        },
        healthcare: { DEFAULT: '#dc2626', light: '#fee2e2', dark: '#991b1b' },
        fitness: { DEFAULT: '#16a34a', light: '#dcfce7', dark: '#14532d' },
        social: { DEFAULT: '#2563eb', light: '#dbeafe', dark: '#1e40af' },
        promo: { DEFAULT: '#d97706', light: '#fef3c7', dark: '#92400e' },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a5f',
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

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          50:  '#e8f5f0',
          100: '#c8e7dc',
          300: '#6fc1a6',
          400: '#3db38a',
          500: '#1d9e75',
          600: '#0f6e56',
          700: '#0a5443',
          950: '#042d22',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

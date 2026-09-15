/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171412',
        paper: '#E7E1D4',
        brass: '#A67C1A',
        soot: '#2F2A24',
        cream: '#F7F3EA',
        bone: '#E7E1D4',
        charcoal: '#171412',
        gold: '#A67C1A',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      letterSpacing: {
        tightish: '-0.03em',
      },
      maxWidth: {
        measure: '38rem',
      },
    },
  },
  plugins: [],
};

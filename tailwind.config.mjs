/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Signal palette. Names stay so existing utilities recolor together.
        // ink/charcoal/soot are neutral blacks. cream is white. paper/bone
        // are a cool gray. brass/gold are the single rose accent — not brass.
        ink: '#101014',
        charcoal: '#101014',
        soot: '#1A1A1F',
        cream: '#FFFFFF',
        paper: '#F4F4F5',
        bone: '#F4F4F5',
        brass: '#E1064A',
        gold: '#E1064A',
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

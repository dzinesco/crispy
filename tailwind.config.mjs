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
        // Darkened from #E1064A so rose text clears 6:1 on white.
        brass: '#9F1239',
        gold: '#9F1239',
        magenta: '#86104E',
      },
      fontFamily: {
        sans: ['Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        pixel: ['Silkscreen', 'ui-monospace', 'monospace'],
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

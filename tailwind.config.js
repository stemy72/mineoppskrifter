/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f6f4',
          100: '#e6eae5',
          200: '#cdd5cb',
          300: '#a8b5a2', // Main sage green
          400: '#8a9b83',
          500: '#6f8167',
          600: '#596852',
          700: '#475245',
          800: '#3a433a',
          900: '#313532',
        },
        accent: {
          50: '#fff2f1',
          100: '#ffe4e1',
          200: '#ffccc7',
          300: '#ffa69e',
          400: '#ff6f61', // Warm coral
          500: '#f94c3b',
          600: '#e53321',
          700: '#c02616',
          800: '#9e2217',
          900: '#82231a',
        },
        highlight: {
          50: '#fefaec',
          100: '#fdf4d0',
          200: '#f9e69d',
          300: '#f4c430', // Golden yellow
          400: '#e5b422',
          500: '#c49618',
          600: '#9c7514',
          700: '#7a5a15',
          800: '#654b17',
          900: '#544018',
        },
        neutral: {
          50: '#f8f8f8',
          100: '#f0f0f0',
          200: '#e4e4e4',
          300: '#d1d1d1',
          400: '#b4b4b4',
          500: '#9a9a9a',
          600: '#818181',
          700: '#6a6a6a',
          800: '#5a5a5a',
          900: '#333333', // Charcoal gray
        }
      }
    },
  },
  plugins: [],
};
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mahindra': {
          red: '#E31837',
          blue: '#00233D',
          gold: '#C5A572',
          'light-blue': '#007CC3',
          'forest-green': '#1C8A42',
          sand: '#F2E6D9',
        },
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        'open-sans': ['Open Sans', 'sans-serif'],
      },
      backgroundImage: {
        'resort-pattern': "url('/images/resort-pattern.png')",
      },
    },
  },
  plugins: [],
};

export default config;

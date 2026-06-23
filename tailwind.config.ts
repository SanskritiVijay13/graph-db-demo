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
        'mongodb': {
          slate: '#001E2B',
          white: '#FFFFFF',
          'spring-green': '#00ED64',
          'forest-green': '#00684A',
          evergreen: '#023430',
          mist: '#E3FCF7',
          lavender: '#F9EBFF',
          lime: '#E9FF99',
          sky: '#00D2FF',
          'clear-blue': '#006EFF',
        },
      },
    },
  },
  plugins: [],
};

export default config;

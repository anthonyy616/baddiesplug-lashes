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
        burgundy: {
          DEFAULT: '#940025',
          50: '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d5d9',
          300: '#f3b8bd',
          400: '#ea8788',
          500: '#940025',
          600: '#7a001f',
          700: '#620019',
          800: '#4c0014',
          900: '#3b0010',
        },
      },
    },
  },
  plugins: [],
};

export default config;

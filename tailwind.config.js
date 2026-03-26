/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        futuristic: {
          background: '#050505',
          primary: '#e7e7ea',
          secondary: '#71717a',
        },
      },
    },
  },
  plugins: [],
}

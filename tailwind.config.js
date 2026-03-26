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
          background: '#020617',
          primary: '#22d3ee',
          secondary: '#d946ef',
        },
      },
    },
  },
  plugins: [],
}

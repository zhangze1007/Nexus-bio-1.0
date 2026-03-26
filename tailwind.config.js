/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        futuristic: {
          background: '#050505',
          primary: '#f3f4f6',
          secondary: '#71717a',
        },
      },
    },
  },
  plugins: [],
}

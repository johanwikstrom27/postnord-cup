/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070A14",
          900: "#0B1023",
          800: "#0F1733",
          700: "#141E40",
        },
      },
    },
  },
  plugins: [],
};
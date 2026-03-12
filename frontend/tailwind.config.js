/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0D0D1A",
        surface:    "#1A1A2E",
        border:     "#2D2D4A",
        primary:    "#6366F1",
        secondary:  "#8B5CF6",
        success:    "#10B981",
        warning:    "#F59E0B",
        danger:     "#EF4444",
      }
    },
  },
  plugins: [],
}
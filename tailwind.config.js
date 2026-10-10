export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,jsx,ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1d1d1f", secondary: "#6e6e73", tertiary: "#86868b" },
        surface: { white: "#ffffff", light: "#fbfbfd", gray: "#f5f5f7", black: "#000000", card: "#1d1d1f" },
        line: "#d2d2d7", fill: "#e8e8ed",
        brand: { DEFAULT: "#0071e3", hover: "#0077ed", link: "#0066cc", linkDark: "#2997ff", footnote: "#bf4800" },
        ondark: { DEFAULT: "#f5f5f7", secondary: "#a1a1a6" }
      },
      fontFamily: { sans: ["var(--font-geist-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "Arial", "sans-serif"] },
      borderRadius: { pill: "980px", card: "28px" },
      spacing: { section: "96px" },
      backdropBlur: { nav: "20px" }
    }
  },
  plugins: []
};

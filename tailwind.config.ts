import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-outfit)", "sans-serif"],
      },
      colors: {
        brand: {
          orange: "#16A34A",
          "orange-dark": "#15803D",
          "orange-light": "#F0FDF4",
          // Teal unifié sur le même bleu Apple
          teal: "#0071E3",
          "teal-dark": "#0052A3",
          "teal-light": "#EBF4FF",
          // Rouge sobre
          red: "#E03131",
          "red-light": "#FFF0F0",
        },
        surface: {
          DEFAULT: "#F5F5F7",
          card: "#FFFFFF",
          border: "#D2D2D7",
          muted: "#F0F0F5",
        },
        ink: {
          DEFAULT: "#1D1D1F",
          secondary: "#6E6E73",
          muted: "#8E8E93",
          placeholder: "#AEAEB2",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06)",
        card: "0 4px 16px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        elevated: "0 8px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
        float: "0 20px 60px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)",
        "orange-glow": "0 0 0 3px rgba(22,163,74,0.2)",
        "teal-glow": "0 0 0 3px rgba(0,113,227,0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-in-right": "slideInRight 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 2s infinite linear",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

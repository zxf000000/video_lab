/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

        /* Cyberpunk palette */
        ink: "#030308",
        panel: "#0a0a18",
        panel2: "#111128",
        line: "#1e1e3a",

        /* Neon accents */
        mint: "#00f0ff",
        neon: {
          cyan: "#00f0ff",
          magenta: "#ff2d95",
          amber: "#ffb800",
          green: "#00ff88",
          yellow: "#ffee00",
        },
        ember: "#ff2d95",

        /* Subtle tones */
        void: "#020208",
        abyss: "#060612",
        deep: "#0d0d22",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "0px",
        sm: "0px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 240, 255, 0.15)",
        "glow-strong": "0 0 30px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1)",
        "glow-magenta": "0 0 20px rgba(255, 45, 149, 0.2), 0 0 40px rgba(255, 45, 149, 0.08)",
        "glow-amber": "0 0 20px rgba(255, 180, 0, 0.2), 0 0 40px rgba(255, 180, 0, 0.08)",
        "glow-green": "0 0 20px rgba(0, 255, 136, 0.2), 0 0 40px rgba(0, 255, 136, 0.08)",
        "neon-panel": "0 0 30px rgba(0, 240, 255, 0.08), inset 0 0 30px rgba(0, 240, 255, 0.02)",
        "inner-glow": "inset 0 0 30px rgba(0, 240, 255, 0.03)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-right": {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "neon-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 240, 255, 0.15)" },
          "50%": { boxShadow: "0 0 35px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "slide-right": "slide-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "neon-pulse": "neon-pulse 2s ease-in-out infinite",
      },
      backgroundImage: {
        "cyber-gradient": "linear-gradient(135deg, #00f0ff 0%, #ff2d95 50%, #ffb800 100%)",
        "cyber-gradient-subtle": "linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(255,45,149,0.1) 100%)",
        "panel-gradient": "linear-gradient(180deg, #0a0a18 0%, #0d0d22 100%)",
        "void-gradient": "linear-gradient(180deg, #030308 0%, #060612 50%, #030308 100%)",
      },
    },
  },
  plugins: [],
};

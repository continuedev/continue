/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
        "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
      },
      colors: {
        progress: {
          background: "var(--input-background)", // background of the progress bar
          foreground: "var(--button-background)", // the actual progress indicator
        },    
        background: "var(--background)",
        foreground: "var(--foreground)",
        button: {
          DEFAULT: "var(--button-background)",
          foreground: "var(--button-foreground)",
          hover: "var(--button-hover-background)",
        },
        input: {
          DEFAULT: "var(--input-background)",
          foreground: "var(--input-foreground)",
          border: "var(--input-border)",
        },
        dropdown: {
          DEFAULT: "var(--dropdown-background)",
          foreground: "var(--dropdown-foreground)",
        },
        list: {
          activeSelection: {
            background: "var(--list-active-selection-background)",
            foreground: "var(--list-active-selection-foreground)",
          },
          hoverBackground: "var(--list-hover-background)",
        },
        sidebar: {
          background: "var(--sidebar-background)",
        },
        statusbar: {
          background: "var(--statusbar-background)",
          foreground: "var(--statusbar-foreground)",
        },
        tab: {
          activeBackground: "var(--tab-active-background)",
          activeForeground: "var(--tab-active-foreground)",
        },

        /* Tailwind default configs */
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  corePlugins: {
    preflight: false,
  },
};

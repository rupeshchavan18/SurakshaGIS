/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gis: {
          darkest: 'rgb(var(--gis-darkest-rgb) / <alpha-value>)',
          dark: 'rgb(var(--gis-dark-rgb) / <alpha-value>)',
          surface: 'rgb(var(--gis-surface-rgb) / <alpha-value>)',
          card: 'rgb(var(--gis-card-rgb) / <alpha-value>)',
          border: 'rgb(var(--gis-border-rgb) / <alpha-value>)',
          borderLight: 'rgb(var(--gis-border-light-rgb) / <alpha-value>)',
          textPrimary: 'var(--gis-text-primary)',
          textSecondary: 'var(--gis-text-secondary)',
          textMuted: 'var(--gis-text-muted)',
          accent: '#2563eb',
          accentHover: '#1d4ed8',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          hazard: {
            landslide: '#dc2626',
            flood: '#2563eb',
            cloudburst: '#9333ea',
            erosion: '#ea580c',
            safe: '#059669',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'gis-glow': '0 0 20px -5px rgba(37, 99, 235, 0.35)',
        'hazard-glow': '0 0 20px -5px rgba(239, 68, 68, 0.4)',
      },
    },
  },
  plugins: [],
};

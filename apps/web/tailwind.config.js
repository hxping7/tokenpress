/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        't-bg-primary': 'var(--bg-primary)',
        't-bg-secondary': 'var(--bg-secondary)',
        't-bg-tertiary': 'var(--bg-tertiary)',
        't-text-primary': 'var(--text-primary)',
        't-text-secondary': 'var(--text-secondary)',
        't-text-muted': 'var(--text-muted)',
        't-accent-blue': 'var(--accent-blue)',
        't-accent-purple': 'var(--accent-purple)',
        't-accent-blue-dim': 'var(--accent-blue-dim)',
        't-border': 'var(--border-color)',
        't-hover': 'var(--hover-bg)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
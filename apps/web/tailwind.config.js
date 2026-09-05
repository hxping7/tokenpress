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
      fontSize: {
        // 字重走 --heading-weight：风格包可覆盖（design 包 400 细字重），未定义回退 700
        'heading-1': ['2.25rem', { lineHeight: '2.75rem', fontWeight: 'var(--heading-weight, 700)' }],
        'heading-2': ['1.875rem', { lineHeight: '2.25rem', fontWeight: 'var(--heading-weight, 700)' }],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}